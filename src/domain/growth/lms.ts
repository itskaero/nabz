/**
 * LMS -> z-score -> percentile. Pure, framework-free, no data imports.
 *
 * THIS IS THE SECOND PROVABLY-CORRECT REQUIREMENT AFTER URDU (PRODUCT.md 4b).
 * A percentile bug misclassifies a malnourished or failing-to-thrive child, so
 * this file holds arithmetic and nothing else: no table loading, no chart
 * selection, no UI concerns, no clinical interpretation. Everything here is
 * checkable against published reference values, and tests/growth.lms.test.ts
 * does exactly that.
 */

export interface Lms {
  /** Box-Cox power */
  l: number;
  /** median */
  m: number;
  /** coefficient of variation */
  s: number;
}

/** One row of a reference table: [x, L, M, S] where x is age in days. */
export type LmsRow = readonly [x: number, l: number, m: number, s: number];

export interface LmsLookup extends Lms {
  /** the x the LMS was evaluated at */
  x: number;
  /** true when L/M/S were linearly interpolated between two published rows */
  interpolated: boolean;
}

/**
 * Find L, M, S at `x`, linearly interpolating between adjacent published rows.
 *
 * Returns null when `x` is outside the table. Out of range must NOT extrapolate:
 * a made-up percentile for a 22-year-old off the end of a paediatric chart is
 * worse than no percentile, because it looks like an answer.
 */
export function lmsAt(rows: readonly LmsRow[], x: number): LmsLookup | null {
  if (rows.length === 0 || !Number.isFinite(x)) return null;
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  if (x < first[0] || x > last[0]) return null;

  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid]!;
    if (row[0] === x) return { x, l: row[1], m: row[2], s: row[3], interpolated: false };
    if (row[0] < x) lo = mid + 1;
    else hi = mid - 1;
  }
  // hi is now the last row below x, lo the first above it.
  const a = rows[hi]!;
  const b = rows[lo]!;
  const span = b[0] - a[0];
  const t = span === 0 ? 0 : (x - a[0]) / span;
  return {
    x,
    l: a[1] + (b[1] - a[1]) * t,
    m: a[2] + (b[2] - a[2]) * t,
    s: a[3] + (b[3] - a[3]) * t,
    interpolated: true,
  };
}

/** The measurement at a given z, per the LMS model. Used for curves and cut-offs. */
export function valueAtZ(lms: Lms, z: number): number {
  const { l, m, s } = lms;
  if (l === 0) return m * Math.exp(s * z);
  return m * Math.pow(1 + l * s * z, 1 / l);
}

/** Raw LMS z-score, before any tail adjustment. */
export function rawZScore(lms: Lms, value: number): number {
  const { l, m, s } = lms;
  if (!(value > 0) || !(m > 0) || !(s > 0)) return Number.NaN;
  if (l === 0) return Math.log(value / m) / s;
  return (Math.pow(value / m, l) - 1) / (l * s);
}

/**
 * WHO's tail adjustment for the weight-based indicators.
 *
 * Beyond +/-3 SD the LMS distribution's tails are known to be unreliable, so WHO
 * replaces them with a linear extrapolation whose unit is the width of the
 * outermost SD interval. Omitting this is not a rounding difference: it is the
 * difference between a plausible-looking z and the one WHO's own software
 * reports for a severely wasted child, which is exactly the child this number
 * is being computed for.
 *
 * Applies to weight-for-age, weight-for-length/height and BMI-for-age.
 * NOT applied to length/height-for-age or head circumference-for-age, per WHO.
 */
export function adjustTails(lms: Lms, value: number, z: number): number {
  if (!Number.isFinite(z)) return z;
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3);
    const sd2 = valueAtZ(lms, 2);
    const interval = sd3 - sd2;
    return interval > 0 ? 3 + (value - sd3) / interval : z;
  }
  if (z < -3) {
    const sd3 = valueAtZ(lms, -3);
    const sd2 = valueAtZ(lms, -2);
    const interval = sd2 - sd3;
    return interval > 0 ? -3 + (value - sd3) / interval : z;
  }
  return z;
}

export function zScore(lms: Lms, value: number, tailAdjusted: boolean): number {
  const z = rawZScore(lms, value);
  return tailAdjusted ? adjustTails(lms, value, z) : z;
}

/**
 * Standard normal CDF.
 *
 * Cody's rational Chebyshev approximation for erfc, as used in West (2005).
 * Double precision across the whole range -- deliberately not the 4-term
 * Abramowitz & Stegun approximation, whose ~1e-7 error is visible at the tails
 * where these numbers actually matter.
 */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return Number.NaN;
  const x = Math.abs(z);
  let cumulative: number;

  if (x > 37) {
    cumulative = 0;
  } else {
    const e = Math.exp(-(x * x) / 2);
    if (x < 7.07106781186547) {
      let build = 3.52624965998911e-2 * x + 0.700383064443688;
      build = build * x + 6.37396220353165;
      build = build * x + 33.912866078383;
      build = build * x + 112.079291497871;
      build = build * x + 221.213596169931;
      build = build * x + 220.206867912376;
      let denom = 8.83883476483184e-2 * x + 1.75566716318264;
      denom = denom * x + 16.064177579207;
      denom = denom * x + 86.7807322029461;
      denom = denom * x + 296.564248779674;
      denom = denom * x + 637.333633378831;
      denom = denom * x + 793.826512519948;
      denom = denom * x + 440.413735824752;
      cumulative = (e * build) / denom;
    } else {
      let build = x + 0.65;
      build = x + 4 / build;
      build = x + 3 / build;
      build = x + 2 / build;
      build = x + 1 / build;
      cumulative = e / (build * 2.506628274631);
    }
  }
  return z > 0 ? 1 - cumulative : cumulative;
}

/** Percentile (0-100) for a z-score. */
export function percentileFromZ(z: number): number {
  return normalCdf(z) * 100;
}

/**
 * A purely DESCRIPTIVE SD band. It states where the measurement sits on the
 * chosen reference curve and nothing more.
 *
 * It deliberately carries no clinical label -- not "underweight", not "stunted",
 * not "wasted". Naming the condition would be the app making a clinical
 * judgement, which PRODUCT.md rule 3.3 forbids. The doctor reads the band and
 * decides what it means for this child.
 */
export type SdBand =
  | 'below -3'
  | '-3 to -2'
  | '-2 to -1'
  | '-1 to +1'
  | '+1 to +2'
  | '+2 to +3'
  | 'above +3';

export function sdBand(z: number): SdBand | null {
  if (!Number.isFinite(z)) return null;
  if (z < -3) return 'below -3';
  if (z < -2) return '-3 to -2';
  if (z < -1) return '-2 to -1';
  if (z <= 1) return '-1 to +1';
  if (z <= 2) return '+1 to +2';
  if (z <= 3) return '+2 to +3';
  return 'above +3';
}

/** BMI from raw measurements. Kept here so nothing else has to know the formula. */
export function bmi(weightKg: number, heightCm: number): number {
  if (!(weightKg > 0) || !(heightCm > 0)) return Number.NaN;
  const m = heightCm / 100;
  return weightKg / (m * m);
}
