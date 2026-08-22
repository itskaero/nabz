/**
 * On-device storage. IndexedDB, never localStorage (too small, synchronous,
 * and the first thing a browser evicts).
 *
 * THE RULE THIS FILE MUST NOT BREAK (PRODUCT.md rule 3.4): there is no function
 * here that loads a prior prescription by matching a patient. `searchHistory`
 * returns candidates for a human to pick from, and `getPrescription` takes an
 * id the human picked. Auto-loading a returning patient's last script is a
 * wrong-patient medication-error vector, so the code path simply does not
 * exist -- not disabled behind a flag, absent.
 *
 * Nothing here ever talks to a server. The only thing that leaves the device is
 * a file the doctor explicitly exports (see backup.ts).
 */
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { GrowthPoint, Prescription } from '@domain/prescription.ts';
import type { DoctorProfile } from '@config/doctorProfile.ts';
import type { ContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import type { PatientRecord, LegacyGrowthLink } from '@domain/patient.ts';
import type { QueueEntry } from '@domain/clinic.ts';

const DB_NAME = 'nabz';
const DB_VERSION = 4;

/**
 * Edited content: the specialty pack and the locale packs, as authored in the
 * pack builder.
 *
 * Stored whole rather than as a patch. DESIGN.md 12 promises "live JSON preview
 * = exactly what the app imports", and a diff against a shipped default that
 * moves underneath you cannot promise that. `basedOn` records what it was
 * forked from so a later migration can reason about it.
 *
 * This store holds NOTHING clinical. It is reference content -- drug names,
 * chip labels, phrase templates -- and is meant to be shared between
 * clinicians, which is why its export is plain JSON while a records backup is
 * encrypted.
 */
export interface StoredContent {
  pack: ContentPack;
  phrases: PackRegistry;
  basedOn: { packId: string; appVersion: string };
  updatedAt: string;
}

/** A term the doctor has typed before, ranked by how often they type it. */
export interface LearnedTerm {
  /** `${field}:${normalised text}` */
  key: string;
  field: 'problem' | 'diagnosis' | 'finding' | 'drug' | 'advice';
  text: string;
  count: number;
  lastUsed: string;
}

interface NabzDb extends DBSchema {
  prescriptions: {
    key: string;
    value: Prescription;
    indexes: { byDate: string; byPatient: string };
  };
  /**
   * Growth points live in their own store, keyed by patient reference, because
   * they are the one thing that legitimately spans encounters -- and keeping
   * them separate makes that carve-out visible instead of hidden inside the
   * prescription store. See PRODUCT.md 4b.
   */
  /**
   * LEGACY growth, keyed by the old name-derived key. Read-only from v3 on.
   *
   * Left exactly as it was rather than migrated in place: the old key merged
   * namesakes, and no field records which point belonged to which child. An
   * automatic migration would have to guess, and a guess here becomes a growth
   * chart that looks authoritative. See domain/patient.ts.
   */
  growth: {
    key: string;
    value: { patientKey: string; patientName: string; points: GrowthPoint[]; updatedAt: string };
  };
  /** Growth keyed by a real patient id. Everything written from v3 lands here. */
  growthSeries: {
    key: string;
    value: { patientId: string; points: GrowthPoint[]; updatedAt: string };
  };
  patients: {
    key: string;
    value: PatientRecord;
    indexes: { byName: string };
  };
  /**
   * The clinic layer. Identity, a token, a status and a fee -- deliberately no
   * clinical content, so a shared queue never carries a diagnosis. See
   * domain/clinic.ts.
   */
  queue: {
    key: string;
    value: QueueEntry;
    indexes: { byDate: string };
  };
  learned: { key: string; value: LearnedTerm; indexes: { byField: string } };
  profile: { key: string; value: DoctorProfile };
  content: { key: string; value: StoredContent };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<NabzDb>> | null = null;

export function db(): Promise<IDBPDatabase<NabzDb>> {
  dbPromise ??= openDB<NabzDb>(DB_NAME, DB_VERSION, {
    // Version-guarded so an existing install upgrades rather than being
    // recreated. Losing a doctor's records to a schema bump is not a bug we
    // get to fix afterwards -- there is no server copy.
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const rx = database.createObjectStore('prescriptions', { keyPath: 'id' });
        rx.createIndex('byDate', 'date');
        rx.createIndex('byPatient', 'patient.name');

        database.createObjectStore('growth', { keyPath: 'patientKey' });

        const learned = database.createObjectStore('learned', { keyPath: 'key' });
        learned.createIndex('byField', 'field');

        database.createObjectStore('profile');
        database.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        database.createObjectStore('content');
      }
      if (oldVersion < 3) {
        // Additive only. The legacy `growth` store is untouched, so an upgrade
        // cannot lose or corrupt a child's measurements; linking it to a real
        // patient is a later, deliberate, human act.
        const patients = database.createObjectStore('patients', { keyPath: 'id' });
        patients.createIndex('byName', 'name');
        database.createObjectStore('growthSeries', { keyPath: 'patientId' });
      }
      if (oldVersion < 4) {
        const queue = database.createObjectStore('queue', { keyPath: 'id' });
        queue.createIndex('byDate', 'date');
      }
    },
  });
  return dbPromise;
}

// --- prescriptions ---------------------------------------------------------

export async function savePrescription(rx: Prescription): Promise<void> {
  const database = await db();
  await database.put('prescriptions', rx);
  await database.put('meta', new Date().toISOString(), 'lastWriteAt');
}

/** Loads ONE prescription the doctor explicitly selected, by its id. */
export async function getPrescription(id: string): Promise<Prescription | undefined> {
  return (await db()).get('prescriptions', id);
}

export async function deletePrescription(id: string): Promise<void> {
  await (await db()).delete('prescriptions', id);
}

export async function recentPrescriptions(limit = 30): Promise<Prescription[]> {
  const database = await db();
  const all = await database.getAll('prescriptions');
  return all
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/**
 * Search history for the refill flow. Returns CANDIDATES; selecting one is a
 * separate, explicit act by the doctor. This function never returns "the" match.
 */
export async function searchHistory(query: string, limit = 25): Promise<Prescription[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const all = await (await db()).getAll('prescriptions');
  return all
    .filter((rx) => {
      const haystack = [
        rx.patient.name,
        rx.patient.reference ?? '',
        rx.patient.contact ?? '',
        ...rx.diagnosis,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function prescriptionCount(): Promise<number> {
  return (await db()).count('prescriptions');
}

// --- patients ---------------------------------------------------------------

/**
 * Patient identity, as a real entity with a generated id.
 *
 * There is deliberately no `findPatientByName()`. Matching is a human decision
 * (see `rankCandidates` in domain/patient.ts) because a function that returns
 * ONE patient for a name is how the wrong chart gets opened.
 */
export async function savePatient(patient: PatientRecord): Promise<void> {
  await (await db()).put('patients', { ...patient, updatedAt: new Date().toISOString() });
}

export async function getPatient(id: string): Promise<PatientRecord | undefined> {
  return (await db()).get('patients', id);
}

export async function allPatients(): Promise<PatientRecord[]> {
  return (await db()).getAll('patients');
}

export async function deletePatient(id: string): Promise<void> {
  await (await db()).delete('patients', id);
}

/**
 * Fold `sourceId` into `targetId`: prescriptions and growth move across, then
 * the source record is removed.
 *
 * Merging is destructive and irreversible, so it is never automatic -- the
 * caller must have shown a human both records first.
 */
export async function mergePatients(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) return;
  const database = await db();

  const scripts = await database.getAll('prescriptions');
  for (const rx of scripts) {
    if (rx.patientId === sourceId) await database.put('prescriptions', { ...rx, patientId: targetId });
  }

  const from = await database.get('growthSeries', sourceId);
  if (from) {
    const into = await database.get('growthSeries', targetId);
    const byId = new Map((into?.points ?? []).map((pt) => [pt.id, pt]));
    for (const pt of from.points) if (!byId.has(pt.id)) byId.set(pt.id, pt);
    await database.put('growthSeries', {
      patientId: targetId,
      points: [...byId.values()].sort((a, b) => a.ageDays - b.ageDays),
      updatedAt: new Date().toISOString(),
    });
    await database.delete('growthSeries', sourceId);
  }

  await database.delete('patients', sourceId);
}

/** Every prescription belonging to one identified patient, newest first. */
export async function patientHistory(patientId: string): Promise<Prescription[]> {
  const all = await (await db()).getAll('prescriptions');
  return all
    .filter((rx) => rx.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// --- growth (the named carve-out) ------------------------------------------

/**
 * Load one confirmed patient's measurement series.
 *
 * The `confirmed` argument is not decoration. PRODUCT.md rule 3.4 forbids
 * cross-encounter auto-carry; 4b permits this ONE exception when the doctor
 * explicitly opens Growth for an identified patient. Passing `false` throws,
 * so a future caller cannot slip a silent auto-load past review by omitting
 * the confirmation step.
 */
export async function loadGrowthSeries(
  patientId: string,
  confirmed: boolean,
): Promise<GrowthPoint[]> {
  if (!confirmed) {
    throw new Error(
      'growth series load requires an explicit doctor confirmation for an identified patient (PRODUCT.md 4b)',
    );
  }
  const row = await (await db()).get('growthSeries', patientId);
  return row?.points ?? [];
}

export async function saveGrowthSeries(
  patientId: string,
  points: GrowthPoint[],
): Promise<void> {
  await (await db()).put('growthSeries', {
    patientId,
    points,
    updatedAt: new Date().toISOString(),
  });
}

// --- legacy growth, awaiting a human ---------------------------------------

/**
 * Growth series still keyed by the old name-derived key.
 *
 * Each of these is unusable until someone says which child it belongs to. A
 * `nameDerived` key is the dangerous case: if two children shared that name,
 * their points are interleaved in one series and nothing in the data can
 * separate them.
 */
export async function legacyGrowthSeries(): Promise<LegacyGrowthLink[]> {
  const rows = await (await db()).getAll('growth');
  return rows
    .map((r) => ({
      legacyKey: r.patientKey,
      patientName: r.patientName,
      pointCount: r.points.length,
      updatedAt: r.updatedAt,
      // The old key was `reference || name`. If it equals the folded name, it
      // came from the name -- the collision-prone path.
      nameDerived: r.patientKey === r.patientName.trim().toLowerCase().replace(/\s+/g, ' '),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function legacyGrowthPoints(legacyKey: string): Promise<GrowthPoint[]> {
  const row = await (await db()).get('growth', legacyKey);
  return row?.points ?? [];
}

/**
 * Attach a legacy series to a real patient, keeping only the points the human
 * selected. `keepPointIds` exists precisely so a merged two-child series can be
 * split by hand rather than assigned wholesale.
 */
export async function linkLegacyGrowth(
  legacyKey: string,
  patientId: string,
  keepPointIds: string[],
  confirmed: boolean,
): Promise<void> {
  if (!confirmed) {
    throw new Error('linking a legacy growth series requires explicit confirmation');
  }
  const database = await db();
  const legacy = await database.get('growth', legacyKey);
  if (!legacy) return;

  const keep = new Set(keepPointIds);
  const moving = legacy.points.filter((pt) => keep.has(pt.id));
  const existing = await database.get('growthSeries', patientId);
  const byId = new Map((existing?.points ?? []).map((pt) => [pt.id, pt]));
  for (const pt of moving) byId.set(pt.id, pt);
  await database.put('growthSeries', {
    patientId,
    points: [...byId.values()].sort((a, b) => a.ageDays - b.ageDays),
    updatedAt: new Date().toISOString(),
  });

  // Leave behind whatever was not claimed, so a second child's points survive
  // for a second pass rather than being destroyed by the first.
  const remaining = legacy.points.filter((pt) => !keep.has(pt.id));
  if (remaining.length === 0) await database.delete('growth', legacyKey);
  else await database.put('growth', { ...legacy, points: remaining });
}

// --- clinic queue -----------------------------------------------------------

export async function saveQueueEntry(entry: QueueEntry): Promise<void> {
  await (await db()).put('queue', entry);
}

export async function queueForDate(date: string): Promise<QueueEntry[]> {
  return (await db()).getAllFromIndex('queue', 'byDate', date);
}

export async function getQueueEntry(id: string): Promise<QueueEntry | undefined> {
  return (await db()).get('queue', id);
}

export async function deleteQueueEntry(id: string): Promise<void> {
  await (await db()).delete('queue', id);
}

/** Every queue day still held on this device, newest first. */
export async function queueDates(): Promise<string[]> {
  const all = await (await db()).getAll('queue');
  return [...new Set(all.map((e) => e.date))].sort((a, b) => b.localeCompare(a));
}

// --- learned autocomplete --------------------------------------------------

export async function learn(field: LearnedTerm['field'], text: string): Promise<void> {
  const clean = text.trim();
  if (clean.length < 2) return;
  const key = `${field}:${clean.toLowerCase()}`;
  const database = await db();
  const existing = await database.get('learned', key);
  await database.put('learned', {
    key,
    field,
    text: clean,
    count: (existing?.count ?? 0) + 1,
    lastUsed: new Date().toISOString(),
  });
}

/** The doctor's OWN history, ranked by frequency then recency. */
export async function suggest(
  field: LearnedTerm['field'],
  query: string,
  limit = 8,
): Promise<LearnedTerm[]> {
  const q = query.trim().toLowerCase();
  const database = await db();
  const rows = await database.getAllFromIndex('learned', 'byField', field);
  return rows
    .filter((r) => (q ? r.text.toLowerCase().includes(q) : true))
    .sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, limit);
}

/**
 * Free-text findings the doctor keeps typing, so the palette can offer to grow
 * (PRODUCT.md 8). Returns candidates only -- promoting one is the doctor's call.
 */
export async function promotionCandidates(minCount = 4): Promise<LearnedTerm[]> {
  const rows = await (await db()).getAllFromIndex('learned', 'byField', 'finding');
  return rows.filter((r) => r.count >= minCount).sort((a, b) => b.count - a.count);
}

// --- profile ---------------------------------------------------------------

export async function loadProfile(): Promise<DoctorProfile | undefined> {
  return (await db()).get('profile', 'current');
}

export async function saveProfile(profile: DoctorProfile): Promise<void> {
  await (await db()).put('profile', profile, 'current');
}

// --- authored content ------------------------------------------------------

export async function loadContent(): Promise<StoredContent | undefined> {
  return (await db()).get('content', 'current');
}

export async function saveContent(content: StoredContent): Promise<void> {
  await (await db()).put('content', content, 'current');
}

/** Revert to the packs this build shipped with. */
export async function clearContent(): Promise<void> {
  await (await db()).delete('content', 'current');
}

// --- durability nag --------------------------------------------------------

export async function lastBackupAt(): Promise<string | undefined> {
  return (await db()).get('meta', 'lastBackupAt') as Promise<string | undefined>;
}

export async function markBackedUp(): Promise<void> {
  await (await db()).put('meta', new Date().toISOString(), 'lastBackupAt');
}

/**
 * Ask the browser to make this origin's storage persistent. Local storage is
 * evictable, and eviction here means a doctor loses their records -- the known
 * v1 weakness (PRODUCT.md 12). This reduces the risk; it does not remove it,
 * which is why the export nag stays loud regardless of the answer.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
