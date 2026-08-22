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
const SINCE_KEY = 'nabz.lastSync';

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
    localStorage.removeItem(SINCE_KEY);
  } catch {
    /* nothing to forget */
  }
}

function lastSync(): string {
  try {
    return localStorage.getItem(SINCE_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberSync(at: string | undefined): void {
  if (!at) return;
  try {
    localStorage.setItem(SINCE_KEY, at);
  } catch {
    /* falls back to a full sync next time, which is correct if slower */
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
    const body = (await res.json()) as { mode?: string };
    return body.mode === 'clinic' ? 'clinic' : 'serve';
  } catch {
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

  const since = lastSync();
  const local = await localClinicState(since);
  const res = await fetch(`/api/clinic?since=${encodeURIComponent(since)}`, {
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
  // Watermark from the STATION's clock, not this device's -- two machines'
  // clocks disagree, and a fast local clock would skip other people's edits.
  rememberSync(merged.serverTime);
  return merged;
}
