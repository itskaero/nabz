/**
 * The clinic layer.
 *
 * Two things these tests are really about:
 *  - money is integer minor units, because a day's takings computed in floats
 *    ends up at 4999.999999;
 *  - the queue holds identity and money and NOTHING clinical, which is what
 *    keeps a shared queue compatible with PRODUCT.md rule 3.1.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { QueueEntry } from '@domain/clinic.ts';
import {
  dayTotals,
  expiredTombstones,
  formatMoney,
  isDeleted,
  liveEntries,
  nextStatus,
  nextToken,
  parseFee,
  sortQueue,
  touch,
} from '@domain/clinic.ts';
import { mergeRow, purgeTombstones, QUEUE_CONTESTED } from '../server/merge.mjs';
import * as db from '@storage/db.ts';

let n = 0;
const entry = (over: Partial<QueueEntry> = {}): QueueEntry => ({
  id: `q${++n}`,
  date: '2026-08-22',
  token: 1,
  name: 'Ayesha Khan',
  status: 'waiting',
  payment: 'unpaid',
  createdAt: '2026-08-22T09:00:00.000Z',
  updatedAt: '2026-08-22T09:00:00.000Z',
  ...over,
});

beforeEach(async () => {
  await (await db.db()).clear('queue');
});

describe('tokens', () => {
  it('start at 1 and restart each day', () => {
    const today = [entry({ token: 1 }), entry({ token: 2 })];
    expect(nextToken(today, '2026-08-22')).toBe(3);
    // a new day is a new token book
    expect(nextToken(today, '2026-08-23')).toBe(1);
  });
});

describe('status', () => {
  it('advances one way only and stops at done', () => {
    expect(nextStatus('waiting')).toBe('with-doctor');
    expect(nextStatus('with-doctor')).toBe('done');
    expect(nextStatus('done')).toBe('done');
  });

  it('puts whoever is in the room first, then the waiting list in token order', () => {
    const rows = [
      entry({ token: 3, status: 'done' }),
      entry({ token: 2, status: 'waiting' }),
      entry({ token: 1, status: 'waiting' }),
      entry({ token: 4, status: 'with-doctor' }),
    ];
    expect(sortQueue(rows).map((r) => r.token)).toEqual([4, 1, 2, 3]);
  });
});

describe('money', () => {
  it('parses only things that are actually money', () => {
    expect(parseFee('1500')).toBe(150000);
    expect(parseFee('1,500')).toBe(150000);
    expect(parseFee('1500.50')).toBe(150050);
    expect(parseFee('')).toBeUndefined();
    expect(parseFee('abc')).toBeUndefined();
    expect(parseFee('15.999')).toBeUndefined();
    expect(parseFee('-20')).toBeUndefined();
  });

  it('adds up in integers, so a day total never drifts', () => {
    const rows = [
      entry({ feeMinor: 150050, payment: 'paid' }),
      entry({ feeMinor: 150050, payment: 'paid' }),
      entry({ feeMinor: 150050, payment: 'paid' }),
    ];
    const totals = dayTotals(rows, '2026-08-22');
    expect(totals.collectedMinor).toBe(450150);
    // A money amount keeps its trailing zero: Rs 4501.50, never Rs 4501.5.
    expect(formatMoney(totals.collectedMinor, 'PKR')).toBe('Rs 4501.50');
  });

  it('keeps collected and outstanding apart', () => {
    const rows = [
      entry({ feeMinor: 150000, payment: 'paid', status: 'done' }),
      entry({ feeMinor: 150000, payment: 'unpaid' }),
      entry({ feeMinor: 150000, payment: 'waived' }),
    ];
    const totals = dayTotals(rows, '2026-08-22');
    // A single "revenue" figure that quietly included unpaid visits is exactly
    // the number that would get believed.
    expect(totals.collectedMinor).toBe(150000);
    expect(totals.outstandingMinor).toBe(150000);
    expect(totals.waived).toBe(1);
    expect(totals.seen).toBe(1);
    expect(totals.waiting).toBe(2);
  });

  it('ignores other days', () => {
    const rows = [
      entry({ feeMinor: 100000, payment: 'paid' }),
      entry({ date: '2026-08-21', feeMinor: 900000, payment: 'paid' }),
    ];
    expect(dayTotals(rows, '2026-08-22').collectedMinor).toBe(100000);
  });

  it('prints whole amounts without decimals', () => {
    expect(formatMoney(150000, 'PKR')).toBe('Rs 1500');
    expect(formatMoney(150050, 'PKR')).toBe('Rs 1500.50');
    expect(formatMoney(150000, 'USD')).toBe('USD 1500');
  });
});

describe('storage', () => {
  it('round-trips a queue day and keeps days separate', async () => {
    await db.saveQueueEntry(entry({ token: 1 }));
    await db.saveQueueEntry(entry({ token: 2 }));
    await db.saveQueueEntry(entry({ date: '2026-08-21', token: 1 }));

    expect(await db.queueForDate('2026-08-22')).toHaveLength(2);
    expect(await db.queueForDate('2026-08-21')).toHaveLength(1);
    expect(await db.queueDates()).toEqual(['2026-08-22', '2026-08-21']);
  });

  it('holds nothing clinical', async () => {
    const row = entry({ feeMinor: 150000, patientId: 'p1' });
    await db.saveQueueEntry(row);
    const stored = (await db.queueForDate('2026-08-22'))[0]!;
    const keys = Object.keys(stored);
    // The whole point of the layer split: a receptionist's machine can hold
    // this without holding a diagnosis.
    for (const forbidden of ['diagnosis', 'medications', 'advice', 'examination', 'problems']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(keys.sort()).toEqual(
      ['createdAt', 'updatedAt', 'date', 'feeMinor', 'id', 'name', 'patientId', 'payment', 'status', 'token'].sort(),
    );
  });
});

describe('a removed row', () => {
  it('is a tombstone, not a hole', async () => {
    const row = entry({ token: 5 });
    await db.saveQueueEntry(row);
    await db.deleteQueueEntry(row.id);

    // Still on disk -- that is the point. A hard delete looks exactly like
    // "this row has not reached me yet", so the next stale sync re-adds it.
    const stored = (await db.queueForDate('2026-08-22')).find((e) => e.id === row.id);
    expect(stored).toBeDefined();
    expect(isDeleted(stored!)).toBe(true);

    // But nobody sees it, and it is not in the day's money.
    expect(liveEntries([stored!])).toHaveLength(0);
    expect(sortQueue([stored!])).toHaveLength(0);
    expect(dayTotals([{ ...stored!, feeMinor: 150000, payment: 'paid' }], '2026-08-22')
      .collectedMinor).toBe(0);
  });

  it('keeps its token, so the numbering after it does not shift', async () => {
    const rows = [entry({ token: 1 }), touch(entry({ token: 2 }), 'other')];
    const removed = { ...rows[1]!, deletedAt: '2026-08-22T09:10:00.000Z' };
    expect(nextToken([rows[0]!, removed], '2026-08-22')).toBe(3);
  });

  it('is really gone once no device could still be holding the original', () => {
    const old = { deletedAt: '2026-01-01T00:00:00.000Z' };
    const recent = { deletedAt: new Date().toISOString() };
    const now = Date.parse('2026-08-22T00:00:00.000Z');
    expect(expiredTombstones([old, recent], now)).toBe(1);
    expect(purgeTombstones([old, recent], 30, now)).toHaveLength(1);
  });
});

/**
 * The merge itself, without a server in the way. These are the cases that a
 * live probe of the first implementation got wrong.
 */
describe('merging two stations', () => {
  const at = (t: string) => `2026-08-22T${t}:00.000Z`;

  it('resolves payment and status independently of who wrote last', () => {
    const reception = {
      id: 'q1', payment: 'paid', paymentAt: at('09:02'),
      status: 'waiting', updatedAt: at('09:02'),
    };
    const doctor = {
      id: 'q1', payment: 'unpaid',
      status: 'done', statusAt: at('09:05'), updatedAt: at('09:05'),
    };
    const merged = mergeRow(reception, doctor, QUEUE_CONTESTED);
    expect(merged.payment).toBe('paid');
    expect(merged.status).toBe('done');
    // Symmetric: which copy arrives first must not change the answer.
    const other = mergeRow(doctor, reception, QUEUE_CONTESTED);
    expect(other.payment).toBe('paid');
    expect(other.status).toBe('done');
  });

  it('lets a later payment correct an earlier one', () => {
    const wrong = { id: 'q1', payment: 'paid', paymentAt: at('09:02'), updatedAt: at('09:02') };
    const fixed = { id: 'q1', payment: 'unpaid', paymentAt: at('09:20'), updatedAt: at('09:20') };
    expect(mergeRow(wrong, fixed, QUEUE_CONTESTED).payment).toBe('unpaid');
  });

  it('lets a deletion beat an edit made without knowing about it', () => {
    const deleted = { id: 'q1', name: 'X', deletedAt: at('10:01'), updatedAt: at('10:01') };
    const stale = { id: 'q1', name: 'X', status: 'done', updatedAt: at('10:00') };
    expect(mergeRow(stale, deleted, QUEUE_CONTESTED).deletedAt).toBe(at('10:01'));
    expect(mergeRow(deleted, stale, QUEUE_CONTESTED).deletedAt).toBe(at('10:01'));
  });

  it('takes whichever side exists when the other has never seen the row', () => {
    const row = { id: 'q1', updatedAt: at('09:00') };
    expect(mergeRow(undefined, row, QUEUE_CONTESTED)).toBe(row);
    expect(mergeRow(row, undefined, QUEUE_CONTESTED)).toBe(row);
  });
});

describe('touch', () => {
  it('stamps which contested field moved, and only that one', () => {
    const base = entry();
    const paid = touch(base, 'payment', '2026-08-22T09:02:00.000Z');
    expect(paid.paymentAt).toBe('2026-08-22T09:02:00.000Z');
    expect(paid.statusAt).toBeUndefined();
    expect(paid.updatedAt).toBe('2026-08-22T09:02:00.000Z');

    const seen = touch(base, 'status', '2026-08-22T09:05:00.000Z');
    expect(seen.statusAt).toBe('2026-08-22T09:05:00.000Z');
    expect(seen.paymentAt).toBeUndefined();
  });
});
