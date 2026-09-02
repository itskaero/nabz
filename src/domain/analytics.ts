/**
 * Practice analytics (Home) -- PRODUCT.md's analytics addendum, CLAUDE.md 6e.
 *
 * Pure, framework-free, zero network -- the same split growth/gfr use: the
 * numbers are computed here, storage/db.ts reads the raw rows, HomePanel.tsx
 * only maps a number to a pixel. Nothing in this file touches localStorage,
 * IndexedDB, or the network; it does not know where its inputs came from.
 *
 * Read-only and backward-looking. This never feeds a suggestion into an
 * active prescription (rule 3.3 does not apply here for exactly that reason)
 * and nothing here is transmitted anywhere, ever (rule 1).
 */

/** One month's prescription volume. `month` is 'YYYY-MM'. */
export interface MonthlyVolume {
  month: string;
  count: number;
}

/**
 * Buckets prescriptions by their `date` field (already 'YYYY-MM-DD'), month
 * ascending. 'YYYY-MM' strings sort correctly with plain string comparison,
 * including across a year boundary ('2025-12' < '2026-01'), so no date
 * parsing is needed.
 */
export function monthlyVolume(prescriptions: ReadonlyArray<{ date: string }>): MonthlyVolume[] {
  const buckets = new Map<string, number>();
  for (const rx of prescriptions) {
    const month = rx.date.slice(0, 7);
    buckets.set(month, (buckets.get(month) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, count]) => ({ month, count }));
}

/** One row in the "top diagnoses (as written)" tally. */
export interface DiagnosisTally {
  text: string;
  count: number;
}

/**
 * Ranks already-normalised diagnosis-frequency rows (storage/db.ts's
 * topDiagnoses reads these from the existing `learned` store, itself
 * case/trim-normalised only -- see that function's own doc comment) by count
 * descending. NOT fuzzy grouping: "URTI" and "Upper respiratory tract
 * infection" stay two separate rows even at equal counts, on purpose --
 * diagnosis is free text (PRODUCT.md), and a closed-looking tally would
 * misrepresent it as coded data.
 */
export function rankDiagnoses(
  rows: ReadonlyArray<{ text: string; count: number }>,
  limit = 8,
): DiagnosisTally[] {
  return [...rows]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((r) => ({ text: r.text, count: r.count }));
}
