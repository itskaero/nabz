/**
 * Syncing the clinic layer between a reception station and a doctor's device.
 *
 * WHAT CROSSES THE WIRE, AND WHAT NEVER DOES
 * ------------------------------------------
 * Patients and queue rows. That is the entire payload. Prescriptions,
 * examinations, growth series, advice and the learned vocabulary are not sent,
 * not requested, and have no code path to reach this module — the clinical
 * layer stays on the doctor's device, which is what keeps PRODUCT.md rule 3.1's
 * sentence true even in a two-station clinic.
 *
 * The server enforces the same whitelist independently (server/index.mjs), so a
 * bug here cannot start writing clinical content to a shared machine. Two locks
 * on the same door, because only one of them is in code the clinic controls.
 *
 * Conflict resolution is last-write-wins per row. A queue is one day's work in
 * one building, usually with one person typing; anything cleverer would be
 * machinery for a problem this does not have.
 */
import type { QueueEntry } from '@domain/clinic.ts';
import type { PatientRecord } from '@domain/patient.ts';
import * as db from './db.ts';

export interface ClinicSyncState {
  patients: PatientRecord[];
  queue: QueueEntry[];
  updatedAt: string | null;
  /** the station's clock, so the next sync can ask for changes since then */
  serverTime?: string;
}

/**
 * The pairing code and the sync watermark.
 *
 * localStorage rather than IndexedDB on purpose: these are per-DEVICE facts,
 * not clinical records, and they must survive without being caught up in the
 * encrypted backup that carries patient data.
 */
const PAIRING_KEY = 'nabz.pairing';

/**
 * TWO watermarks, and they must not be the same value.
 *
 * There was one, set from the station's clock and then used to filter which
 * LOCAL rows to send -- rows stamped with this device's clock. A device running
 * even a few seconds behind the station therefore filtered out every change it
 * had just made, and pushed nothing, silently, until the clocks happened to
 * cross. The doctor's "with doctor" and "done" never reached the front desk.
 *
 * Pulling asks the station "what changed since YOUR time X", so that watermark
 * has to be the station's. Pushing asks "what have I changed since MY time Y",
 * so that one has to be local. Sharing a value between them compares two
 * clocks that were never agreed.
 */
const PULLED_KEY = 'nabz.lastSync';
const PUSHED_KEY = 'nabz.lastPush';

export function pairedCode(): string | null {
  try {
    return localStorage.getItem(PAIRING_KEY);
  } catch {
    return null;
  }
}

export function setPairedCode(code: string): void {
  try {
    localStorage.setItem(PAIRING_KEY, code.trim());
  } catch {
    /* private mode: the device simply will not stay paired */
  }
}

export function forgetPairing(): void {
  try {
    localStorage.removeItem(PAIRING_KEY);
    localStorage.removeItem(PULLED_KEY);
    localStorage.removeItem(PUSHED_KEY);
  } catch {
    /* nothing to forget */
  }
}

function mark(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function remember(key: string, at: string | undefined): void {
  if (!at) return;
  try {
    localStorage.setItem(key, at);
  } catch {
    /* falls back to a full sync next time, which is correct if slower */
  }
}

/**
 * The address answers, but not with the app. Distinct from "this host has no
 * queue", which is an ordinary state, and from "the station is off", which is
 * also ordinary. This one means someone is looking at the wrong URL.
 */
export class SyncMisconfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncMisconfigured';
  }
}

export class PairingRequired extends Error {
  constructor() {
    super('This device is not paired with the clinic station yet.');
    this.name = 'PairingRequired';
  }
}

export type SyncMode = 'serve' | 'clinic';

/**
 * Does the origin this app was loaded from offer a shared queue?
 *
 * A Railway deployment answers `serve`, meaning it hands over the app and holds
 * nothing — so the queue stays local to the device and nothing is shared.
 */
export async function detectSyncMode(signal?: AbortSignal): Promise<SyncMode> {
  try {
    const init: RequestInit = signal ? { signal } : {};
    const res = await fetch('/api/mode', init);
    if (!res.ok) return 'serve';
    const text = await res.text();
    try {
      const body = JSON.parse(text) as { mode?: string };
      return body.mode === 'clinic' ? 'clinic' : 'serve';
    } catch {
      /*
        A reply that is not JSON is NOT the same as a host with no queue, and
        treating it as one hid a real failure: with TLS on, the station's plain
        port answered every path with its certificate page, so a device still on
        http:// parsed HTML, concluded "no shared queue", and stopped syncing
        without a word. The front desk kept adding patients the doctor never saw.

        Something is answering at this address and it is not the app we expect,
        so say so rather than degrading into a silent solo mode.
      */
      throw new SyncMisconfigured(
        text.includes('Set up this device')
          ? 'This address is the certificate setup page, not the app. Open the https:// address the clinic station prints.'
          : 'Something other than the Nabz station answered at this address.',
      );
    }
  } catch (err) {
    if (err instanceof SyncMisconfigured) throw err;
    // Offline, or a plain static host. Either way: no sharing.
    return 'serve';
  }
}

/**
 * What this device has changed since `since`, and nothing else.
 *
 * Sending the whole history every time is fine at twenty patients and wasteful
 * at five thousand, so a sync carries the day's edits rather than the archive.
 * An empty `since` means a first sync and sends everything, which is correct.
 */
export async function localClinicState(since = ''): Promise<ClinicSyncState> {
  const [patients, dates] = await Promise.all([db.allPatients(), db.queueDates()]);
  const queues = await Promise.all(dates.map((d) => db.queueForDate(d)));
  const changed = <T extends { updatedAt?: string; createdAt?: string }>(rows: T[]) =>
    since ? rows.filter((r) => (r.updatedAt ?? r.createdAt ?? '') > since) : rows;
  return {
    patients: changed(patients),
    queue: changed(queues.flat()),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Push what this device has, take back the merged result, and write it down.
 *
 * Returns null when the origin does not offer sync, so callers can treat "no
 * shared queue" as an ordinary state rather than an error — a solo doctor on a
 * static host is the common case, not a failure.
 */
export async function syncClinicLayer(): Promise<ClinicSyncState | null> {
  const mode = await detectSyncMode();
  if (mode !== 'clinic') return null;

  const code = pairedCode();
  if (!code) throw new PairingRequired();

  const pulledFrom = mark(PULLED_KEY);
  // Taken from THIS device's clock, before reading, so a change made during the
  // round trip is picked up next time rather than falling in the gap.
  const pushingAt = new Date().toISOString();
  const local = await localClinicState(mark(PUSHED_KEY));

  const res = await fetch(`/api/clinic?since=${encodeURIComponent(pulledFrom)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nabz-pairing': code },
    body: JSON.stringify({ patients: local.patients, queue: local.queue }),
  });
  if (res.status === 401) {
    forgetPairing();
    throw new PairingRequired();
  }
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  const merged = (await res.json()) as ClinicSyncState;

  for (const patient of merged.patients) await db.savePatient(patient);
  for (const entry of merged.queue) await db.saveQueueEntry(entry);

  // Each watermark in its own clock. Asking the station for changes uses the
  // station's time; deciding what of ours to send next uses ours.
  remember(PULLED_KEY, merged.serverTime);
  remember(PUSHED_KEY, pushingAt);
  return merged;
}
