/**
 * Results that arrive after the visit, and the trend they make.
 *
 * The two rules worth holding: nothing here decides what is abnormal, and two
 * points are not a trend.
 */
import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { MIN_TREND_POINTS, seriesFor, sparkline, trendPoints } from '@domain/labResult.ts';
import type { LabResult } from '@domain/labResult.ts';
import * as db from '@storage/db.ts';

function r(id: string, labId: string, value: string, takenOn: string, patientId = 'p1'): LabResult {
  return {
    id,
    patientId,
    labId,
    label: labId,
    value,
    unit: 'mg/dL',
    takenOn,
    enteredOn: `${takenOn}T12:00:00.000Z`,
  };
}

describe('grouping', () => {
  const all = [
    r('a', 'creatinine', '1.2', '2026-03-01'),
    r('b', 'creatinine', '1.6', '2026-06-01'),
    r('c', 'creatinine', '2.1', '2026-09-01'),
    r('d', 'hba1c', '8.1', '2026-09-02'),
    r('e', 'creatinine', '9.9', '2026-09-03', 'p2'),
  ];

  it('never shows another patient’s result', () => {
    const series = seriesFor(all, 'p1');
    const creat = series.find((s) => s.labId === 'creatinine')!;
    expect(creat.results.map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(creat.results.some((x) => x.id === 'e')).toBe(false);
  });

  it('puts the most recently measured test first', () => {
    expect(seriesFor(all, 'p1').map((s) => s.labId)).toEqual(['hba1c', 'creatinine']);
  });
});

describe('the trend', () => {
  it('needs three points, because two joined by a line is not a trend', () => {
    const two = seriesFor([r('a', 'creatinine', '1.2', '2026-03-01'), r('b', 'creatinine', '1.6', '2026-06-01')], 'p1');
    expect(trendPoints(two[0]!)).toEqual([]);
    expect(MIN_TREND_POINTS).toBe(3);
  });

  it('plots oldest first, so the line reads left to right in time', () => {
    const series = seriesFor(
      [
        r('c', 'creatinine', '2.1', '2026-09-01'),
        r('a', 'creatinine', '1.2', '2026-03-01'),
        r('b', 'creatinine', '1.6', '2026-06-01'),
      ],
      'p1',
    );
    expect(trendPoints(series[0]!).map((p) => p.value)).toEqual([1.2, 1.6, 2.1]);
  });

  it('reads a number out of a qualified result and skips one with none', () => {
    const series = seriesFor(
      [
        r('a', 'hbsag', '<0.5', '2026-03-01'),
        r('b', 'hbsag', 'Not detected', '2026-06-01'),
        r('c', 'hbsag', '0.9', '2026-09-01'),
      ],
      'p1',
    );
    // "Not detected" is a result and stays in the table; it is simply not a
    // point on a line. Two plottable points, so no trend.
    expect(series[0]!.results).toHaveLength(3);
    expect(trendPoints(series[0]!)).toEqual([]);
  });

  it('draws a flat series through the middle rather than dividing by zero', () => {
    const points = [
      { takenOn: '2026-01-01', value: 5 },
      { takenOn: '2026-02-01', value: 5 },
      { takenOn: '2026-03-01', value: 5 },
    ];
    const path = sparkline(points, 120, 28);
    expect(path).toBe('M0.0,14.0 L60.0,14.0 L120.0,14.0');
  });

  it('rises on the screen when the value rises', () => {
    // SVG y grows downward, so a rising series must produce DECREASING y.
    const path = sparkline(
      [
        { takenOn: '2026-01-01', value: 1 },
        { takenOn: '2026-02-01', value: 2 },
        { takenOn: '2026-03-01', value: 3 },
      ],
      120,
      28,
    );
    const ys = [...path.matchAll(/,([\d.]+)/g)].map((m) => Number(m[1]));
    // Strictly decreasing, and inset by half a stroke at each end so the
    // viewBox does not clip the line where it peaks.
    expect(ys[0]! > ys[1]! && ys[1]! > ys[2]!).toBe(true);
    expect(ys[0]).toBeCloseTo(27.3, 1);
    expect(ys[2]).toBeCloseTo(0.8, 1);
  });

  it('says nothing about any value being abnormal', () => {
    // There is no reference range in this module and no function that takes
    // one. A flag is what the laboratory printed; a result with none renders
    // with none, which is not the same as "normal".
    const series = seriesFor([r('a', 'creatinine', '9.9', '2026-09-01')], 'p1');
    expect(series[0]!.results[0]!.flag).toBeUndefined();
  });
});

describe('storage', () => {
  it('keeps results out of the patient’s way and takes them when the patient goes', async () => {
    const database = await db.db();
    await database.clear('labResults');
    await db.savePatient({
      id: 'pZ',
      name: 'Test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await db.saveLabResult(r('z1', 'creatinine', '1.2', '2026-03-01', 'pZ'));
    expect(await db.labResultsFor('pZ')).toHaveLength(1);

    await db.deletePatient('pZ');
    // A result keyed by a patient id that no longer exists belongs to nobody.
    expect(await db.labResultsFor('pZ')).toHaveLength(0);
  });

  it('moves results across when two records for one person are merged', async () => {
    const database = await db.db();
    await database.clear('labResults');
    const now = '2026-01-01T00:00:00.000Z';
    await db.savePatient({ id: 'src', name: 'A', createdAt: now, updatedAt: now });
    await db.savePatient({ id: 'dst', name: 'A', createdAt: now, updatedAt: now });
    await db.saveLabResult(r('m1', 'creatinine', '1.2', '2026-03-01', 'src'));

    await db.mergePatients('src', 'dst');
    expect(await db.labResultsFor('dst')).toHaveLength(1);
    expect(await db.labResultsFor('src')).toHaveLength(0);
  });
});
