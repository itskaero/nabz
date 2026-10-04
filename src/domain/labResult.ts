/**
 * Results that arrive after the visit that ordered them.
 *
 * WHY THIS IS NOT PART OF THE ENCOUNTER
 * -------------------------------------
 * `LabOrder` on a prescription is an INSTRUCTION -- "go and have these done".
 * The value comes back three days later, when that document has been printed
 * and handed over. Putting it on the encounter would mean editing a signed
 * document to record something that happened afterwards, which is the one
 * thing a clinical record must not do.
 *
 * So results are their own store, linked to the patient and, where it is
 * known, to the encounter that ordered them.
 *
 * WHAT IT BUYS
 * ------------
 * The thing six separate prescriptions cannot give: creatinine over six
 * visits, as a line. A doctor reading six PDFs is reading six numbers; a
 * doctor reading a trend is reading a direction.
 *
 * WHAT IT REFUSES
 * ---------------
 * It does not decide whether a value is abnormal. Reference ranges are
 * age-, sex-, assay- and laboratory-specific, and a built-in range applied to
 * a result from a laboratory that uses a different assay is how an app
 * manufactures a disease. `flag` is set BY THE DOCTOR or copied from the
 * report the laboratory issued, never computed here -- and a result with no
 * flag renders with no flag, not as "normal".
 */

export type LabFlag = 'low' | 'high' | 'critical';

export interface LabResult {
  id: string;
  patientId: string;
  /** the encounter that ordered it, when it is known */
  encounterId?: string;
  /** id into the pack's labsPalette, or 'free:<text>' -- same keys as LabOrder */
  labId: string;
  /** the English label, frozen at entry: a pack edit must not rewrite history */
  label: string;
  /** free text, because "not detected", "trace" and "7.2" are all results */
  value: string;
  unit?: string;
  /**
   * The laboratory's own flag, or the doctor's. NEVER computed from a built-in
   * reference range -- see the header.
   */
  flag?: LabFlag;
  /** ISO date the sample was taken: the date a trend is plotted against */
  takenOn: string;
  /** ISO datetime it was typed in here */
  enteredOn: string;
  note?: string;
}

/** One test, every time it has been measured, newest first. */
export interface LabSeries {
  labId: string;
  label: string;
  unit?: string;
  results: LabResult[];
}

function numeric(value: string): number | undefined {
  // "7.2", "7.2 mg/dL", "<0.5", ">200" -- take the first number if there is
  // one, and give up quietly if there is not. "Not detected" is a result, and
  // a result that cannot be plotted is still a result worth showing.
  const m = /-?\d+(\.\d+)?/.exec(value);
  return m ? Number(m[0]) : undefined;
}

/**
 * Group one patient's results by test, newest first inside each group and
 * most-recently-measured group first.
 */
export function seriesFor(results: LabResult[], patientId: string): LabSeries[] {
  const mine = results.filter((r) => r.patientId === patientId);
  const byLab = new Map<string, LabSeries>();
  for (const r of mine) {
    let s = byLab.get(r.labId);
    if (!s) {
      s = { labId: r.labId, label: r.label, ...(r.unit ? { unit: r.unit } : {}), results: [] };
      byLab.set(r.labId, s);
    }
    s.results.push(r);
  }
  return [...byLab.values()]
    .map((s) => ({ ...s, results: [...s.results].sort((a, b) => b.takenOn.localeCompare(a.takenOn)) }))
    .sort((a, b) => (b.results[0]?.takenOn ?? '').localeCompare(a.results[0]?.takenOn ?? ''));
}

/**
 * The points of a series that can be plotted, oldest first.
 *
 * A series with fewer than three plottable points gets no sparkline: two
 * points joined by a line read as a trend, and two measurements are not one.
 * The table still shows every value, including the ones that are words.
 */
export const MIN_TREND_POINTS = 3;

export function trendPoints(series: LabSeries): Array<{ takenOn: string; value: number }> {
  const points = series.results
    .map((r) => {
      const value = numeric(r.value);
      return value === undefined ? null : { takenOn: r.takenOn, value };
    })
    .filter((p): p is { takenOn: string; value: number } => p !== null)
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn));
  return points.length >= MIN_TREND_POINTS ? points : [];
}

/**
 * A sparkline path, as plain SVG coordinates in a 0..width / 0..height box.
 *
 * Here rather than in the component so it is testable, and so the component
 * cannot be tempted to do arithmetic on clinical values. A flat series gets a
 * line through the middle rather than a division by zero.
 */
export function sparkline(
  points: Array<{ takenOn: string; value: number }>,
  width: number,
  height: number,
  stroke = 1.5,
): string {
  if (points.length === 0) return '';
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  /*
    Inset by half the stroke at each end.

    Without it the highest and lowest points sit exactly on y=0 and y=height,
    where the viewBox clips half the line -- the top of a rising series comes
    out visibly thinner than the rest of it, which reads as the line fading
    just where it matters most. Caught in a screenshot, not in the maths.
  */
  const pad = stroke / 2;
  const plot = height - stroke;
  return points
    .map((p, i) => {
      const x = i * step;
      // Inverted: SVG y grows downward and a rising value should rise.
      const y = span === 0 ? height / 2 : pad + plot - ((p.value - min) / span) * plot;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
