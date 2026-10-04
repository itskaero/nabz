/**
 * Weight to milligrams to millilitres.
 *
 * WHY THIS IS A MODULE AND NOT THREE LINES IN A COMPONENT.
 * `MedicationsSection.tsx` did `cited.mgPerKg * rx.patient.weightKg` inline and
 * printed the result. The same codebase's `GrowthPanel` opens by saying the two
 * things it is NOT allowed to do, the first being "compute a percentile",
 * because arithmetic a child is treated on belongs somewhere it can be read and
 * tested on its own. A dose is the same class of claim as a percentile, and
 * this is where it now lives.
 *
 * WHY THE STRENGTH IS STRUCTURED AND NEVER PARSED AT RUN TIME.
 * `FormularyEntry.strength` is a display string, and the 150 seed rows hold
 * fourteen different kinds of thing in it: `125mg/5ml`, `250mcg/ml`,
 * `3.35g/5ml`, `20/120mg`, `100000 units/ml`, `400 IU/drop`, `100mcg/puff`,
 * `0.9%`, `500mg`, and `WHO formula`. A regex that takes the digits before
 * `mg` reads `250mcg/ml` as 250 mg/mL -- a thousandfold overdose, one
 * character away from the parseable case -- and reads `3.35g/5ml` a
 * thousandfold the other way.
 *
 * So the millilitre figure is computed from `FormularyEntry.concentration`, a
 * structured field, and a row without one shows milligrams and SAYS it cannot
 * give a volume. `parseConcentration` exists to seed that field from the
 * display string, and it refuses everything it does not fully understand --
 * including every shape in the list above that is not a mass per millilitre.
 * Its blind spots are pinned by name in `tests/dose.test.ts`, so a strength it
 * cannot read is a decision somebody made rather than a silent gap.
 *
 * WHY `maxPerDay` IS NOT READ EITHER. It is prose -- "4 doses in 24 hours",
 * "40 mg/kg in 24 hours", "500 mg as a single dose, or 100 mg twice daily for
 * 3 days". Parsing a ceiling out of that is the same mistake as parsing a
 * strength, with the same consequence pointing the other way. Caps are applied
 * only from the numeric fields a pack states deliberately
 * (`maxMgPerDose`, `maxMgPerDay`, `maxMgPerKgPerDay`), and the prose is shown
 * to the prescriber regardless.
 *
 * EVERYTHING HERE IS A SUGGESTION. Nothing in this file writes to a
 * prescription. PRODUCT.md 3.2 has the doctor confirm every value, and
 * `MedicationLine.citedSuggestion` records what was shown without implying it
 * was accepted.
 */
import type { DosingEntry } from './pack.ts';

/**
 * A mass (or biological activity) per volume, as data.
 *
 * `perUnit` is `'ml'` and only `'ml'`: per-puff, per-drop and per-sachet are
 * real strengths but they are not volumes, and a syringe figure derived from
 * one would be nonsense. Those rows carry no concentration and the UI says so.
 */
export interface Concentration {
  amount: number;
  unit: 'mg' | 'mcg' | 'g' | 'unit' | 'IU';
  per: number;
  perUnit: 'ml';
}

/** Milligrams in one millilitre, or `undefined` when the unit is not a mass. */
export function mgPerMl(c: Concentration): number | undefined {
  const factor = c.unit === 'mg' ? 1 : c.unit === 'mcg' ? 0.001 : c.unit === 'g' ? 1000 : undefined;
  if (factor === undefined) return undefined;
  if (!(c.per > 0)) return undefined;
  return (c.amount * factor) / c.per;
}

/**
 * Read a display strength into a concentration, or refuse.
 *
 * Deliberately strict and deliberately narrow: `<number><mass unit>/<number><ml>`
 * and nothing else. Percentages, combinations (`20/120mg`), per-puff and
 * per-drop strengths, biological units and bare solids all return `undefined`.
 *
 * A percentage IS convertible in principle -- 2% is 20 mg/mL -- and is left out
 * on purpose. Every percentage in the seed is a cream, a drop or an infusion
 * fluid, none of which a parent measures into a syringe from a bottle, and a
 * conversion nobody needs is a conversion that can only be wrong.
 */
export function parseConcentration(strength: string | undefined): Concentration | undefined {
  if (!strength) return undefined;
  const text = strength.trim().toLowerCase();
  // A combination ("20/120mg", "25/50mcg") has two actives and no single
  // strength to read. The leading `[\d.]+/` is what rules it out.
  const m = /^([\d.]+)\s*(mg|mcg|g)\s*\/\s*([\d.]*)\s*ml$/.exec(text);
  if (!m) return undefined;
  const amount = Number(m[1]);
  const per = m[3] === '' ? 1 : Number(m[3]);
  if (!Number.isFinite(amount) || !Number.isFinite(per) || amount <= 0 || per <= 0) {
    return undefined;
  }
  return { amount, unit: m[2] as 'mg' | 'mcg' | 'g', per, perUnit: 'ml' };
}

/*
  `| undefined` spelled out, under `exactOptionalPropertyTypes`.

  Every caller builds this from patient facts that are routinely absent -- a
  walk-in with no recorded date of birth, a child who has not been weighed yet
  -- so "the key is there and its value is unknown" is the normal case, not a
  mistake to be coerced away at each call site.
*/
export interface DoseInput {
  weightKg?: number | undefined;
  ageDays?: number | undefined;
}

/** Why no number could be produced. Each one is shown to the doctor as words. */
export type DoseRefusal =
  /** the row is weight-based and no weight has been recorded */
  | 'no-weight'
  /** the row states a fixed regimen or a plain refusal; show `fixedDose` */
  | 'not-weight-based';

export interface Dose {
  /** per dose, in milligrams */
  mgLow: number;
  mgHigh: number;
  /** doses per day the row assumes, when it says */
  perDoses?: number;
  /** across 24 hours, when `perDoses` is known */
  mgPerDayLow?: number;
  mgPerDayHigh?: number;
  /**
   * Which stated ceiling bound the figure above, in the doctor's words.
   *
   * A silent cap is a dose the prescriber cannot explain to a parent, and
   * worse, cannot tell apart from the dose they expected.
   */
  cappedBy?: string;
}

export type DoseResult = { ok: true; dose: Dose } | { ok: false; why: DoseRefusal };

/**
 * The per-dose range for this patient, with any stated ceiling applied.
 *
 * `mgPerKg` is per DOSE, not per day -- that is what the field means
 * everywhere else in the codebase and what `citedDoseText` prints. A row with
 * no `mgPerKgHigh` is a point, returned as a range whose ends are equal, so
 * every caller has one shape to render.
 */
export function doseFor(entry: DosingEntry, input: DoseInput): DoseResult {
  if (entry.mgPerKg === undefined) return { ok: false, why: 'not-weight-based' };
  const weightKg = input.weightKg;
  if (!weightKg || weightKg <= 0) return { ok: false, why: 'no-weight' };

  let mgLow = entry.mgPerKg * weightKg;
  let mgHigh = (entry.mgPerKgHigh ?? entry.mgPerKg) * weightKg;
  let cappedBy: string | undefined;

  const capPerDose = (limit: number, why: string) => {
    if (mgHigh > limit) {
      mgHigh = limit;
      cappedBy = why;
    }
    // The bottom of the band can exceed a ceiling too -- a 60 kg adolescent on
    // a paediatric mg/kg row is the ordinary way it happens. Clamping both ends
    // keeps the range from printing inside out.
    if (mgLow > limit) mgLow = limit;
  };

  if (entry.maxMgPerDose !== undefined) {
    capPerDose(entry.maxMgPerDose, `the stated ${entry.maxMgPerDose} mg maximum per dose`);
  }
  const perDoses = entry.perDoses;
  if (perDoses && perDoses > 0) {
    if (entry.maxMgPerDay !== undefined) {
      capPerDose(
        entry.maxMgPerDay / perDoses,
        `the stated ${entry.maxMgPerDay} mg maximum in 24 hours, divided over ${perDoses} doses`,
      );
    }
    if (entry.maxMgPerKgPerDay !== undefined) {
      const dailyCap = entry.maxMgPerKgPerDay * weightKg;
      capPerDose(
        dailyCap / perDoses,
        `the stated ${entry.maxMgPerKgPerDay} mg/kg maximum in 24 hours ` +
          `(${round(dailyCap, 0)} mg at ${weightKg} kg), divided over ${perDoses} doses`,
      );
    }
  }

  const dose: Dose = { mgLow, mgHigh };
  if (perDoses && perDoses > 0) {
    dose.perDoses = perDoses;
    dose.mgPerDayLow = mgLow * perDoses;
    dose.mgPerDayHigh = mgHigh * perDoses;
  }
  if (cappedBy) dose.cappedBy = cappedBy;
  return { ok: true, dose };
}

export type VolumeRefusal =
  /** no structured strength on the brand, so no volume can be given -- ever */
  | 'no-concentration'
  /** a strength in units or IU cannot be reconciled with a dose in milligrams */
  | 'unit-mismatch';

export type VolumeResult = { ok: true; ml: number } | { ok: false; why: VolumeRefusal };

/** Millilitres holding `mg` milligrams, or a refusal that says which hole it hit. */
export function volumeFor(mg: number, c: Concentration | undefined): VolumeResult {
  if (!c) return { ok: false, why: 'no-concentration' };
  const perMl = mgPerMl(c);
  if (perMl === undefined || perMl <= 0) return { ok: false, why: 'unit-mismatch' };
  return { ok: true, ml: mg / perMl };
}

export interface RoundedVolume {
  ml: number;
  /** the graduation it was rounded to, in millilitres */
  step: 1 | 0.5 | 0.1;
  /**
   * True when the suggestion is NOT inside the computed range.
   *
   * It happens whenever the row states a single mg/kg figure rather than a
   * band: 40 mg/kg at 14 kg of 125 mg/5 mL is 22.4 mL, and no syringe
   * graduation is 22.4. The figure is still the right one to draw up, but the
   * screen has to say it is a rounding of an exact number rather than a
   * choice inside a band somebody published.
   */
  approximate: boolean;
}

/**
 * A number a syringe can actually measure, inside the band where there is one.
 *
 * Whole millilitres first, then halves, then tenths -- and the LARGEST that
 * still fits. Preferring the top of a published band is deliberate: the band's
 * top is the maximum the source itself gives, while rounding down out of
 * vagueness is how fever and infection get under-treated. Nothing here ever
 * exceeds `mlHigh`.
 *
 * This is the arithmetic in the worked example that prompted it. Paracetamol
 * 10-15 mg/kg at 10 kg is 100-150 mg; at 200 mg/5 mL that is 2.5-3.75 mL and
 * the answer is 3 mL; at 100 mg/5 mL it is 5-7.5 mL and the answer is 7 mL.
 */
export function suggestRounded(mlLow: number, mlHigh: number): RoundedVolume {
  const low = Math.min(mlLow, mlHigh);
  const high = Math.max(mlLow, mlHigh);
  const steps = graduations(high);
  for (const step of steps) {
    const candidate = round(Math.floor(round(high / step, 6)) * step, 4);
    if (candidate >= step && candidate >= round(low, 4)) {
      return { ml: candidate, step, approximate: false };
    }
  }
  /*
    Nothing in the band lands on a mark: either the row states a single figure
    rather than a band, or the band is narrower than the finest graduation.
    Round to the NEAREST mark and say it is approximate -- 22 mL of a 22.4 mL
    dose is the right thing to draw up, and the screen has to be able to tell
    that apart from a number somebody published.
  */
  const finest = steps[steps.length - 1] ?? 0.1;
  const nearest = round(Math.round(round(high / finest, 6)) * finest, 4);
  if (nearest >= finest) return { ml: nearest, step: finest, approximate: true };
  // Under the finest mark there is nothing to round to but zero, and zero is
  // not a dose. Give the exact figure, flagged.
  return { ml: round(high, 2), step: finest, approximate: true };
}

/**
 * The marks a syringe for this volume actually has.
 *
 * A 1 mL syringe is graduated in hundredths and a 20 mL one is not: offering
 * 22.4 mL implies a precision the barrel in the room does not have, and
 * "22.4" read off a 20 mL syringe is somebody's guess between two marks.
 */
function graduations(ml: number): ReadonlyArray<1 | 0.5 | 0.1> {
  if (ml < 1) return [1, 0.5, 0.1];
  if (ml < 10) return [1, 0.5];
  return [1];
}

/**
 * Whether this row's bands cover this patient.
 *
 * Returned separately from `doseFor` on purpose: a doctor may legitimately use
 * a row outside its band and knows they are doing it, so this reports rather
 * than refuses. `undefined` means the patient fact it needs is missing, which
 * is not the same as "fits" and must not be rendered as one.
 */
export function bandFits(entry: DosingEntry, input: DoseInput): boolean | undefined {
  const checks: Array<boolean | undefined> = [];
  if (entry.ageBand) {
    const days = input.ageDays;
    checks.push(
      days === undefined
        ? undefined
        : (entry.ageBand.fromDays === undefined || days >= entry.ageBand.fromDays) &&
            (entry.ageBand.toDays === undefined || days <= entry.ageBand.toDays),
    );
  }
  if (entry.weightBand) {
    const kg = input.weightKg;
    checks.push(
      kg === undefined
        ? undefined
        : (entry.weightBand.fromKg === undefined || kg >= entry.weightBand.fromKg) &&
            (entry.weightBand.toKg === undefined || kg <= entry.weightBand.toKg),
    );
  }
  if (checks.length === 0) return true;
  if (checks.some((c) => c === false)) return false;
  if (checks.some((c) => c === undefined)) return undefined;
  return true;
}

/** Round half away from zero at `places`, avoiding the usual float surprises. */
export function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round((value + Number.EPSILON * Math.sign(value) * Math.abs(value)) * f) / f;
}

/** Milligrams as a prescriber writes them: no decimals above 10 mg, one below. */
export function mgText(mg: number): string {
  if (mg >= 10) return `${round(mg, 0)} mg`;
  if (mg >= 1) return `${round(mg, 1)} mg`;
  return `${round(mg, 2)} mg`;
}

/** Millilitres, trimmed: `3 ml`, `3.5 ml`, `0.75 ml`. */
export function mlText(ml: number): string {
  const r = round(ml, 2);
  return `${Number.isInteger(r) ? r : r.toFixed(2).replace(/0$/, '')} ml`;
}
