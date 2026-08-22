/**
 * The growth module's public surface: pick a chart, compute a percentile, and
 * say which curve produced it.
 *
 * Two rules this file enforces (PRODUCT.md 4b):
 *  1. A percentile is meaningless without its reference. Every result carries
 *     `{ reference, chart, edition }`, and the record stores it that way. WHO
 *     and CDC genuinely disagree under age 2; a stored bare number is a number
 *     nobody can check later.
 *  2. This is the single source of truth. The chart component PLOTS what this
 *     returns; it never recomputes. If a plotted point and a printed percentile
 *     can be produced by two different code paths, they will eventually differ.
 */
import type { GrowthMeasureId, Sex } from '../prescription.ts';
import type { Lms, LmsRow } from './lms.ts';
import { bmi, lmsAt, percentileFromZ, sdBand, valueAtZ, zScore } from './lms.ts';
import type { SdBand } from './lms.ts';

export type GrowthReference = 'WHO' | 'CDC';

export interface GrowthChart {
  reference: GrowthReference;
  /** e.g. 'weight-for-age' */
  chart: string;
  measure: GrowthMeasureId;
  unit: string;
  data: Record<Sex, LmsRow[]>;
}

export interface GrowthTables {
  generatedAt: string;
  editions: Record<GrowthReference, string>;
  provenance: Array<{
    reference: GrowthReference;
    chart: string;
    range: string;
    url: string;
    rows: number;
  }>;
  charts: GrowthChart[];
}

export interface GrowthInput {
  measure: GrowthMeasureId;
  /** kg for weight, cm for length/height/hc, kg/m2 for bmi */
  value: number;
  ageDays: number;
  sex: Sex;
}

export interface GrowthResult {
  measure: GrowthMeasureId;
  value: number;
  unit: string;
  ageDays: number;
  sex: Sex;
  z: number;
  percentile: number;
  band: SdBand | null;
  reference: GrowthReference;
  chart: string;
  edition: string;
  /** true when L/M/S came from interpolation between published rows */
  interpolated: boolean;
}

export type GrowthFailure =
  | { ok: false; reason: 'no-tables'; detail: string }
  | { ok: false; reason: 'no-chart'; detail: string }
  | { ok: false; reason: 'out-of-range'; detail: string }
  | { ok: false; reason: 'bad-input'; detail: string };

export type GrowthOutcome = ({ ok: true } & GrowthResult) | GrowthFailure;

/**
 * WHO applies its +/-3 SD tail adjustment to the weight-based indicators only.
 * Encoded as data rather than an `if` in the maths so the rule is visible.
 */
const TAIL_ADJUSTED_CHARTS = new Set(['weight-for-age', 'bmi-for-age', 'weight-for-length', 'weight-for-height']);

/** Age in days from two ISO dates. Whole days; no timezone cleverness. */
export function ageDaysBetween(dob: string, on: string): number {
  const a = Date.parse(dob + 'T00:00:00Z');
  const b = Date.parse(on + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.floor((b - a) / 86400000);
}

/**
 * Length and height are the same quantity taken two ways -- lying down under
 * about 2 years, standing after -- and the published tables split on that, not
 * on the quantity. WHO's 0-5y table is a length-OR-height table; CDC's infant
 * table is recumbent and its child table is standing. So a measure has to be
 * able to fall back to its sibling when the age is in the sibling's range, or a
 * standing 4-year-old gets "out of range" from a chart that covers them.
 */
const MEASURE_FAMILY: Partial<Record<GrowthMeasureId, GrowthMeasureId[]>> = {
  length: ['length', 'height'],
  height: ['height', 'length'],
};

function inRange(chart: GrowthChart, sex: Sex, ageDays: number): boolean {
  const rows = chart.data[sex];
  const first = rows[0];
  const last = rows[rows.length - 1];
  return !!first && !!last && ageDays >= first[0] && ageDays <= last[0];
}

/**
 * Which chart to use for a measure at a given age. Exact measure first, then
 * its sibling; within each, the chart whose published age range actually covers
 * this child. Returns null rather than guessing when nothing covers them.
 */
export function selectChart(
  tables: GrowthTables,
  reference: GrowthReference,
  measure: GrowthMeasureId,
  ageDays: number,
  sex: Sex,
): GrowthChart | null {
  const preference = MEASURE_FAMILY[measure] ?? [measure];
  for (const candidateMeasure of preference) {
    const candidates = tables.charts.filter(
      (c) => c.reference === reference && c.measure === candidateMeasure,
    );
    const covering = candidates.find((c) => inRange(c, sex, ageDays));
    if (covering) return covering;
  }
  // Nothing covers this age. Hand back the exact-measure chart anyway so the
  // caller can report the range it missed, not just "no chart".
  return (
    tables.charts.find((c) => c.reference === reference && c.measure === measure) ?? null
  );
}

export function compute(
  tables: GrowthTables | null,
  reference: GrowthReference,
  input: GrowthInput,
): GrowthOutcome {
  if (!tables || tables.charts.length === 0) {
    return {
      ok: false,
      reason: 'no-tables',
      detail:
        'growth reference tables are not installed - run `npm run assets:growth`. Refusing to compute a percentile without a published curve.',
    };
  }
  if (!Number.isFinite(input.value) || input.value <= 0 || !Number.isFinite(input.ageDays)) {
    return { ok: false, reason: 'bad-input', detail: 'measurement and age are required' };
  }

  const chart = selectChart(tables, reference, input.measure, input.ageDays, input.sex);
  if (!chart) {
    return {
      ok: false,
      reason: 'no-chart',
      detail: `${reference} has no ${input.measure} chart in this build`,
    };
  }

  const lookup = lmsAt(chart.data[input.sex], input.ageDays);
  if (!lookup) {
    const rows = chart.data[input.sex];
    const lo = rows[0]?.[0] ?? 0;
    const hi = rows[rows.length - 1]?.[0] ?? 0;
    return {
      ok: false,
      reason: 'out-of-range',
      detail: `age ${input.ageDays} d is outside the ${reference} ${chart.chart} chart (${lo}-${hi} d)`,
    };
  }

  const lms: Lms = { l: lookup.l, m: lookup.m, s: lookup.s };
  const z = zScore(lms, input.value, TAIL_ADJUSTED_CHARTS.has(chart.chart));
  return {
    ok: true,
    measure: input.measure,
    value: input.value,
    unit: chart.unit,
    ageDays: input.ageDays,
    sex: input.sex,
    z,
    percentile: percentileFromZ(z),
    band: sdBand(z),
    reference,
    chart: chart.chart,
    edition: tables.editions[reference],
    interpolated: lookup.interpolated,
  };
}

/**
 * The reference curves themselves, for plotting. Presentation asks for the
 * curve it wants to draw; it never derives one from a percentile it computed.
 */
export function curve(
  tables: GrowthTables,
  reference: GrowthReference,
  measure: GrowthMeasureId,
  sex: Sex,
  z: number,
  fromDays: number,
  toDays: number,
  steps = 120,
): Array<{ ageDays: number; value: number }> {
  const chart = selectChart(tables, reference, measure, fromDays, sex);
  if (!chart) return [];
  const out: Array<{ ageDays: number; value: number }> = [];
  for (let i = 0; i <= steps; i += 1) {
    const ageDays = Math.round(fromDays + ((toDays - fromDays) * i) / steps);
    const lookup = lmsAt(chart.data[sex], ageDays);
    if (lookup) out.push({ ageDays, value: valueAtZ(lookup, z) });
  }
  return out;
}

export { bmi, sdBand, valueAtZ };
export type { SdBand };
