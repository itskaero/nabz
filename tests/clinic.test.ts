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
  formatMoney,
  nextStatus,
  nextToken,
  parseFee,
  sortQueue,
} from '@domain/clinic.ts';
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
      ['createdAt', 'date', 'feeMinor', 'id', 'name', 'patientId', 'payment', 'status', 'token'].sort(),
    );
  });
});
