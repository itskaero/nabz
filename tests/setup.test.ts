/**
 * The setup checklist.
 *
 * Two properties worth holding hard. First, that a blocking step cannot be
 * satisfied by nothing: a name made of spaces prints a blank line at the top
 * of a script exactly as an empty one does. Second, that the list matches the
 * machine -- a front desk that writes no prescriptions is never asked for a
 * registration number, and the doctor's device is never told its records are
 * someone else's problem.
 */
import { describe, expect, it } from 'vitest';
import type { SetupFacts, SetupStep } from '@domain/setup.ts';
import { outstanding, setupComplete, setupSteps } from '@domain/setup.ts';

const ready: SetupFacts = {
  deviceRole: 'consulting',
  hasRecords: false,
  doctorName: 'Dr A. Tahir',
  registrationNumber: '12345-P',
  packId: 'paediatrics',
  lastBackupAt: '2026-09-01T10:00:00.000Z',
  clinicMode: false,
  pairedCode: null,
  canEncrypt: true,
  cryptoProblem: null,
};

const ids = (steps: SetupStep[]) => steps.map((s) => s.id);
const step = (facts: Partial<SetupFacts>, id: string) =>
  setupSteps({ ...ready, ...facts }).find((s) => s.id === id);

describe('a device that is ready', () => {
  it('has nothing outstanding', () => {
    expect(outstanding(setupSteps(ready))).toEqual([]);
    expect(setupComplete(setupSteps(ready))).toBe(true);
  });

  it('still lists what is already done, rather than only the problems', () => {
    // A checklist that shows only failures reads as a list of failures, and
    // says nothing about the parts a doctor no longer has to think about.
    expect(ids(setupSteps(ready))).toEqual([
      'device-role',
      'doctor-identity',
      'content-pack',
      'first-backup',
    ]);
  });

  it('keeps that order however much is done', () => {
    // A list that rearranges itself as you tick it off is a list you have to
    // re-read every time you look at it.
    const fresh = setupSteps({ ...ready, deviceRole: null, doctorName: '', lastBackupAt: undefined });
    expect(ids(fresh)).toEqual(ids(setupSteps(ready)));
  });
});

describe('a blocking step cannot be satisfied by nothing', () => {
  it('refuses a name made of spaces', () => {
    // It prints a blank line at the top of a script exactly as an empty one
    // does, and the doctor would have been told they were finished.
    expect(step({ doctorName: '   ' }, 'doctor-identity')?.done).toBe(false);
    expect(step({ registrationNumber: '\t\n' }, 'doctor-identity')?.done).toBe(false);
  });

  it('wants both halves, not either', () => {
    expect(step({ registrationNumber: '' }, 'doctor-identity')?.done).toBe(false);
    expect(step({ doctorName: '' }, 'doctor-identity')?.done).toBe(false);
  });

  it('holds the app back until the blocking ones are answered', () => {
    expect(setupComplete(setupSteps({ ...ready, deviceRole: null }))).toBe(false);
    expect(setupComplete(setupSteps({ ...ready, doctorName: '' }))).toBe(false);
  });

  it('takes the records as the answer on a device that predates the question', () => {
    // Every install predates this setting. Sending a doctor who has been
    // prescribing for a year to a checklist demanding to know whose computer
    // this is would be noise, and the records already said.
    const upgraded = { ...ready, deviceRole: null, hasRecords: true };
    expect(step(upgraded, 'device-role')?.done).toBe(true);
    expect(setupComplete(setupSteps(upgraded))).toBe(true);
  });
});

describe('the backup never blocks, and never goes quiet', () => {
  it('is outstanding until a backup has been WRITTEN', () => {
    // Not until a password has been typed: a password that never produced a
    // file has protected nothing.
    const s = step({ lastBackupAt: undefined }, 'first-backup');
    expect(s?.done).toBe(false);
    expect(s?.severity).toBe('attention');
  });

  it('does not stand between a doctor and a prescription', () => {
    expect(setupComplete(setupSteps({ ...ready, lastBackupAt: undefined }))).toBe(true);
  });
});

describe('the front desk', () => {
  const desk = { ...ready, deviceRole: 'reception' as const, clinicMode: true, pairedCode: 'x' };

  it('is never asked for a registration number it has no use for', () => {
    expect(ids(setupSteps(desk))).not.toContain('doctor-identity');
    expect(ids(setupSteps(desk))).not.toContain('content-pack');
  });

  it('is not told its records are the only copy, because they are not', () => {
    expect(ids(setupSteps(desk))).not.toContain('first-backup');
  });

  it('cannot start without the station, because there is nothing else there', () => {
    expect(step(desk, 'clinic-pairing')?.severity).toBe('blocking');
    expect(setupComplete(setupSteps({ ...desk, pairedCode: null }))).toBe(false);
  });
});

describe('the clinic station, from the doctor’s side', () => {
  it('is not mentioned at all when the queue is off', () => {
    expect(ids(setupSteps(ready))).not.toContain('clinic-pairing');
  });

  it('is a gap, not a barrier', () => {
    // An unpaired queue costs today's waiting list. It does not cost the
    // consultation, so it must not cost the app.
    const facts = { ...ready, clinicMode: true, pairedCode: null };
    expect(step(facts, 'clinic-pairing')?.severity).toBe('attention');
    expect(setupComplete(setupSteps(facts))).toBe(true);
  });
});

describe('a device that cannot encrypt', () => {
  const broken = {
    ...ready,
    canEncrypt: false,
    cryptoProblem: 'This page was opened over a plain connection, so …',
  };

  it('says nothing at all when everything works', () => {
    // A permanently green "your browser supports cryptography" row is how
    // people learn to stop reading checklists.
    expect(ids(setupSteps(ready))).not.toContain('encryption');
  });

  it('quotes the sentence the product already has, rather than a second one', () => {
    expect(step(broken, 'encryption')?.why).toBe(broken.cryptoProblem);
  });

  it('is loud without being a barrier, because the fix is not on this screen', () => {
    // The fix is opening a different address. Refusing to run would leave a
    // doctor with neither the app nor a way to change how they opened it.
    expect(step(broken, 'encryption')?.severity).toBe('attention');
    expect(setupComplete(setupSteps(broken))).toBe(true);
  });
});
