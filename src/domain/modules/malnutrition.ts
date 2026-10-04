/**
 * Acute malnutrition: wasting and nutritional oedema (PRODUCT.md 4c, CLAUDE.md 6d).
 *
 * Same discipline as growth and eGFR -- pure, framework-free, tested against
 * published values before it ships, and never recomputed anywhere else.
 *
 * WHY THE THRESHOLDS ARE NOT IN THIS FILE
 * ---------------------------------------
 * WHO's 2023 guideline and Pakistan's national CMAM protocol disagree about
 * which criteria admit a child, and both are right in their own setting:
 *
 *   WHO 2023        wasting is WHZ/WLZ < -2 (severe < -3), OR MUAC < 125mm
 *                   (severe < 115mm), OR bilateral pitting oedema.
 *   Pakistan (2019) MUAC < 115mm or bilateral pitting oedema as the
 *                   independent admission criteria -- a MUAC-only protocol.
 *
 * So the arithmetic is code and the thresholds are PACK DATA
 * (`ContentPack.moduleConfig.malnutrition`), exactly the split
 * `ScoreDefinition` already uses. A Pakistani CMAM pack and a WHO-protocol
 * pack are this one module configured two ways, not two modules.
 *
 * WHAT IT MUST NOT DO
 * -------------------
 * It reports a CLASSIFICATION and the criterion that produced it. It never
 * says admit, refer, transfer, or start RUTF. That is automated clinical
 * judgement (PRODUCT.md rule 3.3) and it is the line that keeps this a
 * recording tool. `tests/malnutrition.test.ts` asserts no instruction verb
 * reaches the output.
 */
import type { Sex } from '../prescription.ts';
import type { WastingTable } from '../growth/index.ts';
import type { LmsRow } from '../growth/lms.ts';
import { lmsAt, percentileFromZ, zScore } from '../growth/lms.ts';

/**
 * How the child's length was taken. NOT derived from age.
 *
 * WHO's rule is recumbent length under about 24 months and standing height
 * after, but the rule describes what SHOULD have happened, not what did. A
 * two-year-old who would not stand was measured lying down, and scoring them
 * against the standing table is wrong in the 65-110cm band where the two
 * overlap -- which is exactly the band where severe wasting is decided.
 * So the caller says how it was measured, and `classify` reports which table
 * it used.
 */
export type Posture = 'recumbent' | 'standing';

/**
 * Three states, not a boolean.
 *
 * Bilateral pitting oedema outranks every number in this module, so a
 * checkbox that starts unticked would quietly assert a clinical finding
 * nobody made. "Not assessed" refuses; "absent" is an answer.
 */
export type Oedema = 'present' | 'absent' | 'not-assessed';

export interface WastingInput {
  weightKg?: number;
  /** length or height in cm; which one is decided by `posture`, not by age */
  measurementCm?: number;
  posture?: Posture;
  ageDays?: number;
  sex?: Sex;
  /** mid-upper arm circumference, in MILLIMETRES -- the unit the cut-offs use */
  muacMm?: number;
  oedema?: Oedema;
}

/**
 * The protocol. Lives in the pack; see `ContentPack.moduleConfig.malnutrition`.
 *
 * `criteria` is what makes a Pakistani pack differ from a WHO one: a protocol
 * that does not list `whz` will not classify on weight-for-height even when
 * the numbers are present, because admitting on a criterion the local
 * programme does not use is not a kindness.
 */
export interface WastingProtocol {
  criteria: ReadonlyArray<'oedema' | 'whz' | 'muac'>;
  muacSevereMm: number;
  muacModerateMm: number;
  whzSevere: number;
  whzModerate: number;
  /** source + edition. REQUIRED and non-empty, exactly like DosingEntry. */
  reference: string;
}

/** WHO 2023, for a pack that follows the global guideline as published. */
export const WHO_2023: WastingProtocol = {
  criteria: ['oedema', 'whz', 'muac'],
  muacSevereMm: 115,
  muacModerateMm: 125,
  whzSevere: -3,
  whzModerate: -2,
  reference:
    'WHO guideline on the prevention and management of wasting and nutritional oedema (acute malnutrition) in infants and children under 5 years, 2023',
};

export type Severity = 'severe' | 'moderate' | 'none';

/** Which criterion produced the classification. Never inferred by the caller. */
export type Criterion = 'oedema' | 'whz' | 'muac';

export interface Measure {
  z: number;
  percentile: number;
  /** the table this came from, so a stale number is auditable later */
  chart: string;
  /** true when L/M/S were interpolated between two published rows */
  interpolated: boolean;
}

export type WastingOutcome =
  | {
      ok: true;
      severity: Severity;
      /** every criterion that fired, most severe first; empty when severity is 'none' */
      by: Criterion[];
      /** plain-language classification. Never an instruction. */
      label: string;
      whz?: Measure;
      muacZ?: Measure;
      muacMm?: number;
      oedema: Oedema;
      method: string;
    }
  | {
      ok: false;
      reason: 'missing-input' | 'out-of-range' | 'no-tables' | 'no-criteria';
      detail: string;
    };

// --- weight-for-length / weight-for-height ---------------------------------

/** The table a posture calls for. Never guessed from age. */
export function tableFor(
  tables: readonly WastingTable[] | undefined,
  posture: Posture,
): WastingTable | null {
  if (!tables?.length) return null;
  const axis = posture === 'recumbent' ? 'lengthCm' : 'heightCm';
  return tables.find((t) => t.axis === axis) ?? null;
}

function rowsFor(table: WastingTable, sex: Sex): readonly LmsRow[] {
  return table.data[sex] ?? [];
}

/**
 * Weight-for-length or weight-for-height z-score.
 *
 * `tailAdjusted: true` is not optional here and is the single most important
 * line in this file. Severe wasting is DEFINED at z < -3, so this module lives
 * entirely in the tail where WHO replaces the LMS distribution with a linear
 * extrapolation. `lms.ts` already implements that; using the raw z would
 * misclassify precisely the children this exists to find.
 */
export function weightForLengthZ(
  tables: readonly WastingTable[] | undefined,
  sex: Sex,
  measurementCm: number,
  weightKg: number,
  posture: Posture,
): Measure | { out: 'no-table' } | { out: 'out-of-range'; range: [number, number] } {
  const table = tableFor(tables, posture);
  if (!table) return { out: 'no-table' };
  const rows = rowsFor(table, sex);
  const lms = lmsAt(rows, measurementCm);
  if (!lms) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    return { out: 'out-of-range', range: [first?.[0] ?? 0, last?.[0] ?? 0] };
  }
  const z = zScore(lms, weightKg, true);
  return {
    z,
    percentile: percentileFromZ(z),
    chart: table.chart,
    interpolated: lms.interpolated,
  };
}

/**
 * MUAC-for-age z-score, from the ordinary age-keyed chart.
 *
 * Reported alongside the millimetre reading, never instead of it: the
 * admission cut-offs in both protocols are absolute millimetres, and a
 * z-score is the context, not the criterion.
 */
export function muacForAgeZ(
  rows: readonly LmsRow[] | undefined,
  ageDays: number,
  muacMm: number,
): Measure | null {
  if (!rows?.length) return null;
  const lms = lmsAt(rows, ageDays);
  if (!lms) return null;
  // The WHO table is in centimetres; the cut-offs are in millimetres.
  const z = zScore(lms, muacMm / 10, true);
  return { z, percentile: percentileFromZ(z), chart: 'muac-for-age', interpolated: lms.interpolated };
}

// --- classification --------------------------------------------------------

const LABEL: Record<Severity, string> = {
  severe: 'Severe acute malnutrition',
  moderate: 'Moderate acute malnutrition',
  none: 'No acute malnutrition by this protocol',
};

const RANK: Record<Severity, number> = { severe: 2, moderate: 1, none: 0 };

export interface ClassifyDeps {
  wasting?: readonly WastingTable[];
  muacRows?: readonly LmsRow[];
}

/**
 * Classify, against a protocol.
 *
 * Returns every criterion that fired rather than only the deciding one: a
 * child who is severe on MUAC and moderate on weight-for-height is a different
 * clinical picture from one who is severe on both, and collapsing that to a
 * single word throws away the thing a reviewing clinician would want.
 */
export function classify(
  input: WastingInput,
  protocol: WastingProtocol,
  deps: ClassifyDeps,
): WastingOutcome {
  if (!protocol.criteria.length) {
    return { ok: false, reason: 'no-criteria', detail: 'this protocol admits on no criteria' };
  }

  const wants = (c: Criterion) => protocol.criteria.includes(c);
  const fired: Array<{ criterion: Criterion; severity: Severity }> = [];

  // --- oedema. Outranks everything, and is asked first for that reason.
  const oedema: Oedema = input.oedema ?? 'not-assessed';
  if (wants('oedema')) {
    if (oedema === 'not-assessed') {
      return {
        ok: false,
        reason: 'missing-input',
        detail: 'bilateral pitting oedema has not been assessed',
      };
    }
    if (oedema === 'present') fired.push({ criterion: 'oedema', severity: 'severe' });
  }

  // --- weight-for-length / weight-for-height
  let whz: Measure | undefined;
  if (wants('whz')) {
    const { weightKg, measurementCm, posture, sex } = input;
    if (!sex || !weightKg || !measurementCm || !posture) {
      return {
        ok: false,
        reason: 'missing-input',
        detail: 'weight, length or height, how it was measured, and sex are all required',
      };
    }
    const out = weightForLengthZ(deps.wasting, sex, measurementCm, weightKg, posture);
    if ('out' in out) {
      if (out.out === 'no-table') {
        return {
          ok: false,
          reason: 'no-tables',
          detail: 'the weight-for-height tables are not in this build',
        };
      }
      return {
        ok: false,
        reason: 'out-of-range',
        detail: `${measurementCm}cm is outside the published table (${out.range[0]}-${out.range[1]}cm)`,
      };
    }
    whz = out;
    if (out.z < protocol.whzSevere) fired.push({ criterion: 'whz', severity: 'severe' });
    else if (out.z < protocol.whzModerate) fired.push({ criterion: 'whz', severity: 'moderate' });
  }

  // --- MUAC
  let muacZ: Measure | undefined;
  if (wants('muac')) {
    const { muacMm, ageDays } = input;
    if (!muacMm) {
      return { ok: false, reason: 'missing-input', detail: 'mid-upper arm circumference is required' };
    }
    if (muacMm < protocol.muacSevereMm) fired.push({ criterion: 'muac', severity: 'severe' });
    else if (muacMm < protocol.muacModerateMm) {
      fired.push({ criterion: 'muac', severity: 'moderate' });
    }
    // Context only, and only when the age is known. Its absence never blocks:
    // the cut-offs above are absolute millimetres and stand on their own.
    if (ageDays !== undefined && input.sex) {
      muacZ = muacForAgeZ(deps.muacRows, ageDays, muacMm) ?? undefined;
    }
  }

  fired.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
  const severity = fired[0]?.severity ?? 'none';

  return {
    ok: true,
    severity,
    by: fired.filter((f) => f.severity === severity).map((f) => f.criterion),
    label: LABEL[severity],
    ...(whz ? { whz } : {}),
    ...(muacZ ? { muacZ } : {}),
    ...(input.muacMm !== undefined ? { muacMm: input.muacMm } : {}),
    oedema,
    method: protocol.reference,
  };
}

/**
 * The posture WHO's rule would expect at this age -- offered as a DEFAULT for
 * the control, never used in place of an answer. `classify` reads
 * `input.posture` and nothing else.
 */
export function expectedPosture(ageDays: number | undefined): Posture {
  return ageDays !== undefined && ageDays < 730 ? 'recumbent' : 'standing';
}
