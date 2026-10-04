/**
 * The chart is a projection, so these are tests about arranging -- and about
 * the two things it must never do: show one patient's encounter in another
 * patient's chart, and draw a conclusion.
 */
import { describe, expect, it } from 'vitest';
import { allergyDisagreements, buildChart, courseCount } from '@domain/chart.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import type { MedicationLine, Prescription } from '@domain/prescription.ts';

function med(
  id: string,
  drug: { brand?: string; generic?: string; strength?: string; raw?: string },
  duration?: number,
): MedicationLine {
  return {
    id,
    drug,
    sig: {
      templateId: 't',
      dose: { value: 5, unit: 'ml' },
      frequency: 'TID',
      ...(duration ? { duration: { value: duration, unit: 'day' } } : {}),
    },
  };
}

function encounter(
  id: string,
  date: string,
  patch: Partial<Prescription> = {},
): Prescription {
  return { ...emptyPrescription('paediatrics', id), date, ...patch };
}

describe('whose chart this is', () => {
  it('never shows an encounter that belongs to someone else', () => {
    const chart = buildChart('p1', [
      encounter('a', '2026-09-01', { patientId: 'p1' }),
      encounter('b', '2026-09-02', { patientId: 'p2' }),
    ]);
    expect(chart.visits.map((v) => v.id)).toEqual(['a']);
  });

  it('never shows an unlinked walk-in in anyone’s chart', () => {
    // No patientId at all. A script written for a walk-in belongs to nobody
    // until a human links it, and silently attaching it to the chart that
    // happens to be open is how the wrong chart gets written on.
    const chart = buildChart('p1', [encounter('a', '2026-09-01')]);
    expect(chart.visits).toHaveLength(0);
    expect(chart.firstSeen).toBeUndefined();
  });
});

describe('the visit timeline', () => {
  const chart = buildChart('p1', [
    encounter('a', '2026-03-04', { patientId: 'p1', diagnosis: ['Bronchiolitis'] }),
    encounter('b', '2026-09-20', { patientId: 'p1', diagnosis: ['Acute gastroenteritis'] }),
    encounter('c', '2026-06-11', { patientId: 'p1', diagnosis: [] }),
  ]);

  it('reads newest first', () => {
    expect(chart.visits.map((v) => v.date)).toEqual(['2026-09-20', '2026-06-11', '2026-03-04']);
  });

  it('knows the span without inventing one', () => {
    expect(chart.firstSeen).toBe('2026-03-04');
    expect(chart.lastSeen).toBe('2026-09-20');
  });

  it('lists the diagnoses that were recorded, and no others', () => {
    expect(chart.diagnoses).toEqual(['Acute gastroenteritis', 'Bronchiolitis']);
  });
});

describe('medications across encounters', () => {
  const chart = buildChart('p1', [
    encounter('a', '2026-01-10', {
      patientId: 'p1',
      medications: [med('m1', { brand: 'Amoxil', generic: 'amoxicillin', strength: '125mg/5ml' }, 5)],
    }),
    encounter('b', '2026-04-02', {
      patientId: 'p1',
      medications: [
        med('m2', { brand: 'Moxiclav', generic: 'amoxicillin', strength: '228mg/5ml' }, 7),
        med('m3', { generic: 'paracetamol' }, 3),
      ],
    }),
  ]);

  it('groups by generic, so two brands of one drug are one row', () => {
    const amox = chart.medications.find((m) => m.key === 'amoxicillin');
    expect(courseCount(amox!)).toBe(2);
    expect(amox!.brands.sort()).toEqual(['Amoxil', 'Moxiclav']);
  });

  it('keeps the duration, which is the question being asked', () => {
    const amox = chart.medications.find((m) => m.key === 'amoxicillin');
    expect(amox!.courses.map((c) => c.duration?.value)).toEqual([7, 5]);
  });

  it('falls back to what was typed when there is no generic', () => {
    const chart2 = buildChart('p1', [
      encounter('a', '2026-01-10', { patientId: 'p1', medications: [med('m1', { raw: 'Cofcol syrup' })] }),
    ]);
    expect(chart2.medications[0]?.label).toBe('Cofcol syrup');
  });

  it('puts the most recently prescribed drug first', () => {
    expect(chart.medications[0]?.key).toBe('amoxicillin');
  });

  it('counts courses without saying anything about them', () => {
    // The type has no "concern", "flag" or "pattern" field, and this is the
    // test that keeps it that way: four courses is a number, not a verdict.
    const amox = chart.medications.find((m) => m.key === 'amoxicillin')!;
    expect(Object.keys(amox).sort()).toEqual(['brands', 'courses', 'key', 'label']);
  });
});

describe('allergy snapshots that disagree', () => {
  it('stays quiet when every visit said the same thing', () => {
    const chart = buildChart('p1', [
      encounter('a', '2026-01-10', { patientId: 'p1', patient: { name: 'A', allergies: 'penicillin' } }),
      encounter('b', '2026-04-02', { patientId: 'p1', patient: { name: 'A', allergies: 'penicillin' } }),
    ]);
    expect(allergyDisagreements(chart)).toEqual([]);
  });

  it('surfaces it when they do not — which is the whole reason for the list', () => {
    const chart = buildChart('p1', [
      encounter('a', '2026-01-10', { patientId: 'p1', patient: { name: 'A', allergies: 'penicillin' } }),
      encounter('b', '2026-04-02', { patientId: 'p1', patient: { name: 'A', allergies: 'none known' } }),
    ]);
    expect(allergyDisagreements(chart)).toEqual(['none known', 'penicillin']);
  });
});
