/**
 * The clinic layer: today's queue, and what each visit was charged.
 *
 * WHAT THIS LAYER IS AND IS NOT
 * -----------------------------
 * It holds a name, an age, a sex, a token, a status and a fee. It holds NO
 * diagnosis, no drug, no dose, no examination. That separation is the whole
 * design: a receptionist works here, a doctor works in the clinical layer, and
 * the boundary is enforced by which data exists rather than by a permission
 * flag someone can be talked into changing.
 *
 * It is also what keeps PRODUCT.md rule 3.1's sentence literally true when a
 * clinic later shares this between two machines: *"Server stores NOTHING
 * clinical."* A shared queue is identity and money, not clinical content.
 *
 * MONEY IS DELIBERATELY SMALL
 * ---------------------------
 * A visit fee and a day-end total. No itemised bills, no receipts, no tax
 * invoices — so no financial record of account, and none of the retention
 * obligations that would come with one. Clinic software goes to die in
 * discounts, refunds, panel patients and receipt numbering, and none of that is
 * why a doctor would choose this product.
 *
 * Amounts are integers in MINOR units (paisa). Money in floating point is how
 * a day's total ends up at 4999.999999.
 */
import type { Sex } from './prescription.ts';

export type QueueStatus = 'waiting' | 'with-doctor' | 'done';

/** `waived` is not a discount — it is "seen, not charged", which happens daily. */
export type PaymentStatus = 'unpaid' | 'paid' | 'waived';

export interface QueueEntry {
  id: string;
  /** ISO date. A queue is a day's work; it does not roll over. */
  date: string;
  token: number;
  /** identity is required here -- the receptionist has the patient in front of them */
  name: string;
  age?: string;
  sex?: Sex;
  /** the identified patient record, when the receptionist matched one */
  patientId?: string;
  status: QueueStatus;
  payment: PaymentStatus;
  /** minor units (paisa). Absent means no fee was set, which is not the same as 0. */
  feeMinor?: number;
  createdAt: string;
  seenAt?: string;
  doneAt?: string;
  /** set once a script has been written for this visit */
  prescriptionId?: string;

  // --- fields that exist so two stations can disagree safely ---------------

  /** any change at all. Drives which copy of a row is the base when merging. */
  updatedAt: string;
  /**
   * When `payment` or `feeMinor` last changed. Reception owns money.
   *
   * A row-level last-write-wins loses real data here: reception marks a visit
   * PAID at 09:00, the doctor -- whose tablet synced before that -- marks it
   * DONE at 09:05, and the doctor's sync overwrites the payment with the stale
   * `unpaid` it still holds. The day's takings then quietly disagree with the
   * cash drawer. Timestamping the two contested fields separately is what lets
   * a merge keep both edits.
   */
  paymentAt?: string;
  /** When `status` last changed. The doctor owns the room. */
  statusAt?: string;
  /**
   * Soft delete. A row removed at reception must STAY removed -- without a
   * tombstone the doctor's stale copy simply re-adds it on the next sync, and
   * a visit nobody made reappears in the queue.
   */
  deletedAt?: string;
}

export interface ClinicSettings {
  enabled: boolean;
  currency: string;
  /** minor units; offered as the default on a new entry, never forced */
  defaultFeeMinor?: number;
}

export const defaultClinicSettings: ClinicSettings = {
  enabled: false,
  currency: 'PKR',
};

/** How long a deleted row is kept as a tombstone before it is really gone. */
export const TOMBSTONE_DAYS = 30;

/** Stamp a change. Pass which contested field moved so a merge can tell. */
export function touch(
  entry: QueueEntry,
  changed: 'payment' | 'status' | 'other' = 'other',
  at = new Date().toISOString(),
): QueueEntry {
  const next: QueueEntry = { ...entry, updatedAt: at };
  if (changed === 'payment') next.paymentAt = at;
  if (changed === 'status') next.statusAt = at;
  return next;
}

export function isDeleted(entry: { deletedAt?: string }): boolean {
  return typeof entry.deletedAt === 'string' && entry.deletedAt !== '';
}

/** Tombstones old enough that nobody's stale copy could still resurrect them. */
export function expiredTombstones(
  rows: Array<{ deletedAt?: string }>,
  now = Date.now(),
): number {
  const cutoff = now - TOMBSTONE_DAYS * 86400000;
  return rows.filter((r) => isDeleted(r) && Date.parse(r.deletedAt!) < cutoff).length;
}

/** Tokens restart each day, because that is what a paper token book does. */
export function nextToken(entries: QueueEntry[], date: string): number {
  // Deleted rows still hold their token, so numbers never get reused mid-day.
  const today = entries.filter((e) => e.date === date);
  return today.reduce((max, e) => Math.max(max, e.token), 0) + 1;
}

export const QUEUE_ORDER: QueueStatus[] = ['waiting', 'with-doctor', 'done'];

/** waiting -> with-doctor -> done. Never backwards by accident. */
export function nextStatus(status: QueueStatus): QueueStatus {
  const at = QUEUE_ORDER.indexOf(status);
  return QUEUE_ORDER[Math.min(at + 1, QUEUE_ORDER.length - 1)]!;
}

/** Rows a human should see: tombstones are storage, not queue entries. */
export function liveEntries(entries: QueueEntry[]): QueueEntry[] {
  return entries.filter((e) => !isDeleted(e));
}

export function sortQueue(entries: QueueEntry[]): QueueEntry[] {
  const rank: Record<QueueStatus, number> = { 'with-doctor': 0, waiting: 1, done: 2 };
  return liveEntries(entries).sort(
    (a, b) => rank[a.status] - rank[b.status] || a.token - b.token,
  );
}

export interface DayTotals {
  seen: number;
  waiting: number;
  /** minor units actually taken */
  collectedMinor: number;
  /** minor units billed but not yet taken */
  outstandingMinor: number;
  waived: number;
}

/**
 * The day-end figure.
 *
 * Collected and outstanding are kept apart on purpose: a single "revenue"
 * number that silently includes money nobody has handed over is the kind of
 * figure that gets believed.
 */
export function dayTotals(entries: QueueEntry[], date: string): DayTotals {
  const today = liveEntries(entries).filter((e) => e.date === date);
  let collectedMinor = 0;
  let outstandingMinor = 0;
  let waived = 0;
  for (const entry of today) {
    const fee = entry.feeMinor ?? 0;
    if (entry.payment === 'paid') collectedMinor += fee;
    else if (entry.payment === 'waived') waived += 1;
    else outstandingMinor += fee;
  }
  return {
    seen: today.filter((e) => e.status === 'done').length,
    waiting: today.filter((e) => e.status !== 'done').length,
    collectedMinor,
    outstandingMinor,
    waived,
  };
}

/** Parse what someone typed into a fee box. Rejects anything that is not money. */
export function parseFee(input: string): number | undefined {
  const clean = input.replace(/[,\s]/g, '');
  if (!clean) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return undefined;
  return Math.round(Number(clean) * 100);
}

/**
 * Format minor units. Whole amounts print without decimals, because a clinic
 * charging Rs 1500 should not be shown "Rs 1500.00" all day.
 */
export function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  const body = Number.isInteger(major)
    ? String(major)
    : major.toFixed(2);
  const symbol = currency === 'PKR' ? 'Rs' : currency;
  return `${symbol} ${body}`;
}
