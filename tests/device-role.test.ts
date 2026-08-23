/**
 * What this machine is for.
 *
 * The README has always claimed the receptionist cannot read clinical content
 * "because it is not on their machine". Until now that was true only while
 * nobody happened to write a script there — a PIN over the clinical views, and
 * `roles.ts` says plainly that a PIN in a browser is a curiosity gate.
 *
 * These tests are about the difference between hiding something and it not
 * being there.
 *
 * The role lives in localStorage, which neither the node environment nor this
 * jsdom build provides usably -- jsdom hands back an empty object with no
 * methods. Without a real one the module's try/catch swallows every write and
 * returns null, and every assertion below would pass while testing nothing.
 * `tests/setup.ts` installs a minimal Storage for the whole suite; the subject
 * here is the role logic, not the browser's storage implementation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  clearDeviceRole,
  deviceAllows,
  deviceRole,
  isReceptionDevice,
  ReceptionDeviceError,
  setDeviceRole,
} from '@domain/deviceRole.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';

beforeEach(() => clearDeviceRole());
afterEach(() => clearDeviceRole());

describe('choosing', () => {
  it('starts unchosen, which is what triggers the first-run picker', () => {
    expect(deviceRole()).toBeNull();
  });

  it('remembers the choice', () => {
    setDeviceRole('reception');
    expect(deviceRole()).toBe('reception');
    setDeviceRole('consulting');
    expect(deviceRole()).toBe('consulting');
  });

  it('ignores a value it did not write', () => {
    localStorage.setItem('nabz.deviceRole', 'administrator');
    expect(deviceRole()).toBeNull();
  });

  it('treats an unclassified device as consulting', () => {
    // The permissive default is safe in this direction only: every install that
    // predates the setting must keep working, and the failure mode is "the
    // doctor sees their own records" rather than "the receptionist sees
    // someone else's". The strict default would hide a doctor's whole history
    // behind a setting they never knew existed.
    expect(isReceptionDevice()).toBe(false);
    expect(deviceAllows('write')).toBe(true);
    expect(deviceAllows('history')).toBe(true);
  });
});

describe('a reception station', () => {
  beforeEach(() => setDeviceRole('reception'));

  it('reaches the queue and settings, and nothing clinical', () => {
    expect(deviceAllows('clinic')).toBe(true);
    expect(deviceAllows('settings')).toBe(true);

    for (const view of ['write', 'preview', 'history', 'growth', 'builder']) {
      expect(deviceAllows(view)).toBe(false);
    }
  });

  it('REFUSES to store a prescription', async () => {
    // The line that turns the README's claim into a property of the system.
    const rx = emptyPrescription('paediatrics', 'rx1');
    await expect(db.savePrescription(rx)).rejects.toThrow(ReceptionDeviceError);
  });

  it('says why, in words a receptionist can act on', async () => {
    const rx = emptyPrescription('paediatrics', 'rx2');
    await expect(db.savePrescription(rx)).rejects.toThrow(/reception station/i);
    await expect(db.savePrescription(rx)).rejects.toThrow(/doctor/i);
  });

  it('leaves nothing behind when it refuses', async () => {
    const before = await db.prescriptionCount();
    await expect(
      db.savePrescription(emptyPrescription('paediatrics', 'rx3')),
    ).rejects.toThrow();
    expect(await db.prescriptionCount()).toBe(before);
  });

  it('still lets the queue work — that is the receptionist’s job', async () => {
    await db.saveQueueEntry({
      id: 'q1',
      date: '2026-08-23',
      token: 1,
      name: 'Ayesha Khan',
      status: 'waiting',
      payment: 'unpaid',
      createdAt: '2026-08-23T09:00:00.000Z',
      updatedAt: '2026-08-23T09:00:00.000Z',
    });
    expect(await db.queueForDate('2026-08-23')).toHaveLength(1);
  });
});

describe('a consulting device', () => {
  beforeEach(() => setDeviceRole('consulting'));

  it('reaches everything', () => {
    for (const view of ['write', 'preview', 'history', 'growth', 'builder', 'clinic', 'settings']) {
      expect(deviceAllows(view)).toBe(true);
    }
  });

  it('stores prescriptions normally', async () => {
    const rx = emptyPrescription('paediatrics', 'rx-ok');
    await db.savePrescription(rx);
    expect(await db.getPrescription('rx-ok')).toBeDefined();
  });
});

describe('switching a device that already holds records', () => {
  it('does not delete them — they are unreachable, not gone', async () => {
    setDeviceRole('consulting');
    await db.savePrescription(emptyPrescription('paediatrics', 'kept'));

    // Someone re-purposes the doctor's laptop as the front desk.
    setDeviceRole('reception');
    await expect(
      db.savePrescription(emptyPrescription('paediatrics', 'new')),
    ).rejects.toThrow(ReceptionDeviceError);

    // Switching back must find the record intact. Destroying data on a settings
    // change would be a far worse failure than hiding it.
    setDeviceRole('consulting');
    expect(await db.getPrescription('kept')).toBeDefined();
  });
});
