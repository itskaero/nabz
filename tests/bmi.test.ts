/**
 * BMI / BSA suite. Both formulas are pure algebra (a square, a square root of
 * a rational number) with no branch, so exact worked examples are safe to
 * hand-compute -- unlike CKD-EPI's exponentials, see tests/gfr.test.ts's own
 * header for why that suite leans on algebraic identities instead.
 */
import { describe, expect, it } from 'vitest';
import { bmiCategory, estimateBmi, estimateBsa } from '@domain/modules/bmi.ts';

describe('estimateBmi', () => {
  it('70kg at 175cm: 70 / 1.75^2 = 22.86 (Normal weight)', () => {
    const out = estimateBmi({ weightKg: 70, heightCm: 175 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value).toBeCloseTo(22.9, 1);
      expect(out.category).toBe('Normal weight');
    }
  });

  it('100kg at 170cm classifies as Obese', () => {
    const out = estimateBmi({ weightKg: 100, heightCm: 170 });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.category).toBe('Obese');
  });

  it('45kg at 170cm classifies as Underweight', () => {
    const out = estimateBmi({ weightKg: 45, heightCm: 170 });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.category).toBe('Underweight');
  });

  it('refuses zero or negative input', () => {
    expect(estimateBmi({ weightKg: 0, heightCm: 170 }).ok).toBe(false);
    expect(estimateBmi({ weightKg: 70, heightCm: -1 }).ok).toBe(false);
  });
});

describe('bmiCategory: WHO adult bands, continuous at every boundary', () => {
  it('matches the published thresholds', () => {
    expect(bmiCategory(17)).toBe('Underweight');
    expect(bmiCategory(22)).toBe('Normal weight');
    expect(bmiCategory(27)).toBe('Overweight');
    expect(bmiCategory(32)).toBe('Obese');
  });

  it('has no gap or overlap at 18.5 / 25 / 30', () => {
    for (const boundary of [18.5, 25, 30]) {
      expect(bmiCategory(boundary)).not.toBe(bmiCategory(boundary - 0.1));
    }
  });
});

describe('estimateBsa (Mosteller)', () => {
  it('180cm, 80kg: sqrt(180*80/3600) = sqrt(4) = 2.00 m2 exactly', () => {
    const out = estimateBsa({ weightKg: 80, heightCm: 180 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value).toBeCloseTo(2.0, 2);
      expect(out.unit).toBe('m2');
      expect(out.method).toBe('Mosteller');
    }
  });

  it('90cm, 40kg: sqrt(90*40/3600) = sqrt(1) = 1.00 m2 exactly', () => {
    const out = estimateBsa({ weightKg: 40, heightCm: 90 });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toBeCloseTo(1.0, 2);
  });

  it('refuses zero or negative input', () => {
    expect(estimateBsa({ weightKg: 0, heightCm: 170 }).ok).toBe(false);
  });

  it('is monotonically increasing in both weight and height', () => {
    const base = (estimateBsa({ weightKg: 60, heightCm: 160 }) as { ok: true; value: number }).value;
    const heavier = (estimateBsa({ weightKg: 80, heightCm: 160 }) as { ok: true; value: number }).value;
    const taller = (estimateBsa({ weightKg: 60, heightCm: 180 }) as { ok: true; value: number }).value;
    expect(heavier).toBeGreaterThan(base);
    expect(taller).toBeGreaterThan(base);
  });
});
