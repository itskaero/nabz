/**
 * The arithmetic a child is treated on.
 *
 * It used to be `cited.mgPerKg * rx.patient.weightKg` inline in a component,
 * printing milligrams and nothing else. The thing a parent actually needs --
 * how many millilitres of THIS bottle -- was left for the doctor to do in
 * their head, which is where the mistakes are.
 *
 * Two hazards are tested harder than the happy path, because they are the ones
 * that hurt somebody: a strength read wrong by a factor of a thousand, and a
 * volume offered for a preparation that has no volume.
 */
import { describe, expect, it } from 'vitest';
import type { DosingEntry } from '@domain/pack.ts';
import {
  bandFits,
  doseFor,
  mgPerMl,
  mlText,
  parseConcentration,
  suggestRounded,
  volumeFor,
} from '@domain/dose.ts';
import { formularySeed } from '@data/formulary/seed.ts';
import { medicineFormularySeed } from '@data/formulary/medicine.seed.ts';

const row = (patch: Partial<DosingEntry> = {}): DosingEntry => ({
  generic: 'Paracetamol',
  route: 'oral',
  reference: 'WHO Pocket Book of Hospital Care for Children, 2nd ed.',
  verified: false,
  ...patch,
});

describe('reading a strength', () => {
  it('reads a mass per millilitre', () => {
    expect(parseConcentration('125mg/5ml')).toEqual({
      amount: 125,
      unit: 'mg',
      per: 5,
      perUnit: 'ml',
    });
    expect(parseConcentration('100mg/ml')).toEqual({
      amount: 100,
      unit: 'mg',
      per: 1,
      perUnit: 'ml',
    });
    expect(parseConcentration('125mg/1.25ml')?.per).toBe(1.25);
  });

  /*
    The thousandfold pair.

    A regex that takes the digits before a unit reads `250mcg/ml` as 250 mg/mL
    and `3.35g/5ml` as 3.35 mg/5 mL. Both are a factor of a thousand out, in
    opposite directions, one character from the ordinary case.
  */
  it('keeps micrograms and grams a thousand apart from milligrams', () => {
    expect(mgPerMl(parseConcentration('250mcg/ml')!)).toBeCloseTo(0.25, 10);
    expect(mgPerMl(parseConcentration('250mg/ml')!)).toBe(250);
    expect(mgPerMl(parseConcentration('3.35g/5ml')!)).toBe(670);
  });

  it('refuses everything that is not a mass per millilitre', () => {
    for (const s of [
      '20/120mg', // a combination: two actives, no single strength
      '25/50mcg',
      '100mcg/puff', // not a volume
      '400 IU/drop',
      '100000 units/ml', // activity, not mass
      '2 billion/5ml',
      '0.9%', // a percentage: convertible in principle, never needed here
      '2%',
      '500mg', // a solid
      '1g',
      'WHO formula', // not a strength at all
      'WHO low-osmolarity',
      '1 MU',
      undefined,
      '',
    ]) {
      expect(parseConcentration(s)).toBeUndefined();
    }
  });

  /*
    The hole, listed by name.

    These are the distinct seed strengths that carry no concentration, so no
    millilitre figure will ever be offered for a brand that has one. A NEW
    unreadable shape fails this test, which is the point: it forces somebody to
    decide whether the parser should learn it or the row should state its
    concentration outright, instead of the gap appearing silently as a brand
    that quietly stops offering a volume.
  */
  it('leaves exactly these per-millilitre strengths without a volume', () => {
    // Narrowed to strengths that mention millilitres on purpose. A tablet is
    // `500mg` and nobody expects a volume for it; a bottle that says `/ml` and
    // still cannot give one is the case worth keeping a list of.
    const unreadable = new Set<string>();
    for (const e of [...formularySeed, ...medicineFormularySeed]) {
      if (e.strength && !e.concentration && /ml/i.test(e.strength)) unreadable.add(e.strength);
    }
    expect([...unreadable].sort()).toEqual([
      '100 IU/ml', // international units: activity, not mass
      '100000 units/ml',
      '2 billion/5ml', // colony-forming units
      '200000 IU/ml',
      '5000 IU/ml',
    ]);
  });

  it('gives a concentration to every syrup written as mg per ml', () => {
    const syrups = formularySeed.filter((e) => /^[\d.]+\s*mg\s*\/\s*[\d.]*\s*ml$/i.test(e.strength ?? ''));
    expect(syrups.length).toBeGreaterThan(20);
    expect(syrups.every((e) => e.concentration)).toBe(true);
  });
});

describe('weight to milligrams', () => {
  it('gives a range when the row has one, and a point when it does not', () => {
    const band = doseFor(row({ mgPerKg: 10, mgPerKgHigh: 15 }), { weightKg: 10 });
    expect(band).toEqual({ ok: true, dose: { mgLow: 100, mgHigh: 150 } });

    const point = doseFor(row({ mgPerKg: 40 }), { weightKg: 14 });
    expect(point.ok && point.dose.mgLow).toBe(560);
    expect(point.ok && point.dose.mgHigh).toBe(560);
  });

  it('carries the daily total when the row says how many doses', () => {
    const r = doseFor(row({ mgPerKg: 10, mgPerKgHigh: 15, perDoses: 4 }), { weightKg: 10 });
    expect(r.ok && r.dose.mgPerDayLow).toBe(400);
    expect(r.ok && r.dose.mgPerDayHigh).toBe(600);
  });

  it('refuses rather than guessing when there is no weight', () => {
    expect(doseFor(row({ mgPerKg: 15 }), {})).toEqual({ ok: false, why: 'no-weight' });
    expect(doseFor(row({ mgPerKg: 15 }), { weightKg: 0 })).toEqual({ ok: false, why: 'no-weight' });
  });

  it('refuses a row that is not weight-based, so the fixed text is shown instead', () => {
    expect(doseFor(row({ fixedDose: '500 mg to 1 g every 6 hours' }), { weightKg: 60 })).toEqual({
      ok: false,
      why: 'not-weight-based',
    });
  });
});

describe('the ceilings', () => {
  it('caps a per-dose maximum and says which cap bound it', () => {
    // 15 mg/kg at 60 kg is 900 mg; the stated adult ceiling is 1000 mg, so it
    // does not bind. At 80 kg it would be 1200 mg, and it does.
    const under = doseFor(row({ mgPerKg: 15, maxMgPerDose: 1000 }), { weightKg: 60 });
    expect(under.ok && under.dose.cappedBy).toBeUndefined();

    const over = doseFor(row({ mgPerKg: 15, maxMgPerDose: 1000 }), { weightKg: 80 });
    expect(over.ok && over.dose.mgHigh).toBe(1000);
    expect(over.ok && over.dose.cappedBy).toMatch(/1000 mg maximum per dose/);
  });

  it('spreads a daily ceiling over the doses the row assumes', () => {
    // 15 mg/kg per dose, 4 doses, 30 kg = 450 mg a dose and 1800 mg a day,
    // over a 4 g daily ceiling? No -- 1800 is under. Make the ceiling bind.
    const r = doseFor(row({ mgPerKg: 15, perDoses: 4, maxMgPerDay: 1200 }), { weightKg: 30 });
    expect(r.ok && r.dose.mgHigh).toBe(300);
    expect(r.ok && r.dose.mgPerDayHigh).toBe(1200);
    expect(r.ok && r.dose.cappedBy).toMatch(/1200 mg maximum in 24 hours/);
  });

  it('scales a mg/kg daily ceiling by the weight', () => {
    // Ibuprofen: 10 mg/kg a dose, three doses, 40 mg/kg in 24 hours. Thirty is
    // under forty, so nothing binds; at four doses a day it would.
    const three = doseFor(row({ mgPerKg: 10, perDoses: 3, maxMgPerKgPerDay: 40 }), {
      weightKg: 12,
    });
    expect(three.ok && three.dose.cappedBy).toBeUndefined();

    const five = doseFor(row({ mgPerKg: 10, perDoses: 5, maxMgPerKgPerDay: 40 }), {
      weightKg: 12,
    });
    expect(five.ok && five.dose.mgHigh).toBe(96);
    expect(five.ok && five.dose.cappedBy).toMatch(/40 mg\/kg maximum in 24 hours/);
  });

  it('clamps both ends of a band, so a capped range never prints inside out', () => {
    const r = doseFor(row({ mgPerKg: 10, mgPerKgHigh: 15, maxMgPerDose: 500 }), {
      weightKg: 80,
    });
    expect(r.ok && r.dose.mgLow).toBe(500);
    expect(r.ok && r.dose.mgHigh).toBe(500);
  });
});

describe('milligrams to millilitres', () => {
  it('converts through the concentration', () => {
    const v = volumeFor(187, parseConcentration('125mg/5ml'));
    expect(v.ok && v.ml).toBeCloseTo(7.48, 2);
  });

  /*
    The refusal that matters most.

    A brand with no structured strength renders NO millilitre figure, ever --
    not a guess, not a default, not the last brand's. There is no code path
    from "we do not know the concentration" to a number on the screen.
  */
  it('refuses when the brand has no concentration', () => {
    expect(volumeFor(500, undefined)).toEqual({ ok: false, why: 'no-concentration' });
    expect(volumeFor(500, parseConcentration('0.9%'))).toEqual({
      ok: false,
      why: 'no-concentration',
    });
  });

  it('refuses to reconcile units with milligrams', () => {
    expect(
      volumeFor(500, { amount: 100000, unit: 'unit', per: 1, perUnit: 'ml' }),
    ).toEqual({ ok: false, why: 'unit-mismatch' });
  });
});

describe('a number a syringe can measure', () => {
  /*
    The worked example this was built from:
      Paracetamol 10-15 mg/kg. At 10 kg that is 100-150 mg.
      At 200 mg/5 mL -> about 3 mL. At 100 mg/5 mL -> about 7 mL.
  */
  it('reproduces the worked example, both strengths', () => {
    const dose = doseFor(row({ mgPerKg: 10, mgPerKgHigh: 15 }), { weightKg: 10 });
    expect(dose.ok).toBe(true);
    if (!dose.ok) return;

    const strong = parseConcentration('200mg/5ml');
    const lowMl = volumeFor(dose.dose.mgLow, strong);
    const highMl = volumeFor(dose.dose.mgHigh, strong);
    expect(lowMl.ok && lowMl.ml).toBe(2.5);
    expect(highMl.ok && highMl.ml).toBe(3.75);
    expect(suggestRounded(2.5, 3.75)).toEqual({ ml: 3, step: 1, approximate: false });

    const weak = parseConcentration('100mg/5ml');
    const lowMl2 = volumeFor(dose.dose.mgLow, weak);
    const highMl2 = volumeFor(dose.dose.mgHigh, weak);
    expect(lowMl2.ok && lowMl2.ml).toBe(5);
    expect(highMl2.ok && highMl2.ml).toBe(7.5);
    expect(suggestRounded(5, 7.5)).toEqual({ ml: 7, step: 1, approximate: false });
  });

  it('never suggests more than the top of the band', () => {
    for (const [lo, hi] of [
      [2.5, 3.75],
      [5, 7.5],
      [0.8, 1.2],
      [11.1, 16.6],
      [0.22, 0.33],
    ] as const) {
      const s = suggestRounded(lo, hi);
      expect(s.ml).toBeLessThanOrEqual(hi);
    }
  });

  it('falls back to halves, then tenths, before giving up on the band', () => {
    expect(suggestRounded(2.2, 2.9)).toEqual({ ml: 2.5, step: 0.5, approximate: false });
    expect(suggestRounded(0.22, 0.33)).toEqual({ ml: 0.3, step: 0.1, approximate: false });
  });

  it('marks a rounding that no graduation hits, rather than hiding it', () => {
    // A point dose: 40 mg/kg at 14 kg of 125 mg/5 mL is 22.4 mL exactly. A
    // 20 mL syringe has no 22.4 mark, so the suggestion is 22 and says so.
    expect(suggestRounded(22.4, 22.4)).toEqual({ ml: 22, step: 1, approximate: true });

    // 40 mg/kg at 14 kg in three doses is 187 mg, which is 7.48 mL of
    // 125 mg/5 mL. Half a millilitre is the finest mark that matters here.
    expect(suggestRounded(7.48, 7.48)).toEqual({ ml: 7.5, step: 0.5, approximate: true });

    // Under the finest mark there is nothing to round to but zero.
    const tiny = suggestRounded(0.04, 0.04);
    expect(tiny.approximate).toBe(true);
    expect(tiny.ml).toBe(0.04);
  });

  it('does not offer a precision the syringe in the room does not have', () => {
    // 11.1-16.6 mL is drawn in a 20 mL barrel, marked in whole millilitres.
    expect(suggestRounded(11.1, 16.6).step).toBe(1);
    // 0.22-0.33 mL is a 1 mL barrel, where a tenth is a real mark.
    expect(suggestRounded(0.22, 0.33).step).toBe(0.1);
  });

  it('writes millilitres the way they are written on a bottle', () => {
    expect(mlText(3)).toBe('3 ml');
    expect(mlText(3.5)).toBe('3.5 ml');
    expect(mlText(0.75)).toBe('0.75 ml');
  });
});

describe('whether a row covers this patient', () => {
  const r = row({
    mgPerKg: 10,
    ageBand: { fromDays: 90, label: 'over 3 months' },
    weightBand: { fromKg: 5, toKg: 20 },
  });

  it('says yes, no, or that it cannot tell -- and never confuses the last two', () => {
    expect(bandFits(r, { ageDays: 200, weightKg: 10 })).toBe(true);
    expect(bandFits(r, { ageDays: 30, weightKg: 10 })).toBe(false);
    expect(bandFits(r, { ageDays: 200, weightKg: 40 })).toBe(false);
    expect(bandFits(r, { ageDays: 200 })).toBeUndefined();
    expect(bandFits(row({ mgPerKg: 10 }), {})).toBe(true);
  });
});
