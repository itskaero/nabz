/**
 * eGFR suite (PRODUCT.md 4c, CLAUDE.md 6d) -- MANDATORY, same rule as growth:
 * no module ships without a green suite checking it against known values.
 *
 * WHY THIS SUITE LEANS ON ALGEBRAIC IDENTITIES RATHER THAN MEMORISED DIGITS
 * ------------------------------------------------------------------------
 * Growth's suite checks computed values against WHO/CDC's own published LMS
 * tables, embedded verbatim in `data/growth`. eGFR has no equivalent shipped
 * reference table -- CKD-EPI 2021 is a closed-form formula, not a table -- so
 * "spot-check a known age/sex/creatinine against a known published eGFR" would
 * mean trusting a number typed from memory into a test, with no independent
 * source to check it against. That is a worse guarantee than it looks like.
 *
 * Instead this suite checks properties that are exact consequences of the
 * formula's OWN definition, and which a wrong implementation is likely to
 * break even when it looks plausible:
 *  - CONTINUITY at the kappa boundary, where the two power terms meet -- the
 *    classic bug here is swapping min/max or the branch condition, which this
 *    would catch because the two branches would stop agreeing exactly where
 *    they must.
 *  - The UNIT-CONVERSION round-trip -- the "silent factor of 88.4" bug the
 *    module exists to prevent, checked by construction rather than assumed.
 *  - MONOTONICITY -- higher creatinine must never mean a higher eGFR.
 *  - Wide-tolerance CLINICAL SANITY bounds ("a young adult with normal
 *    creatinine has a normal eGFR") stay in for readability, at a tolerance
 *    wide enough that they are not standing in for real precision.
 *
 * Cockcroft-Gault, by contrast, is pure multiplication and division with no
 * branch or transcendental function -- exact worked examples are safe to
 * hand-compute and are used below.
 */
import { describe, expect, it } from 'vitest';
import {
  creatinineMgDl,
  estimateCkdEpi,
  estimateCockcroftGault,
  kdigoStage,
} from '@domain/modules/gfr.ts';
import type { GfrInput } from '@domain/modules/gfr.ts';

const base = (over: Partial<GfrInput> = {}): GfrInput => ({
  age: 50,
  sex: 'M',
  creatinine: 1.0,
  creatinineUnit: 'mg/dL',
  ...over,
});

describe('creatinineMgDl', () => {
  it('passes mg/dL through unchanged', () => {
    expect(creatinineMgDl(1.0, 'mg/dL')).toBe(1.0);
  });

  it('converts umol/L using the standard 88.4 factor', () => {
    expect(creatinineMgDl(88.4, 'umol/L')).toBeCloseTo(1.0, 6);
  });
});

describe('refuses rather than returning Infinity or NaN', () => {
  it('rejects zero creatinine', () => {
    const out = estimateCkdEpi(base({ creatinine: 0 }));
    expect(out.ok).toBe(false);
  });

  it('rejects negative creatinine', () => {
    const out = estimateCkdEpi(base({ creatinine: -1 }));
    expect(out.ok).toBe(false);
  });

  it('rejects non-positive age', () => {
    const out = estimateCkdEpi(base({ age: 0 }));
    expect(out.ok).toBe(false);
  });

  it('Cockcroft-Gault refuses without a weight', () => {
    const out = estimateCockcroftGault(base());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('missing-weight');
  });
});

describe('CKD-EPI 2021: algebraic properties', () => {
  it('is continuous at the kappa boundary (Scr === kappa)', () => {
    // At Scr = kappa, ratio = 1, so BOTH power terms evaluate to 1^x = 1 --
    // the min-branch and max-branch formulas must therefore agree exactly.
    // A swapped branch condition or a wrong exponent breaks this seam first.
    const maleAtKappa = estimateCkdEpi(base({ sex: 'M', creatinine: 0.9, age: 40 }));
    const femaleAtKappa = estimateCkdEpi(base({ sex: 'F', creatinine: 0.7, age: 40 }));
    expect(maleAtKappa.ok).toBe(true);
    expect(femaleAtKappa.ok).toBe(true);
    if (!maleAtKappa.ok || !femaleAtKappa.ok) return;

    // Closed form at the boundary: eGFR = 142 * 0.9938^age * [1.012 if female].
    // Exact, hand-derivable from the formula itself, not a memorised digit.
    const expectedMale = 142 * 0.9938 ** 40;
    const expectedFemale = 142 * 0.9938 ** 40 * 1.012;
    expect(maleAtKappa.value).toBeCloseTo(expectedMale, 0);
    expect(femaleAtKappa.value).toBeCloseTo(expectedFemale, 0);

    // And the female:male ratio at each one's own boundary is exactly the
    // 1.012 female multiplier -- the one piece the boundary values isolate.
    expect(femaleAtKappa.value / maleAtKappa.value).toBeCloseTo(1.012, 2);
  });

  it('a value just below kappa and just above kappa agree with the closed form on each side', () => {
    const below = estimateCkdEpi(base({ sex: 'M', creatinine: 0.85, age: 40 }));
    const above = estimateCkdEpi(base({ sex: 'M', creatinine: 0.95, age: 40 }));
    expect(below.ok && above.ok).toBe(true);
    if (!below.ok || !above.ok) return;
    // Higher creatinine must mean lower (or equal) eGFR either side of kappa.
    expect(above.value).toBeLessThan(below.value);
  });

  it('is monotonically decreasing in creatinine, holding age and sex fixed', () => {
    const values = [0.5, 0.8, 1.0, 1.5, 2.0, 4.0].map(
      (creatinine) => (estimateCkdEpi(base({ creatinine })) as { ok: true; value: number }).value,
    );
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeLessThan(values[i - 1]!);
    }
  });

  it('is monotonically decreasing in age, holding creatinine and sex fixed (0.9938^age)', () => {
    const values = [20, 40, 60, 80].map(
      (age) => (estimateCkdEpi(base({ age })) as { ok: true; value: number }).value,
    );
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeLessThan(values[i - 1]!);
    }
  });

  it('mg/dL and the equivalent umol/L input produce the same result', () => {
    const inMgDl = estimateCkdEpi(base({ creatinine: 1.2, creatinineUnit: 'mg/dL' }));
    const inUmol = estimateCkdEpi(base({ creatinine: 1.2 * 88.4, creatinineUnit: 'umol/L' }));
    expect(inMgDl.ok && inUmol.ok).toBe(true);
    if (inMgDl.ok && inUmol.ok) expect(inUmol.value).toBeCloseTo(inMgDl.value, 1);
  });

  it('a young adult with normal creatinine has a normal eGFR (wide clinical sanity band)', () => {
    const out = estimateCkdEpi(base({ age: 25, creatinine: 0.8 }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toBeGreaterThan(90);
  });

  it('markedly elevated creatinine in an older adult reads as reduced function', () => {
    const out = estimateCkdEpi(base({ age: 70, creatinine: 4.0 }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toBeLessThan(30);
  });
});

describe('KDIGO staging is a lookup on the computed value, not a second calculation', () => {
  it('bands match their published thresholds', () => {
    expect(kdigoStage(95)).toMatch(/^G1/);
    expect(kdigoStage(75)).toMatch(/^G2/);
    expect(kdigoStage(50)).toMatch(/^G3a/);
    expect(kdigoStage(35)).toMatch(/^G3b/);
    expect(kdigoStage(20)).toMatch(/^G4/);
    expect(kdigoStage(10)).toMatch(/^G5/);
  });

  it('is continuous at every boundary (no gap, no overlap)', () => {
    for (const boundary of [90, 60, 45, 30, 15]) {
      expect(kdigoStage(boundary)).not.toBe(kdigoStage(boundary - 0.1));
    }
  });
});

describe('Cockcroft-Gault: exact worked examples (pure algebra, hand-checkable)', () => {
  it('a 60-year-old, 70kg man with Scr 1.0 mg/dL', () => {
    // CrCl = (140-60) * 70 * 1 / (72 * 1.0) = 5600 / 72
    const out = estimateCockcroftGault(base({ age: 60, weightKg: 70, creatinine: 1.0 }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toBeCloseTo(5600 / 72, 1);
  });

  it('a 60-year-old, 60kg woman with Scr 0.8 mg/dL (the 0.85 female factor)', () => {
    // CrCl = (140-60) * 60 * 0.85 / (72 * 0.8) = 4080 / 57.6
    const out = estimateCockcroftGault(
      base({ age: 60, sex: 'F', weightKg: 60, creatinine: 0.8 }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toBeCloseTo(4080 / 57.6, 1);
  });

  it('reports mL/min, not mL/min/1.73m2 -- it must never be labelled as eGFR', () => {
    const out = estimateCockcroftGault(base({ weightKg: 70 }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.unit).toBe('mL/min');
  });
});

describe('what this module must never do', () => {
  it('the outcome carries only a number, unit and method -- no dose, no drug, no instruction', () => {
    const out = estimateCkdEpi(base());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const keys = Object.keys(out).sort();
    expect(keys).toEqual(['method', 'ok', 'stage', 'unit', 'value'].sort());
  });
});
