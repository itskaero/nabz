/**
 * What a restore actually gives back.
 *
 * THE HOLE THIS FILE EXISTS TO CLOSE
 * ----------------------------------
 * `collectBackup` read four stores: prescriptions, the legacy growth store,
 * learned terms and the profile. `patients` and `growthSeries` have existed
 * since schema v3 and were in neither. So a doctor who restored a backup got
 * their prescriptions back with every patient identity gone and every modern
 * growth series gone, and the restored prescriptions' `patientId` fields
 * pointing at records that no longer existed.
 *
 * Nothing failed. Nothing warned. The symptom only appears on the one day
 * somebody needs the restore, which is the day there is no second copy.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { collectBackup, importBackup, exportEncrypted, decryptBackup } from '@storage/backup.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import { emptyClinical } from '@domain/patientClinical.ts';
import * as db from '@storage/db.ts';

const PID = 'p-1';

async function seed(): Promise<void> {
  await db.savePatient({
    id: PID,
    name: 'Ayesha Khan',
    dob: '2023-04-02',
    sex: 'F',
    fileNo: 'A-114',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  });
  await db.savePatientClinical({
    ...emptyClinical(PID, '2026-09-01T09:00:00.000Z'),
    allergies: [{ substance: 'penicillin', severity: 'severe', notedOn: '2026-09-01' }],
    problems: [{ label: 'asthma', status: 'active' }],
    bloodGroup: 'B+',
  });
  await db.saveGrowthSeries(PID, [
    { id: 'g1', date: '2026-09-01', ageDays: 1248, sex: 'F', measure: 'weight', value: 12.4, unit: 'kg' },
  ]);
  const rx = { ...emptyPrescription('paediatrics', 'rx-1'), patientId: PID };
  await db.savePrescription(rx);
}

async function wipe(): Promise<void> {
  const database = await db.db();
  for (const store of ['prescriptions', 'patients', 'patientClinical', 'growthSeries', 'growth', 'learned'] as const) {
    await database.clear(store);
  }
}

describe('a backup carries the whole record', () => {
  beforeEach(async () => {
    await wipe();
    await seed();
  });

  it('includes the patients, which format 1 silently did not', async () => {
    const payload = await collectBackup(false);
    expect(payload.patients?.map((p) => p.id)).toEqual([PID]);
    expect(payload.growthSeries?.map((g) => g.patientId)).toEqual([PID]);
    expect(payload.patientClinical?.map((c) => c.patientId)).toEqual([PID]);
  });

  it('restores a wiped device to something a doctor can work from', async () => {
    const payload = await collectBackup(false);
    await wipe();
    expect(await db.getPatient(PID)).toBeUndefined();

    const summary = await importBackup(payload, 'merge');

    expect(summary.patients).toBe(1);
    expect(summary.patientSeries).toBe(1);
    expect(summary.patientClinical).toBe(1);

    const patient = await db.getPatient(PID);
    expect(patient?.name).toBe('Ayesha Khan');
    // The prescription's patientId now points at a record that exists again --
    // which is the whole reason patients had to come back first.
    const rx = await db.getPrescription('rx-1');
    expect(rx?.patientId).toBe(PID);
    expect(await db.getPatient(rx!.patientId!)).toBeDefined();

    const clinical = await db.getPatientClinical(PID);
    expect(clinical?.allergies.map((a) => a.substance)).toEqual(['penicillin']);
    expect(clinical?.bloodGroup).toBe('B+');
    expect(await db.loadGrowthSeries(PID, true)).toHaveLength(1);
  });

  it('never lets an older file delete an allergy recorded since', async () => {
    const payload = await collectBackup(false);
    // A new allergy is recorded after the backup was taken.
    await db.savePatientClinical({
      ...emptyClinical(PID, '2026-09-10T09:00:00.000Z'),
      allergies: [{ substance: 'sulfa', severity: 'mild', notedOn: '2026-09-10' }],
      problems: [],
    });

    await importBackup(payload, 'merge');

    const after = await db.getPatientClinical(PID);
    expect(after?.allergies.map((a) => a.substance).sort()).toEqual(['penicillin', 'sulfa']);
  });

  it('reads a format-1 file, which has none of these fields', async () => {
    // A restore is not the moment to start refusing a doctor's own backup.
    const payload = await collectBackup(false);
    const old = { ...payload, version: 1 };
    delete old.patients;
    delete old.growthSeries;
    delete old.patientClinical;
    await wipe();

    const summary = await importBackup(old, 'merge');
    expect(summary.prescriptions).toBe(1);
    expect(summary.patients).toBe(0);
  });

  it('round-trips through the encrypted envelope', async () => {
    const blob = await exportEncrypted('a-long-enough-password', false);
    const restored = await decryptBackup(await blob.text(), 'a-long-enough-password');
    expect(restored.patientClinical?.[0]?.allergies[0]?.substance).toBe('penicillin');
  });
});
