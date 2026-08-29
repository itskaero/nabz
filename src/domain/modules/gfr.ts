/**
 * eGFR (PRODUCT.md 4c, CLAUDE.md 6d) -- the module the medicine pack's own
 * notes called "to medicine what the growth chart is to paediatrics". Same
 * discipline as growth: pure, framework-free, tested against known values
 * before it ships (CLAUDE.md 6b), and never recomputed anywhere else.
 *
 * TWO estimates, both labelled, because they answer different questions and
 * confusing them is the actual hazard:
 *  - CKD-EPI 2021 (race-free) stages kidney function, reported per 1.73m2 of
 *    body surface area -- the standard for staging CKD.
 *  - Cockcroft-Gault estimates creatinine CLEARANCE in mL/min, de-indexed by
 *    the patient's own weight. Most drug renal-dosing tables -- including for
 *    metformin, nitrofurantoin, enoxaparin and allopurinol, all in this pack
 *    -- are calibrated against CrCl, not eGFR. Showing only one invites using
 *    the wrong number for the wrong purpose.
 *
 * Three traps handled explicitly rather than assumed away:
 *  1. UNITS. Creatinine is reported in mg/dL in Pakistan and umol/L
 *     elsewhere. There is no default unit -- a silent factor of 88.4 is a
 *     catastrophic, silent error, so the caller must say which one they have.
 *  2. NEGATIVE/ZERO INPUT. A bad creatinine value refuses rather than
 *     returning Infinity or NaN, which would otherwise print as a number.
 *  3. WHAT IT MUST NOT DO. This module reports a number and its method. It
 *     never adjusts a dose and never flags a drug -- that is automated
 *     clinical judgement (PRODUCT.md rule 3.3), and nothing here imports from
 *     or writes to the dosing UI.
 */
import type { Sex } from '../prescription.ts';

export type CreatinineUnit = 'mg/dL' | 'umol/L';

export interface GfrInput {
  /** years; fractional is fine */
  age: number;
  sex: Sex;
  creatinine: number;
  creatinineUnit: CreatinineUnit;
  /** required for Cockcroft-Gault only */
  weightKg?: number;
}

export type GfrOutcome =
  | { ok: true; value: number; unit: string; method: string; stage?: string }
  | { ok: false; reason: 'bad-input' | 'missing-weight'; detail: string };

const UMOL_PER_MGDL = 88.4;

/** Creatinine in mg/dL, whatever unit it was entered in. Never a default unit. */
export function creatinineMgDl(value: number, unit: CreatinineUnit): number {
  return unit === 'umol/L' ? value / UMOL_PER_MGDL : value;
}

function badInput(input: Pick<GfrInput, 'age' | 'creatinine'>): string | null {
  if (!Number.isFinite(input.age) || input.age <= 0) return 'age must be a positive number';
  if (!Number.isFinite(input.creatinine) || input.creatinine <= 0) {
    return 'creatinine must be a positive number';
  }
  return null;
}

/**
 * CKD-EPI 2021 creatinine equation (race-free). Inker et al., "New Creatinine-
 * and Cystatin C-Based Equations to Estimate GFR without Race", NEJM 2021.
 *
 * eGFR = 142 x min(Scr/k, 1)^a x max(Scr/k, 1)^-1.200 x 0.9938^age x [1.012 if female]
 * where k = 0.7 (female) / 0.9 (male), a = -0.241 (female) / -0.302 (male).
 */
export function estimateCkdEpi(input: GfrInput): GfrOutcome {
  const bad = badInput(input);
  if (bad) return { ok: false, reason: 'bad-input', detail: bad };
  const scr = creatinineMgDl(input.creatinine, input.creatinineUnit);
  const female = input.sex === 'F';
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  const ratio = scr / k;
  const value =
    142 *
    Math.min(ratio, 1) ** a *
    Math.max(ratio, 1) ** -1.2 *
    0.9938 ** input.age *
    (female ? 1.012 : 1);
  return {
    ok: true,
    value: round1(value),
    unit: 'mL/min/1.73m2',
    method: 'CKD-EPI 2021 (race-free, creatinine)',
    stage: kdigoStage(value),
  };
}

/** KDIGO 2012 CKD staging by GFR category -- a lookup, not a calculation. */
export function kdigoStage(egfr: number): string {
  if (egfr >= 90) return 'G1 (normal or high)';
  if (egfr >= 60) return 'G2 (mildly decreased)';
  if (egfr >= 45) return 'G3a (mildly to moderately decreased)';
  if (egfr >= 30) return 'G3b (moderately to severely decreased)';
  if (egfr >= 15) return 'G4 (severely decreased)';
  return 'G5 (kidney failure)';
}

/**
 * Cockcroft-Gault creatinine clearance. Cockcroft & Gault, "Prediction of
 * creatinine clearance from serum creatinine", Nephron 1976.
 *
 * CrCl (mL/min) = (140 - age) x weight(kg) x [0.85 if female] / (72 x Scr[mg/dL])
 */
export function estimateCockcroftGault(input: GfrInput): GfrOutcome {
  const bad = badInput(input);
  if (bad) return { ok: false, reason: 'bad-input', detail: bad };
  if (!input.weightKg || !Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    return {
      ok: false,
      reason: 'missing-weight',
      detail: 'Cockcroft-Gault needs the patient’s weight in kg',
    };
  }
  const scr = creatinineMgDl(input.creatinine, input.creatinineUnit);
  const value =
    ((140 - input.age) * input.weightKg * (input.sex === 'F' ? 0.85 : 1)) / (72 * scr);
  return { ok: true, value: round1(value), unit: 'mL/min', method: 'Cockcroft-Gault' };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
