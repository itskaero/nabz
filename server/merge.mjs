/**
 * Merging two stations' view of the clinic layer.
 *
 * THE BUG THIS REPLACES
 * ---------------------
 * The first version merged whole rows by last-write-wins, and had no timestamp
 * to compare, so it resolved to *whoever synced last*. In a clinic that meant:
 *
 *   09:00  reception queues Ayesha and takes payment  -> paid
 *   09:05  doctor (tablet synced before that) marks her done
 *   09:06  doctor syncs -> payment silently reverts to unpaid
 *
 * The day's takings then disagree with the cash drawer and nobody knows why.
 *
 * The fix rests on an observation about who edits what: **reception owns the
 * money, the doctor owns the room.** Those two fields are the only ones two
 * people touch concurrently, so they carry their own timestamps and are merged
 * independently of the rest of the row. Everything else is genuinely
 * last-write-wins, which is correct for fields only one station edits.
 *
 * Deletions are tombstones. Without one, a row removed at reception is simply
 * re-added by the next stale sync, and a visit nobody made reappears.
 *
 * Plain JavaScript on purpose: the server runs this straight from source and
 * also inside the packaged .exe, so it must not need a TypeScript build step.
 */

/** Later of two ISO timestamps, treating missing as "long ago". */
function newer(a, b) {
  return (a ?? '') >= (b ?? '') ? a : b;
}

function isLater(a, b) {
  return (a ?? '') > (b ?? '');
}

/**
 * Merge one row against its counterpart.
 *
 * `contested` names the fields that two stations edit independently, each with
 * its own `<field>At` stamp. They are resolved per field; the rest of the row
 * comes from whichever copy is newer overall.
 */
export function mergeRow(mine, theirs, contested = []) {
  if (!mine) return theirs;
  if (!theirs) return mine;

  // A tombstone wins over any edit older than the deletion. Editing a row you
  // had not yet learned was deleted must not bring it back.
  const myDelete = mine.deletedAt ?? '';
  const theirDelete = theirs.deletedAt ?? '';
  if (myDelete || theirDelete) {
    const deletedAt = newer(myDelete, theirDelete);
    const survivor = isLater(mine.updatedAt, theirs.updatedAt) ? mine : theirs;
    return { ...survivor, deletedAt };
  }

  const base = isLater(theirs.updatedAt, mine.updatedAt) ? { ...theirs } : { ...mine };

  for (const { field, stamp } of contested) {
    const mineAt = mine[stamp];
    const theirsAt = theirs[stamp];
    // Whoever touched THIS field most recently wins it, regardless of who
    // touched the row last. That is the whole point.
    const winner = isLater(theirsAt, mineAt) ? theirs : isLater(mineAt, theirsAt) ? mine : base;
    base[field] = winner[field];
    const at = newer(mineAt, theirsAt);
    if (at !== undefined) base[stamp] = at;
  }

  base.updatedAt = newer(mine.updatedAt, theirs.updatedAt) ?? base.updatedAt;
  return base;
}

/** Fields two people edit at the same time, and the stamp that decides each. */
export const QUEUE_CONTESTED = [
  { field: 'payment', stamp: 'paymentAt' },
  { field: 'feeMinor', stamp: 'paymentAt' },
  { field: 'status', stamp: 'statusAt' },
  { field: 'seenAt', stamp: 'statusAt' },
  { field: 'doneAt', stamp: 'statusAt' },
];

export function mergeCollection(existing, incoming, pickFields, contested = []) {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const raw of incoming ?? []) {
    if (!raw || typeof raw.id !== 'string') continue;
    const clean = pickFields(raw);
    byId.set(clean.id, mergeRow(byId.get(clean.id), clean, contested));
  }
  return [...byId.values()];
}

/**
 * Drop tombstones old enough that no station could still be holding a stale
 * copy of the original row. Thirty days is far longer than any device is
 * plausibly offline in a working clinic.
 */
export function purgeTombstones(rows, tombstoneDays = 30, now = Date.now()) {
  const cutoff = now - tombstoneDays * 86400000;
  return rows.filter((r) => !r.deletedAt || Date.parse(r.deletedAt) >= cutoff);
}

/** Only what changed since the caller last synced. */
export function changedSince(rows, since) {
  if (!since) return rows;
  return rows.filter((r) => (r.updatedAt ?? r.createdAt ?? '') > since);
}
