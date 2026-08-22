/**
 * The doctor's own prescribing repertoire.
 *
 * THE ANSWER TO "150 MEDICINES vs 75,000"
 * ---------------------------------------
 * A competitor advertises 75,000 medicines. Grilled, that number is weaker than
 * it looks: DRAP's own registry disclaims itself as unusable "as a reference for
 * any purpose", registrations lapse so an extract decays, and a paediatrician
 * prescribes from a repertoire of maybe 200 — so 74,800 of those rows are
 * autocomplete noise that makes MIS-selection more likely, not less.
 *
 * The honest answer is not to match the number. It is that this app already
 * records every drug the doctor actually types (`db.learn('drug', …)`), and a
 * list ranked by what THIS doctor prescribes beats an unranked national
 * catalogue for the only task that matters: finding the right drug in two
 * keystrokes, at OPD speed.
 *
 * So the search blends two sources and puts the doctor's own first. Free text
 * still never blocks, which is what makes the true claim "every medicine, plus
 * the ones you actually use, ranked".
 */
import type { FormularyEntry } from './pack.ts';

/** One row the doctor has typed before, with how often. */
export interface RepertoireEntry {
  text: string;
  count: number;
  lastUsed: string;
}

export interface DrugSuggestion {
  /** what to show */
  label: string;
  /** catalogue row, when this came from the pack */
  entry?: FormularyEntry;
  /** how many times this doctor has prescribed it */
  used: number;
  source: 'repertoire' | 'catalogue';
}

function score(haystack: string, q: string): number {
  const h = haystack.toLowerCase();
  if (h === q) return 3;
  if (h.startsWith(q)) return 2;
  if (h.includes(q)) return 1;
  return 0;
}

/**
 * Blend the doctor's repertoire with the catalogue.
 *
 * Repertoire entries outrank catalogue rows at the same text match, and among
 * themselves rank by how often they have actually been prescribed. A drug the
 * doctor writes weekly should not sit below one they have never used simply
 * because the catalogue happened to list it first.
 */
export function suggestDrugs(
  query: string,
  catalogue: FormularyEntry[],
  repertoire: RepertoireEntry[],
  limit = 12,
): DrugSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: Array<DrugSuggestion & { rank: number }> = [];
  const seen = new Set<string>();

  for (const row of repertoire) {
    const s = score(row.text, q);
    if (!s) continue;
    const key = row.text.toLowerCase();
    seen.add(key);
    // Match quality dominates; usage breaks ties. `count` is capped so a drug
    // prescribed 400 times cannot outrank a better text match.
    out.push({
      label: row.text,
      used: row.count,
      source: 'repertoire',
      rank: s * 100 + Math.min(row.count, 50) + 25,
    });
  }

  for (const row of catalogue) {
    const s = Math.max(score(row.brand, q), score(row.generic, q));
    if (!s) continue;
    const key = row.brand.toLowerCase();
    if (seen.has(key)) continue;
    out.push({
      label: row.brand,
      entry: row,
      used: 0,
      source: 'catalogue',
      rank: s * 100,
    });
  }

  return out
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ rank: _rank, ...rest }) => rest);
}

/** How much of this doctor's prescribing the catalogue actually covers. */
export function repertoireCoverage(
  catalogue: FormularyEntry[],
  repertoire: RepertoireEntry[],
): { known: number; unknown: RepertoireEntry[] } {
  const brands = new Set(catalogue.map((r) => r.brand.toLowerCase()));
  const unknown = repertoire.filter((r) => !brands.has(r.text.toLowerCase()));
  return { known: repertoire.length - unknown.length, unknown };
}
