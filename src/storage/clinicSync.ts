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

/** Everything in the clinic layer on this device, and nothing else. */
export async function localClinicState(): Promise<ClinicSyncState> {
  const [patients, dates] = await Promise.all([db.allPatients(), db.queueDates()]);
  const queues = await Promise.all(dates.map((d) => db.queueForDate(d)));
  return {
    patients,
    queue: queues.flat(),
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

  const local = await localClinicState();
  const res = await fetch('/api/clinic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ patients: local.patients, queue: local.queue }),
  });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  const merged = (await res.json()) as ClinicSyncState;

  for (const patient of merged.patients) await db.savePatient(patient);
  for (const entry of merged.queue) await db.saveQueueEntry(entry);
  return merged;
}
