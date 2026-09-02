/**
 * Practice analytics (Home) -- domain/analytics.ts's pure bucketing/ranking,
 * plus the two storage/db.ts read paths that feed them. Read-only,
 * backward-looking, zero network (PRODUCT.md's analytics addendum).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { monthlyVolume, rankDiagnoses } from '@domain/analytics.ts';
import * as db from '@storage/db.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import { paediatrics } from '@data/packs/index.ts';

let n = 0;
const uid = () => `arx${++n}`;

describe('monthlyVolume', () => {
  it('returns nothing for an empty list', () => {
    expect(monthlyVolume([])).toEqual([]);
  });

  it('buckets by the first 7 characters of date', () => {
    const out = monthlyVolume([
      { date: '2026-08-01' },
      { date: '2026-08-15' },
      { date: '2026-08-28' },
    ]);
    expect(out).toEqual([{ month: '2026-08', count: 3 }]);
  });

  it('sorts months ascending, including across a year boundary', () => {
    const out = monthlyVolume([
      { date: '2026-01-05' },
      { date: '2025-12-20' },
      { date: '2026-02-01' },
    ]);
    expect(out.map((m) => m.month)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('a single month stays a single bucket', () => {
    expect(monthlyVolume([{ date: '2026-08-01' }])).toEqual([{ month: '2026-08', count: 1 }]);
  });
});

describe('rankDiagnoses', () => {
  it('sorts by count descending', () => {
    const out = rankDiagnoses([
      { text: 'a', count: 2 },
      { text: 'b', count: 9 },
      { text: 'c', count: 5 },
    ]);
    expect(out.map((d) => d.text)).toEqual(['b', 'c', 'a']);
  });

  it('respects the limit', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ text: `dx${i}`, count: i }));
    expect(rankDiagnoses(rows, 3)).toHaveLength(3);
  });

  it('returns an empty list for empty input', () => {
    expect(rankDiagnoses([])).toEqual([]);
  });

  it('does NOT fuzzy-merge near-duplicate phrasings, even at equal counts', () => {
    // Diagnosis is free text (PRODUCT.md) -- a closed-looking tally would
    // misrepresent it as coded data. This asserts the caveat holds, rather
    // than silently "fixing" it into a merge later.
    const out = rankDiagnoses([
      { text: 'URTI', count: 4 },
      { text: 'Upper respiratory tract infection', count: 4 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.text).sort()).toEqual(
      ['URTI', 'Upper respiratory tract infection'].sort(),
    );
  });
});

describe('storage: monthlyVolumeSnapshot', () => {
  beforeEach(async () => {
    const existing = await db.monthlyVolumeSnapshot();
    for (const rx of existing) await db.deletePrescription(rx.id);
  });

  it('feeds monthlyVolume from every saved prescription', async () => {
    const a = emptyPrescription(paediatrics.id, uid());
    a.date = '2026-06-10';
    const b = emptyPrescription(paediatrics.id, uid());
    b.date = '2026-06-20';
    await db.savePrescription(a);
    await db.savePrescription(b);

    const snapshot = await db.monthlyVolumeSnapshot();
    const out = monthlyVolume(snapshot);
    expect(out.find((m) => m.month === '2026-06')?.count).toBe(2);
  });

  it('routes every record through normalisePrescription', async () => {
    const rx = emptyPrescription(paediatrics.id, uid());
    const stripped = { ...rx } as Partial<typeof rx>;
    delete stripped.calculations;
    await db.savePrescription(stripped as typeof rx);
    const found = (await db.monthlyVolumeSnapshot()).find((r) => r.id === rx.id);
    expect(found?.calculations).toEqual([]);
  });
});

describe('storage: topDiagnoses', () => {
  it('reads the indexed `learned` store, not a prescriptions scan', async () => {
    // Seed ONLY the learned store -- no prescription exists with this text at
    // all -- so a result here can only have come from the indexed read this
    // function documents, not a scan of the prescriptions store.
    await db.learn('diagnosis', 'Isolated learned-only diagnosis');
    const rows = await db.topDiagnoses(20);
    expect(rows.some((r) => r.text === 'Isolated learned-only diagnosis')).toBe(true);
  });

  it('ranks by frequency', async () => {
    for (let i = 0; i < 3; i++) await db.learn('diagnosis', 'Frequent diagnosis case');
    await db.learn('diagnosis', 'Rare diagnosis case');
    const top = (await db.topDiagnoses(50)).find((r) => r.text === 'Frequent diagnosis case');
    expect(top?.count).toBeGreaterThanOrEqual(3);
  });

  it('never returns a row from another field', async () => {
    await db.learn('drug', 'Amoxil');
    const rows = await db.topDiagnoses(50);
    expect(rows.every((r) => r.field === 'diagnosis')).toBe(true);
  });
});
