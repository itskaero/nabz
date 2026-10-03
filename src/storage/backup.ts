/**
 * Manual encrypted export / import. The doctor owns the file; we stay
 * non-custodial (PRODUCT.md 12).
 *
 * Crypto: AES-GCM 256, key derived from the doctor's passphrase with PBKDF2-
 * SHA-256 at 310,000 iterations, random 16-byte salt and 12-byte IV per export.
 * WebCrypto only -- no dependency, nothing to keep patched.
 *
 * A wrong passphrase fails as an authentication error rather than producing
 * plausible-looking garbage, because AES-GCM authenticates. That matters: a
 * silently corrupted restore of clinical records is worse than a failed one.
 */
import type { Prescription } from '@domain/prescription.ts';
import type { DoctorProfile } from '@config/doctorProfile.ts';
import type { GrowthPoint } from '@domain/prescription.ts';
import type { LearnedTerm } from './db.ts';
import type { PatientRecord } from '@domain/patient.ts';
import type { PatientClinical } from '@domain/patientClinical.ts';
import { db, markBackedUp } from './db.ts';
import { requireWebCrypto } from '@domain/secureContext.ts';

const MAGIC = 'NABZ-BACKUP';
const FORMAT_VERSION = 2;
const PBKDF2_ITERATIONS = 310_000;

export interface BackupPayload {
  magic: typeof MAGIC;
  version: number;
  exportedAt: string;
  prescriptions: Prescription[];
  /** the LEGACY name-keyed growth store, still read-only since v3 */
  growth: Array<{ patientKey: string; patientName: string; points: GrowthPoint[]; updatedAt: string }>;
  learned: LearnedTerm[];
  profile?: DoctorProfile;

  /*
    Format 2 adds three stores that format 1 silently left out.

    This was a real hole, not a new feature: `patients` and `growthSeries` have
    existed since schema v3 and were never collected, so restoring a backup
    gave a doctor their prescriptions back with every patient identity and
    every modern growth series gone -- and the prescriptions' `patientId`
    fields pointing at records that no longer existed. The symptom would only
    show up on the day someone actually needed the restore.

    Optional on read, because a format-1 file is still a valid backup and a
    restore is not the moment to start refusing files.
  */
  patients?: PatientRecord[];
  growthSeries?: Array<{ patientId: string; points: GrowthPoint[]; updatedAt: string }>;
  /**
   * Allergies and the problem list. In the backup, because this is the
   * doctor's own encrypted file and it is the whole clinical record -- the
   * thing it is excluded from is the STATION SYNC, which is a different
   * boundary entirely (see domain/patientClinical.ts).
   */
  patientClinical?: PatientClinical[];
}

/** The on-disk envelope. Only `payload` is ciphertext; the rest is parameters. */
export interface BackupFile {
  magic: typeof MAGIC;
  version: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; saltB64: string };
  cipher: { name: 'AES-GCM'; ivB64: string };
  exportedAt: string;
  /** base64 ciphertext of the JSON-encoded BackupPayload */
  payloadB64: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const byte of view) s += String.fromCharCode(byte);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function collectBackup(includeProfile = true): Promise<BackupPayload> {
  const database = await db();
  const [prescriptions, growth, learned, profile, patients, growthSeries, patientClinical] =
    await Promise.all([
      database.getAll('prescriptions'),
      database.getAll('growth'),
      database.getAll('learned'),
      database.get('profile', 'current'),
      database.getAll('patients'),
      database.getAll('growthSeries'),
      database.getAll('patientClinical'),
    ]);
  const payload: BackupPayload = {
    magic: MAGIC,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    prescriptions,
    growth,
    learned,
    patients,
    growthSeries,
    patientClinical,
  };
  if (includeProfile && profile) payload.profile = profile;
  return payload;
}

export async function exportEncrypted(
  passphrase: string,
  includeProfile = true,
): Promise<Blob> {
  // Checked BEFORE the passphrase, so a doctor on a plain-HTTP LAN address is
  // told the real problem rather than being sent to think about their password.
  requireWebCrypto('Backing up');
  if (passphrase.length < 8) {
    throw new Error('Use a passphrase of at least 8 characters. This file holds patient records.');
  }
  const payload = await collectBackup(includeProfile);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(payload)),
  );

  const file: BackupFile = {
    magic: MAGIC,
    version: FORMAT_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, saltB64: toB64(salt) },
    cipher: { name: 'AES-GCM', ivB64: toB64(iv) },
    exportedAt: payload.exportedAt,
    payloadB64: toB64(ciphertext),
  };
  await markBackedUp();
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
}

export async function decryptBackup(
  fileText: string,
  passphrase: string,
): Promise<BackupPayload> {
  // A restore is when someone has already lost something. Failing here with
  // "Cannot read properties of undefined" would be the worst possible moment
  // for an unreadable error.
  requireWebCrypto('Restoring a backup');
  let file: BackupFile;
  try {
    file = JSON.parse(fileText) as BackupFile;
  } catch {
    throw new Error('That file is not a Nabz backup.');
  }
  if (file.magic !== MAGIC) throw new Error('That file is not a Nabz backup.');
  if (file.version > FORMAT_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update first.');
  }
  const key = await deriveKey(passphrase, fromB64(file.kdf.saltB64), file.kdf.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(file.cipher.ivB64) as BufferSource },
      key,
      fromB64(file.payloadB64) as BufferSource,
    );
  } catch {
    // AES-GCM authenticates, so this is "wrong passphrase or damaged file" and
    // never "here is some plausible-looking wrong data".
    throw new Error('Wrong passphrase, or the file is damaged.');
  }
  return JSON.parse(dec.decode(plain)) as BackupPayload;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  prescriptions: number;
  /** the LEGACY name-keyed series. `patientSeries` counts the modern ones. */
  growthSeries: number;
  learnedTerms: number;
  profileRestored: boolean;
  skipped: number;
  patients: number;
  patientSeries: number;
  patientClinical: number;
}

/**
 * Restore a backup.
 *
 * `merge` keeps anything already on this device and skips records whose id is
 * already present; it never overwrites a local record with an older one from a
 * file. `replace` is destructive and the UI must confirm it in as many words.
 */
export async function importBackup(
  payload: BackupPayload,
  mode: ImportMode = 'merge',
): Promise<ImportSummary> {
  const database = await db();
  const summary: ImportSummary = {
    prescriptions: 0,
    growthSeries: 0,
    learnedTerms: 0,
    profileRestored: false,
    skipped: 0,
    patients: 0,
    patientSeries: 0,
    patientClinical: 0,
  };

  if (mode === 'replace') {
    await Promise.all([
      database.clear('prescriptions'),
      database.clear('growth'),
      database.clear('learned'),
      database.clear('patients'),
      database.clear('growthSeries'),
      database.clear('patientClinical'),
    ]);
  }

  /*
    Patients first, so that by the time a prescription or an allergy list lands
    the record its `patientId` names already exists. On a merge an existing
    local record wins: it is the one the doctor has been editing today, and the
    file is by definition older than the device it is being restored onto.
  */
  for (const patient of payload.patients ?? []) {
    if (mode === 'merge' && (await database.get('patients', patient.id))) continue;
    await database.put('patients', patient);
    summary.patients += 1;
  }

  for (const series of payload.growthSeries ?? []) {
    const existing =
      mode === 'merge' ? await database.get('growthSeries', series.patientId) : undefined;
    if (existing) {
      // Union by point id, exactly as the legacy store below: restoring an
      // older file must not be able to delete a visit recorded since.
      const byId = new Map(existing.points.map((pt) => [pt.id, pt]));
      for (const pt of series.points) if (!byId.has(pt.id)) byId.set(pt.id, pt);
      await database.put('growthSeries', {
        ...existing,
        points: [...byId.values()].sort((a, b) => a.ageDays - b.ageDays),
      });
    } else {
      await database.put('growthSeries', series);
    }
    summary.patientSeries += 1;
  }

  for (const record of payload.patientClinical ?? []) {
    const existing =
      mode === 'merge' ? await database.get('patientClinical', record.patientId) : undefined;
    if (existing) {
      // Union, never overwrite. An allergy recorded on this device since the
      // backup was taken is the one that must survive the restore.
      const fold = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
      const allergies = [...existing.allergies];
      const seenAllergy = new Set(allergies.map((a) => fold(a.substance)));
      for (const a of record.allergies) {
        if (!seenAllergy.has(fold(a.substance))) {
          seenAllergy.add(fold(a.substance));
          allergies.push(a);
        }
      }
      const problems = [...existing.problems];
      const seenProblem = new Set(problems.map((pr) => fold(pr.label)));
      for (const pr of record.problems) {
        if (!seenProblem.has(fold(pr.label))) {
          seenProblem.add(fold(pr.label));
          problems.push(pr);
        }
      }
      await database.put('patientClinical', { ...existing, allergies, problems });
    } else {
      await database.put('patientClinical', record);
    }
    summary.patientClinical += 1;
  }

  for (const rx of payload.prescriptions) {
    if (mode === 'merge' && (await database.get('prescriptions', rx.id))) {
      summary.skipped += 1;
      continue;
    }
    await database.put('prescriptions', rx);
    summary.prescriptions += 1;
  }

  for (const series of payload.growth) {
    const existing = mode === 'merge' ? await database.get('growth', series.patientKey) : undefined;
    if (existing) {
      // Union by point id, so restoring an older file cannot delete newer visits.
      const byId = new Map(existing.points.map((p) => [p.id, p]));
      for (const p of series.points) if (!byId.has(p.id)) byId.set(p.id, p);
      await database.put('growth', { ...existing, points: [...byId.values()] });
    } else {
      await database.put('growth', series);
    }
    summary.growthSeries += 1;
  }

  for (const term of payload.learned) {
    const existing = mode === 'merge' ? await database.get('learned', term.key) : undefined;
    await database.put(
      'learned',
      existing ? { ...term, count: Math.max(term.count, existing.count) } : term,
    );
    summary.learnedTerms += 1;
  }

  if (payload.profile) {
    await database.put('profile', payload.profile, 'current');
    summary.profileRestored = true;
  }

  return summary;
}

export function backupFilename(now = new Date()): string {
  return `nabz-backup-${now.toISOString().slice(0, 10)}.nabz.json`;
}
