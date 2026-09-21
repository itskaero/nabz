/**
 * Acute malnutrition suite -- MANDATORY, same rule as growth and eGFR: no
 * module ships without a green suite checking it against known values
 * (tests/gfr.test.ts's header states the rule).
 *
 * This module is the good case for that rule, because WHO publishes the
 * reference values themselves. The fixtures below are WHO's own simplified
 * field tables, to the 0.1kg they are published at:
 *
 *   weight-for-height, boys,  80cm:  -3SD 8.3   -2SD 9.0   -1SD 9.7   median 10.6
 *   weight-for-height, girls, 80cm:  -3SD 7.9   -2SD 8.6   -1SD 9.4   median 10.2
 *   weight-for-length, boys,  70cm:  -3SD 6.6   -2SD 7.2   -1SD 7.8   median  8.4
 *
 * The suite feeds those published weights in and asserts the z-score that
 * comes back is the one the table says it is. That is a real external check,
 * not a round-trip through our own arithmetic.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGrowthTables } from '@data/growth/index.ts';
import type { GrowthTables } from '@domain/growth/index.ts';
import type { LmsRow } from '@domain/growth/lms.ts';
import { rawZScore, lmsAt } from '@domain/growth/lms.ts';
import type { ClassifyDeps, WastingProtocol } from '@domain/modules/malnutrition.ts';
import {
  WHO_2023,
  classify,
  expectedPosture,
  muacForAgeZ,
  tableFor,
  weightForLengthZ,
} from '@domain/modules/malnutrition.ts';

let tables: GrowthTables;
let deps: ClassifyDeps;

beforeAll(async () => {
  tables = await loadGrowthTables();
  const muac = tables.charts.find((c) => c.chart === 'muac-for-age');
  deps = {
    ...(tables.wasting ? { wasting: tables.wasting } : {}),
    ...(muac ? { muacRows: muac.data.M } : {}),
  };
});

/** Pakistan's national protocol: MUAC-only, plus oedema. */
const PAKISTAN: WastingProtocol = {
  criteria: ['oedema', 'muac'],
  muacSevereMm: 115,
  muacModerateMm: 125,
  whzSevere: -3,
  whzModerate: -2,
  reference:
    'National Guideline for the Management of Acute Malnutrition, Ministry of Health Pakistan, May 2019',
};

const z = (sex: 'M' | 'F', cm: number, kg: number, posture: 'recumbent' | 'standing') => {
  const out = weightForLengthZ(tables.wasting, sex, cm, kg, posture);
  if ('out' in out) throw new Error(`refused: ${out.out}`);
  return out;
};

/**
 * WHO publishes the field tables rounded to 0.1kg, so feeding a published
 * weight back in cannot land on a whole z. The budget is arithmetic, not a
 * fudge: around 80cm one z is worth about 0.7kg, so 0.05kg of rounding is
 * worth about 0.07z, and the band narrows as the child gets smaller. 0.12
 * covers the worst of it and is still far tighter than a wrong L, M or S
 * would ever survive -- swapping in the recumbent table's numbers at 80cm
 * moves z by 0.19, and this would catch that.
 */
const PUBLISHED_ROUNDING = 0.12;

function expectZ(actual: number, published: number): void {
  expect(Math.abs(actual - published)).toBeLessThan(PUBLISHED_ROUNDING);
}

describe('weight-for-height, against WHO’s published field tables', () => {
  it('boys at 80cm: 8.3kg is -3 SD, 9.0kg is -2 SD, 10.6kg is the median', () => {
    expectZ(z('M', 80, 8.3, 'standing').z, -3);
    expectZ(z('M', 80, 9.0, 'standing').z, -2);
    expectZ(z('M', 80, 9.7, 'standing').z, -1);
    expectZ(z('M', 80, 10.6, 'standing').z, 0);
  });

  it('girls at 80cm: 7.9kg is -3 SD, 8.6kg is -2 SD, 10.2kg is the median', () => {
    expectZ(z('F', 80, 7.9, 'standing').z, -3);
    expectZ(z('F', 80, 8.6, 'standing').z, -2);
    expectZ(z('F', 80, 9.4, 'standing').z, -1);
    expectZ(z('F', 80, 10.2, 'standing').z, 0);
  });

  it('boys at 70cm recumbent: 6.6kg is -3 SD, 7.2kg is -2 SD, 8.4kg is the median', () => {
    expectZ(z('M', 70, 6.6, 'recumbent').z, -3);
    expectZ(z('M', 70, 7.2, 'recumbent').z, -2);
    expectZ(z('M', 70, 8.4, 'recumbent').z, 0);
  });

  it('would fail if the sexes were swapped', () => {
    // The girls' table at 80cm puts -3SD at 7.9kg; feeding that weight through
    // the boys' table must NOT come out at -3, or the suite above would pass
    // with the sexes transposed.
    expect(Math.abs(z('M', 80, 7.9, 'standing').z - -3)).toBeGreaterThan(0.3);
  });

  it('is monotonic: more weight at one height is never a lower z', () => {
    let last = -Infinity;
    for (let kg = 7; kg <= 14; kg += 0.5) {
      const v = z('M', 80, kg, 'standing').z;
      expect(v).toBeGreaterThan(last);
      last = v;
    }
  });

  it('says which chart produced the number', () => {
    expect(z('M', 80, 9, 'standing').chart).toBe('weight-for-height');
    expect(z('M', 80, 9, 'recumbent').chart).toBe('weight-for-length');
  });
});

describe('posture is not a formality', () => {
  it('scores the same child differently lying down and standing', () => {
    // The two tables overlap from 65 to 110cm and are NOT interchangeable
    // there: at 80cm the boys' median is 10.45kg recumbent and 10.58kg
    // standing. Scoring a child against the wrong one is wrong in exactly the
    // band where severe wasting is decided.
    const lying = z('M', 80, 9.0, 'recumbent').z;
    const standing = z('M', 80, 9.0, 'standing').z;
    expect(lying).not.toBeCloseTo(standing, 2);
    expect(lying).toBeGreaterThan(standing);
  });

  it('offers WHO’s expected posture without ever substituting it for an answer', () => {
    expect(expectedPosture(300)).toBe('recumbent');
    expect(expectedPosture(1000)).toBe('standing');
    expect(expectedPosture(undefined)).toBe('standing');
    // A two-year-old who would not stand was measured lying down, and
    // `classify` must read what was recorded, not what was expected.
    const out = classify(
      { sex: 'M', ageDays: 1000, weightKg: 9, measurementCm: 80, posture: 'recumbent',
        muacMm: 130, oedema: 'absent' },
      WHO_2023,
      deps,
    );
    expect(out.ok && out.whz?.chart).toBe('weight-for-length');
  });

  it('picks the table by posture, not by which one exists first', () => {
    expect(tableFor(tables.wasting, 'recumbent')?.axis).toBe('lengthCm');
    expect(tableFor(tables.wasting, 'standing')?.axis).toBe('heightCm');
    expect(tableFor(undefined, 'standing')).toBeNull();
  });
});

describe('the tail below -3 SD, where this module lives', () => {
  it('uses WHO’s tail adjustment rather than the raw LMS z', () => {
    // Severe wasting is DEFINED at z < -3, so the whole module sits in the
    // range where WHO replaces the LMS distribution with a linear
    // extrapolation. Using the raw z here would misclassify precisely the
    // children this exists to find.
    const rows = tableFor(tables.wasting, 'standing')!.data.M;
    const lms = lmsAt(rows, 80)!;
    const raw = rawZScore(lms, 7.0);
    const adjusted = z('M', 80, 7.0, 'standing').z;

    expect(raw).toBeLessThan(-5);
    expect(adjusted).toBeGreaterThan(raw);
    expect(adjusted).toBeCloseTo(-4.99, 1);
  });

  it('still classifies a deeply wasted child as severe', () => {
    const out = classify(
      { sex: 'M', measurementCm: 80, weightKg: 7.0, posture: 'standing',
        muacMm: 130, oedema: 'absent' },
      WHO_2023,
      deps,
    );
    expect(out.ok && out.severity).toBe('severe');
    expect(out.ok && out.by).toContain('whz');
  });
});

describe('MUAC', () => {
  it('reads the millimetre cut-offs, not the z-score', () => {
    const severe = classify({ muacMm: 110, oedema: 'absent' }, PAKISTAN, deps);
    const moderate = classify({ muacMm: 120, oedema: 'absent' }, PAKISTAN, deps);
    const none = classify({ muacMm: 130, oedema: 'absent' }, PAKISTAN, deps);
    expect(severe.ok && severe.severity).toBe('severe');
    expect(moderate.ok && moderate.severity).toBe('moderate');
    expect(none.ok && none.severity).toBe('none');
  });

  it('treats 115mm as the boundary it is published as', () => {
    // < 115 is severe; 115 exactly is not.
    expect(classify({ muacMm: 114.9, oedema: 'absent' }, PAKISTAN, deps).ok
      && classify({ muacMm: 114.9, oedema: 'absent' }, PAKISTAN, deps)).toMatchObject({ severity: 'severe' });
    expect(classify({ muacMm: 115, oedema: 'absent' }, PAKISTAN, deps)).toMatchObject({ severity: 'moderate' });
  });

  it('converts mm to the cm the WHO table is published in', () => {
    const rows = tables.charts.find((c) => c.chart === 'muac-for-age')!.data.M;
    // A boy at one year with MUAC 146mm is at about the median (14.64cm).
    const at = muacForAgeZ(rows, 365, 146);
    expect(at).not.toBeNull();
    expect(at!.z).toBeCloseTo(0, 1);
    // If millimetres leaked through unconverted the z would be absurd.
    expect(Math.abs(at!.z)).toBeLessThan(1);
  });

  it('adds the z-score as context without ever needing it', () => {
    const noAge = classify({ muacMm: 110, oedema: 'absent' }, PAKISTAN, deps);
    expect(noAge.ok && noAge.severity).toBe('severe');
    expect(noAge.ok && noAge.muacZ).toBeUndefined();

    const withAge = classify(
      { muacMm: 110, ageDays: 365, sex: 'M', oedema: 'absent' }, PAKISTAN, deps);
    expect(withAge.ok && withAge.muacZ).toBeDefined();
  });
});

describe('the protocol is pack data, and it changes the answer', () => {
  const child = {
    sex: 'M' as const,
    ageDays: 900,
    weightKg: 8.0,
    measurementCm: 80,
    posture: 'standing' as const,
    muacMm: 130,
    oedema: 'absent' as const,
  };

  it('WHO 2023 admits this child on weight-for-height', () => {
    const out = classify(child, WHO_2023, deps);
    expect(out.ok && out.severity).toBe('severe');
    expect(out.ok && out.by).toEqual(['whz']);
  });

  it('Pakistan’s MUAC-only protocol does not', () => {
    // Same child, same numbers, different programme. This is the test that
    // proves the arithmetic is code and the thresholds are pack data.
    const out = classify(child, PAKISTAN, deps);
    expect(out.ok && out.severity).toBe('none');
    expect(out.ok && out.whz).toBeUndefined();
  });

  it('names the protocol that produced the classification', () => {
    expect(classify(child, WHO_2023, deps).ok
      && classify(child, WHO_2023, deps)).toMatchObject({ method: WHO_2023.reference });
    expect(classify(child, PAKISTAN, deps)).toMatchObject({ method: PAKISTAN.reference });
  });

  it('refuses a protocol that admits on nothing', () => {
    const out = classify(child, { ...WHO_2023, criteria: [] }, deps);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('no-criteria');
  });
});

describe('oedema outranks every number', () => {
  it('makes a well-nourished child severe', () => {
    const out = classify(
      { sex: 'M', weightKg: 12, measurementCm: 80, posture: 'standing',
        muacMm: 140, oedema: 'present' },
      WHO_2023,
      deps,
    );
    expect(out.ok && out.severity).toBe('severe');
    expect(out.ok && out.by).toEqual(['oedema']);
  });

  it('refuses to classify until it has been assessed', () => {
    // "Not assessed" and "absent" are different, and a checkbox that starts
    // unticked would quietly assert a finding nobody made.
    const out = classify({ muacMm: 130 }, PAKISTAN, deps);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('missing-input');
    expect(!out.ok && out.detail).toContain('oedema');
  });

  it('records what was answered, so the record says it was asked', () => {
    const out = classify({ muacMm: 130, oedema: 'absent' }, PAKISTAN, deps);
    expect(out.ok && out.oedema).toBe('absent');
  });
});

describe('refusals', () => {
  it('names the missing input rather than computing on a guess', () => {
    const out = classify({ sex: 'M', weightKg: 9, oedema: 'absent' }, WHO_2023, deps);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('missing-input');
  });

  it('refuses outside the published table instead of extrapolating', () => {
    const low = classify(
      { sex: 'M', weightKg: 2, measurementCm: 40, posture: 'recumbent',
        muacMm: 130, oedema: 'absent' },
      WHO_2023, deps);
    expect(low.ok).toBe(false);
    expect(!low.ok && low.reason).toBe('out-of-range');
    expect(!low.ok && low.detail).toContain('45');

    const high = classify(
      { sex: 'M', weightKg: 30, measurementCm: 140, posture: 'standing',
        muacMm: 130, oedema: 'absent' },
      WHO_2023, deps);
    expect(high.ok).toBe(false);
    expect(!high.ok && high.reason).toBe('out-of-range');
  });

  it('refuses when the tables are not in this build', () => {
    const out = classify(
      { sex: 'M', weightKg: 9, measurementCm: 80, posture: 'standing',
        muacMm: 130, oedema: 'absent' },
      WHO_2023,
      { muacRows: [] as LmsRow[] },
    );
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('no-tables');
  });
});

describe('it classifies, and never instructs', () => {
  const INSTRUCTIONS = /\b(admit|refer|transfer|start|give|prescribe|commence|discharge)\b/i;

  it('emits no instruction verb in any classification it can produce', () => {
    // PRODUCT.md rule 3.3. "Severe acute malnutrition" is a classification;
    // "admit" is a decision this app is forbidden to make. This is the line
    // that keeps the module a recording tool.
    const cases = [
      { muacMm: 110, oedema: 'absent' as const },
      { muacMm: 120, oedema: 'absent' as const },
      { muacMm: 130, oedema: 'absent' as const },
      { muacMm: 130, oedema: 'present' as const },
    ];
    for (const input of cases) {
      const out = classify(input, PAKISTAN, deps);
      expect(out.ok).toBe(true);
      if (out.ok) expect(out.label).not.toMatch(INSTRUCTIONS);
    }
  });

  it('offers exactly three classifications and no fourth', () => {
    const labels = new Set<string>();
    for (const mm of [100, 120, 130]) {
      const out = classify({ muacMm: mm, oedema: 'absent' }, PAKISTAN, deps);
      if (out.ok) labels.add(out.label);
    }
    expect([...labels].sort()).toEqual([
      'Moderate acute malnutrition',
      'No acute malnutrition by this protocol',
      'Severe acute malnutrition',
    ]);
  });

  it('reports every criterion that fired at the deciding severity', () => {
    // Severe on both MUAC and weight-for-height is a different picture from
    // severe on one, and collapsing that to a single word throws away what a
    // reviewing clinician would want.
    const out = classify(
      { sex: 'M', weightKg: 7.5, measurementCm: 80, posture: 'standing',
        muacMm: 108, oedema: 'absent' },
      WHO_2023,
      deps,
    );
    expect(out.ok && out.by.sort()).toEqual(['muac', 'whz']);
  });
});
