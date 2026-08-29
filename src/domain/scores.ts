/**
 * Clinical-score composition: tick criteria -> sum -> band. Pure and
 * framework-free, same discipline as `sig.ts`/`labs.ts` -- `ScoresPanel.tsx`
 * plots what this returns, it never recomputes (PRODUCT.md 4c).
 *
 * Grouped criteria (`ScoreCriterion.group`) are summed as MUTUALLY EXCLUSIVE:
 * only the highest-point ticked criterion in each group counts. This is
 * enforced here, not just in the UI that ticks the boxes -- CHA₂DS₂-VASc's
 * two age bands (65-74 / ≥75) are the reason this exists: naively summing
 * every ticked criterion overcounts a patient who (by a UI bug, or a future
 * caller of this function) has both age bands ticked at once, and the
 * resulting total would not even be a value the published score can produce.
 */
import type { ScoreBand, ScoreCriterion, ScoreDefinition } from './pack.ts';

export interface ScoreResult {
  total: number;
  max: number;
  band: ScoreBand | null;
}

function groupBy(criteria: ScoreCriterion[]): { ungrouped: ScoreCriterion[]; groups: ScoreCriterion[][] } {
  const ungrouped: ScoreCriterion[] = [];
  const byGroup = new Map<string, ScoreCriterion[]>();
  for (const c of criteria) {
    if (c.group) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
    else ungrouped.push(c);
  }
  return { ungrouped, groups: [...byGroup.values()] };
}

export function computeScore(score: ScoreDefinition, ticked: ReadonlySet<string>): ScoreResult {
  const { ungrouped, groups } = groupBy(score.criteria);

  let total = 0;
  for (const c of ungrouped) if (ticked.has(c.id)) total += c.points;
  for (const group of groups) {
    const tickedInGroup = group.filter((c) => ticked.has(c.id));
    if (tickedInGroup.length > 0) total += Math.max(...tickedInGroup.map((c) => c.points));
  }

  const max =
    ungrouped.reduce((sum, c) => sum + c.points, 0) +
    groups.reduce((sum, g) => sum + Math.max(...g.map((c) => c.points)), 0);

  const band = score.bands.find((b) => total >= b.min && total <= b.max) ?? null;
  return { total, max, band };
}
