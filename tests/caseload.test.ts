/**
 * Months, and the patients in them.
 *
 * The boundary cases are the whole test: a month is a half-open range, and
 * "last month" is wrong by one visit if either end is off by a day.
 */
import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  caseload,
  monthLabel,
  monthOf,
  monthWindow,
  monthsWithVisits,
} from '@domain/caseload.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import type { Prescription } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';

function enc(id: string, date: string, patch: Partial<Prescription> = {}): Prescription {
  return { ...emptyPrescription('paediatrics', id), date, createdAt: `${date}T09:00:00.000Z`, ...patch };
}

describe('the month window', () => {
  it('ends on the first of the next month, exclusive', () => {
    expect(monthWindow('2026-09')).toEqual({ from: '2026-09-01', toExclusive: '2026-10-01' });
  });

  it('rolls the year over in December', () => {
    expect(monthWindow('2026-12')).toEqual({ from: '2026-12-01', toExclusive: '2027-01-01' });
  });

  it('needs no month-length arithmetic, which is the point', () => {
    // February and September have different lengths and neither appears here.
    expect(monthWindow('2026-02').toExclusive).toBe('2026-03-01');
    expect(monthWindow('2024-02').toExclusive).toBe('2024-03-01');
  });
});

describe('which months are offered', () => {
  it('offers only months that have encounters', () => {
    const months = monthsWithVisits(['2026-09-20', '2026-09-02', '2026-07-11']);
    // August is not in the list. A month with nothing behind it is a button
    // leading nowhere.
    expect(months.map((m) => m.key)).toEqual(['2026-09', '2026-07']);
    expect(months[0]?.encounters).toBe(2);
  });

  it('puts 31 August and 1 September in different months', () => {
    expect(monthOf('2026-08-31')).toBe('2026-08');
    expect(monthOf('2026-09-01')).toBe('2026-09');
  });
});

describe('one row per patient', () => {
  const rows = caseload(
    '2026-09',
    [
      enc('a', '2026-09-02', { patientId: 'p1', diagnosis: ['Acute gastroenteritis'] }),
      enc('b', '2026-09-24', { patientId: 'p1', diagnosis: ['Dehydration, mild'] }),
      enc('c', '2026-09-11', { patientId: 'p1', diagnosis: ['Acute gastroenteritis'] }),
      enc('d', '2026-09-18', { patientId: 'p2', diagnosis: [] }),
    ],
    new Map([
      ['p1', 'Ayesha Khan'],
      ['p2', 'Bilal Ahmed'],
    ]),
  );

  it('collapses three visits into one row', () => {
    const ayesha = rows.rows.find((r) => r.patientId === 'p1')!;
    expect(ayesha.visits).toBe(3);
    expect(ayesha.lastSeen).toBe('2026-09-24');
  });

  it('shows the diagnosis from the latest visit', () => {
    const ayesha = rows.rows.find((r) => r.patientId === 'p1')!;
    expect(ayesha.diagnosis).toEqual(['Dehydration, mild']);
  });

  it('counts the other distinct diagnoses, not the other visits', () => {
    // Two earlier visits, but both said the same thing, so there is one other
    // diagnosis in the month and not two.
    const ayesha = rows.rows.find((r) => r.patientId === 'p1')!;
    expect(ayesha.otherDiagnoses).toBe(1);
  });

  it('uses the name on the record, not the one typed on the oldest script', () => {
    expect(rows.rows.find((r) => r.patientId === 'p1')?.name).toBe('Ayesha Khan');
  });

  it('orders by who was seen most recently', () => {
    expect(rows.rows.map((r) => r.patientId)).toEqual(['p1', 'p2']);
  });

  it('leaves the diagnosis empty rather than borrowing the problems', () => {
    // A presenting complaint dressed as a diagnosis is a quiet upgrade in
    // confidence. The UI says "No diagnosis recorded" instead.
    const bilal = rows.rows.find((r) => r.patientId === 'p2')!;
    expect(bilal.diagnosis).toEqual([]);
  });
});

describe('encounters nobody linked', () => {
  const out = caseload('2026-09', [
    enc('a', '2026-09-02', { patient: { name: 'Walk-in' } }),
    enc('b', '2026-09-03', { patient: { name: 'Another walk-in' } }),
    enc('c', '2026-09-04', { patientId: 'p1', patient: { name: 'Ayesha Khan' } }),
  ]);

  it('never folds two unidentified people into one row', () => {
    expect(out.unlinked).toHaveLength(2);
    expect(out.unlinked.every((r) => r.patientId === undefined)).toBe(true);
  });

  it('keeps them out of the patient rows entirely', () => {
    expect(out.rows.map((r) => r.patientId)).toEqual(['p1']);
  });
});

describe('month labels', () => {
  const now = new Date('2026-10-03T00:00:00.000Z');

  it('calls the current month what a doctor calls it', () => {
    expect(monthLabel('2026-10', now)).toBe('This month');
  });

  it('drops the year when it is this year and keeps it when it is not', () => {
    expect(monthLabel('2026-09', now)).toBe('September');
    expect(monthLabel('2025-09', now)).toBe('September 2025');
  });
});

describe('the index range, against a real database', () => {
  it('excludes the first of the next month', async () => {
    const database = await db.db();
    await database.clear('prescriptions');
    for (const [id, date] of [
      ['x1', '2026-08-31'],
      ['x2', '2026-09-01'],
      ['x3', '2026-09-30'],
      ['x4', '2026-10-01'],
    ] as const) {
      await db.savePrescription(enc(id, date));
    }

    const { from, toExclusive } = monthWindow('2026-09');
    const rows = await db.encountersBetween(from, toExclusive);
    expect(rows.map((r) => r.id).sort()).toEqual(['x2', 'x3']);
  });

  it('finds the months by skipping, and counts each one', async () => {
    const months = await db.monthsWithEncounters();
    expect(months.map((m) => m.key)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(months.find((m) => m.key === '2026-09')?.encounters).toBe(2);
  });
});
