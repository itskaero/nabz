/**
 * Types for the merge, which is authored in plain JavaScript so the server can
 * run it straight from source and from inside the packaged .exe without a
 * TypeScript build step. The declarations exist so the tests -- which are the
 * only TypeScript that touches it -- still typecheck.
 */

/** A row two stations can both hold: an id, a clock, and maybe a tombstone. */
export interface Syncable {
  id: string;
  updatedAt?: string;
  createdAt?: string;
  deletedAt?: string;
  [field: string]: unknown;
}

/** A field two people edit concurrently, and the stamp that decides it. */
export interface ContestedField {
  field: string;
  stamp: string;
}

export const QUEUE_CONTESTED: ContestedField[];

/**
 * Deliberately NOT generic over the two sides: the whole job is reconciling two
 * copies that differ, so a signature that forces them to the same shape would
 * reject exactly the cases worth testing.
 */
export function mergeRow(
  mine: Syncable | undefined,
  theirs: Syncable | undefined,
  contested?: ContestedField[],
): Syncable;

export function mergeCollection(
  existing: Syncable[],
  incoming: Syncable[] | undefined,
  pickFields: (row: Syncable) => Syncable,
  contested?: ContestedField[],
): Syncable[];

export function purgeTombstones<T extends { deletedAt?: string }>(
  rows: T[],
  tombstoneDays?: number,
  now?: number,
): T[];

export function changedSince<T extends { updatedAt?: string; createdAt?: string }>(
  rows: T[],
  since: string,
): T[];
