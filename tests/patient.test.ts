/**
 * Patient identity — the suite that exists because of a real bug.
 *
 * The old key was `reference || name`, so two children called "Ali Khan" were
 * one patient and their growth points landed in one series, producing a chart
 * that reads as faltering. These tests pin the fix and, just as importantly,
 * pin the refusal to migrate the corrupt legacy data automatically.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { PatientRecord } from '@domain/patient.ts';
import { looksDuplicate, normaliseName, patientLabel, rankCandidates } from '@domain/patient.ts';
import type { GrowthPoint, Prescription } from '@domain/prescription.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';

let n = 0;
const uid = () => `p${++n}`;

const patient = (over: Partial<PatientRecord> = {}): PatientRecord => ({
  id: uid(),
  name: 'Ali Khan',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const point = (id: string, ageDays: number, value: number): GrowthPoint => ({
  id,
  date: '2026-08-01',
  ageDays,
  sex: 'M',
  measure: 'weight',
  value,
  unit: 'kg',
});

beforeEach(async () => {
  const database = await db.db();
  for (const store of ['patients', 'growthSeries', 'growth', 'prescriptions'] as const) {
    await database.clear(store);
  }
});

describe('the bug: two children, one name', () => {
  it('gives namesakes distinct identities', async () => {
    const a = patient({ name: 'Ali Khan', dob: '2021-03-02', sex: 'M' });
    const b = patient({ name: 'Ali Khan', dob: '2023-11-19', sex: 'M' });
    await db.savePatient(a);
    await db.savePatient(b);

    expect(a.id).not.toBe(b.id);
    expect((await db.allPatients()).length).toBe(2);

    // and their growth stays apart
    await db.saveGrowthSeries(a.id, [point('g1', 1000, 14)]);
    await db.saveGrowthSeries(b.id, [point('g2', 300, 7)]);
    expect(await db.loadGrowthSeries(a.id, true)).toHaveLength(1);
    expect((await db.loadGrowthSeries(a.id, true))[0]!.value).toBe(14);
    expect((await db.loadGrowthSeries(b.id, true))[0]!.value).toBe(7);
  });

  it('still refuses to load a series without explicit confirmation', async () => {
    const a = patient();
    await db.savePatient(a);
    await expect(db.loadGrowthSeries(a.id, false)).rejects.toThrow(/explicit doctor confirmation/);
  });
});

describe('matching is offered, never decided', () => {
  const roster = [
    patient({ name: 'Ali Khan', dob: '2021-03-02', sex: 'M', fileNo: 'A-11' }),
    patient({ name: 'Ali Khan', dob: '2023-11-19', sex: 'M' }),
    patient({ name: 'Ayesha Khan', dob: '2021-03-02', sex: 'F', phone: '0300 1234567' }),
  ];

  it('ranks a file number above a name', () => {
    const hits = rankCandidates({ name: 'Ali Khan', fileNo: 'A-11' }, roster);
    expect(hits[0]!.patient.fileNo).toBe('A-11');
    expect(hits[0]!.reasons).toContain('same file number');
  });

  it('returns BOTH namesakes rather than choosing one', () => {
    const hits = rankCandidates({ name: 'Ali Khan' }, roster);
    expect(hits.filter((h) => h.patient.name === 'Ali Khan')).toHaveLength(2);
  });

  it('lets a date of birth break the tie, and says so', () => {
    const hits = rankCandidates({ name: 'Ali Khan', dob: '2023-11-19' }, roster);
    expect(hits[0]!.patient.dob).toBe('2023-11-19');
    expect(hits[0]!.reasons).toContain('same date of birth');
  });

  it('penalises a conflicting sex', () => {
    const hits = rankCandidates({ name: 'Ayesha Khan', sex: 'M' }, roster);
    const ayesha = hits.find((h) => h.patient.name === 'Ayesha Khan');
    expect(ayesha === undefined || ayesha.reasons.includes('different sex')).toBe(true);
  });

  it('matches a phone number regardless of formatting', () => {
    const hits = rankCandidates({ phone: '03001234567' }, roster);
    expect(hits[0]!.patient.name).toBe('Ayesha Khan');
  });

  it('normalises a name only for comparison', () => {
    expect(normaliseName('  Ali   Khan ')).toBe('ali khan');
    expect(normaliseName("Ali'Khan")).toBe('alikhan');
  });

  it('shows what distinguishes a namesake in the label', () => {
    expect(patientLabel(roster[0]!)).toContain('#A-11');
    expect(patientLabel(roster[1]!)).toContain('2023-11-19');
  });
});

describe('duplicate detection offers, it does not act', () => {
  it('needs more than a shared name', () => {
    const a = patient({ name: 'Ali Khan', dob: '2021-03-02' });
    const b = patient({ name: 'Ali Khan', dob: '2023-11-19' });
    expect(looksDuplicate(a, b)).toBe(false);
  });

  it('flags a genuine duplicate', () => {
    const a = patient({ name: 'Ali Khan', dob: '2021-03-02' });
    const b = patient({ name: 'ali  khan', dob: '2021-03-02' });
    expect(looksDuplicate(a, b)).toBe(true);
  });

  it('never flags a record against itself', () => {
    const a = patient({ name: 'Ali Khan', dob: '2021-03-02' });
    expect(looksDuplicate(a, a)).toBe(false);
  });
});

describe('merging', () => {
  it('moves prescriptions and growth, then removes the source', async () => {
    const keep = patient({ name: 'Ali Khan' });
    const dupe = patient({ name: 'Ali Khan' });
    await db.savePatient(keep);
    await db.savePatient(dupe);

    const rx: Prescription = { ...emptyPrescription('paediatrics', 'rx1'), patientId: dupe.id };
    await db.savePrescription(rx);
    await db.saveGrowthSeries(keep.id, [point('g1', 100, 5)]);
    await db.saveGrowthSeries(dupe.id, [point('g2', 200, 6)]);

    await db.mergePatients(dupe.id, keep.id);

    expect(await db.getPatient(dupe.id)).toBeUndefined();
    expect((await db.patientHistory(keep.id)).map((r) => r.id)).toEqual(['rx1']);
    const points = await db.loadGrowthSeries(keep.id, true);
    expect(points.map((p) => p.id).sort()).toEqual(['g1', 'g2']);
    expect(await db.loadGrowthSeries(dupe.id, true)).toEqual([]);
  });
});

describe('legacy growth is surfaced, never guessed', () => {
  const seedLegacy = async (key: string, name: string, pts: GrowthPoint[]) => {
    const database = await db.db();
    await database.put('growth', {
      patientKey: key,
      patientName: name,
      points: pts,
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
  };

  it('is left untouched by the upgrade and reported as unlinked', async () => {
    await seedLegacy('ali khan', 'Ali Khan', [point('g1', 100, 5), point('g2', 400, 9)]);
    const legacy = await db.legacyGrowthSeries();
    expect(legacy).toHaveLength(1);
    expect(legacy[0]!.pointCount).toBe(2);
    // key equals the folded name, so this is the collision-prone case
    expect(legacy[0]!.nameDerived).toBe(true);
  });

  it('marks a file-number key as the safer case', async () => {
    await seedLegacy('A-11', 'Ali Khan', [point('g1', 100, 5)]);
    expect((await db.legacyGrowthSeries())[0]!.nameDerived).toBe(false);
  });

  it('refuses to link without explicit confirmation', async () => {
    await seedLegacy('ali khan', 'Ali Khan', [point('g1', 100, 5)]);
    const target = patient();
    await db.savePatient(target);
    await expect(db.linkLegacyGrowth('ali khan', target.id, ['g1'], false)).rejects.toThrow(
      /explicit confirmation/,
    );
  });

  it('lets a merged two-child series be split by hand, leaving the rest behind', async () => {
    // The exact scenario the old key created: one series, two children.
    await seedLegacy('ali khan', 'Ali Khan', [
      point('elder-1', 1200, 16),
      point('elder-2', 1400, 17),
      point('younger-1', 300, 6),
    ]);
    const elder = patient({ name: 'Ali Khan', dob: '2021-03-02' });
    await db.savePatient(elder);

    await db.linkLegacyGrowth('ali khan', elder.id, ['elder-1', 'elder-2'], true);

    expect((await db.loadGrowthSeries(elder.id, true)).map((p) => p.id)).toEqual([
      'elder-1',
      'elder-2',
    ]);
    // the unclaimed point survives for a second pass rather than being destroyed
    const remaining = await db.legacyGrowthSeries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.pointCount).toBe(1);
    expect((await db.legacyGrowthPoints('ali khan')).map((p) => p.id)).toEqual(['younger-1']);
  });

  it('removes the legacy row once every point has been claimed', async () => {
    await seedLegacy('ali khan', 'Ali Khan', [point('g1', 100, 5)]);
    const target = patient();
    await db.savePatient(target);
    await db.linkLegacyGrowth('ali khan', target.id, ['g1'], true);
    expect(await db.legacyGrowthSeries()).toEqual([]);
  });
});
