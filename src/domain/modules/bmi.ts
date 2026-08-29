/**
 * BMI / BSA. The simplest module in the registry, and the reason it is still
 * a module rather than pack data: §4c's line is "a pack may declare a score
 * (sum + band lookup), never a formula" -- and BSA's square root, however
 * small, is a formula. It also earns its place beyond growth's own inline use
 * of `bmi()`: eGFR de-indexing at extremes of body size needs BSA, which has
 * nowhere else to live.
 *
 * Reuses `bmi()` from `domain/growth/lms.ts` rather than reimplementing it --
 * one calculation, one place, same discipline as everywhere else in this
 * codebase. This module adds the adult classification band and BSA on top.
 */
import { bmi as bmiValue } from '../growth/lms.ts';

export interface BmiInput {
  weightKg: number;
  heightCm: number;
}

export type BmiOutcome =
  | { ok: true; value: number; unit: 'kg/m2'; category: string }
  | { ok: false; reason: 'bad-input'; detail: string };

export type BsaOutcome =
  | { ok: true; value: number; unit: 'm2'; method: 'Mosteller' }
  | { ok: false; reason: 'bad-input'; detail: string };

function badInput(input: BmiInput): string | null {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    return 'weight must be a positive number';
  }
  if (!Number.isFinite(input.heightCm) || input.heightCm <= 0) {
    return 'height must be a positive number';
  }
  return null;
}

/** WHO adult classification. A lookup on the computed value, not a second calculation. */
export function bmiCategory(value: number): string {
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Normal weight';
  if (value < 30) return 'Overweight';
  return 'Obese';
}

export function estimateBmi(input: BmiInput): BmiOutcome {
  const bad = badInput(input);
  if (bad) return { ok: false, reason: 'bad-input', detail: bad };
  const value = Math.round(bmiValue(input.weightKg, input.heightCm) * 10) / 10;
  return { ok: true, value, unit: 'kg/m2', category: bmiCategory(value) };
}

/** Mosteller: BSA (m2) = sqrt(height(cm) x weight(kg) / 3600). */
export function estimateBsa(input: BmiInput): BsaOutcome {
  const bad = badInput(input);
  if (bad) return { ok: false, reason: 'bad-input', detail: bad };
  const value = Math.round(Math.sqrt((input.heightCm * input.weightKg) / 3600) * 100) / 100;
  return { ok: true, value, unit: 'm2', method: 'Mosteller' };
}
