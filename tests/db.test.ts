/**
 * Storage-layer suite: the migration/normalisation seam and the pack library
 * (Stage A). Both exist because reading a record raw, or a single global
 * "current pack" slot, are exactly the shapes that stopped being true once a
 * second pack and a second optional field showed up.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import * as db from '@storage/db.ts';
import type { InstalledPack } from '@storage/db.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import { paediatrics, medicine } from '@data/packs/index.ts';
import { packs as shippedPhrases } from '@data/phrases/index.ts';

let n = 0;
const uid = () => `rx${++n}`;

describe('normalisePrescription', () => {
  it('adds labs and calculations to a record stored before either field existed', () => {
    const legacy = emptyPrescription(paediatrics.id, uid());
    // Simulate a record written by an older build: strip the fields it never had.
    const stripped = { ...legacy } as Partial<typeof legacy>;
    delete stripped.labs;
    delete stripped.calculations;
    const normalised = db.normalisePrescription(stripped as typeof legacy);
    expect(normalised.labs).toEqual([]);
    expect(normalised.calculations).toEqual([]);
  });

  it('leaves an already-populated record untouched', () => {
    const rx = emptyPrescription(paediatrics.id, uid());
    rx.calculations = [
      {
        id: 'c1',
        moduleId: 'gfr',
        label: 'eGFR (CKD-EPI 2021)',
        value: 73,
        unit: 'mL/min/1.73m2',
        method: 'CKD-EPI 2021 (race-free, creatinine)',
        inputs: { age: '40', sex: 'F', creatinine: '1.0' },
        computedAt: new Date().toISOString(),
      },
    ];
    expect(db.normalisePrescription(rx).calculations).toEqual(rx.calculations);
  });

  it('applies on every read path', async () => {
    const rx = emptyPrescription(paediatrics.id, uid());
    const stripped = { ...rx } as Partial<typeof rx>;
    delete stripped.labs;
    await db.savePrescription(stripped as typeof rx);

    expect((await db.getPrescription(rx.id))!.labs).toEqual([]);
    expect((await db.recentPrescriptions(50)).find((r) => r.id === rx.id)!.labs).toEqual([]);
  });
});

describe('the pack library', () => {
  const entry = (id: string): InstalledPack => ({
    id,
    pack: id === medicine.id ? medicine : paediatrics,
    phrases: shippedPhrases,
    source: 'shipped',
    verified: id === medicine.id ? false : true,
    edited: false,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(async () => {
    for (const id of [paediatrics.id, medicine.id]) await db.deleteInstalledPack(id);
  });

  it('round-trips an installed pack', async () => {
    await db.putInstalledPack(entry(medicine.id));
    const back = await db.getInstalledPack(medicine.id);
    expect(back?.id).toBe(medicine.id);
    expect(back?.verified).toBe(false);
  });

  it('lists every installed pack', async () => {
    await db.putInstalledPack(entry(paediatrics.id));
    await db.putInstalledPack(entry(medicine.id));
    const ids = (await db.listInstalledPacks()).map((p) => p.id).sort();
    expect(ids).toEqual([medicine.id, paediatrics.id].sort());
  });

  it('deletes one pack without touching another', async () => {
    await db.putInstalledPack(entry(paediatrics.id));
    await db.putInstalledPack(entry(medicine.id));
    await db.deleteInstalledPack(medicine.id);
    expect(await db.getInstalledPack(medicine.id)).toBeUndefined();
    expect(await db.getInstalledPack(paediatrics.id)).toBeDefined();
  });
});
