/**
 * Growth reference tables, loaded from the generated bundle.
 *
 * `tables/lms.json` is NOT hand-authored and must never be hand-edited. It is
 * produced by `npm run assets:growth` straight from WHO's and CDC's own
 * published LMS files, and it carries the source URL for every range it
 * contains. If it is missing, the growth module refuses to compute rather than
 * falling back to anything -- there is no such thing as an approximate
 * percentile (PRODUCT.md 4b).
 *
 * It is loaded ON DEMAND. Nearly 17,000 LMS rows is half a megabyte, and a
 * doctor writing a script for a chest infection should not pay for the growth
 * charts before the app will open. It loads the first time Growth is used, and
 * the service worker keeps it offline from then on.
 */
import type { GrowthTables } from '@domain/growth/index.ts';

let cached: GrowthTables | null = null;
let inflight: Promise<GrowthTables> | null = null;

export async function loadGrowthTables(): Promise<GrowthTables> {
  if (cached) return cached;
  inflight ??= import('./tables/lms.json').then((mod) => {
    cached = (mod.default ?? mod) as unknown as GrowthTables;
    return cached;
  });
  return inflight;
}

/**
 * The tables if they are already in memory, else null. Callers that get null
 * must show "not loaded" rather than computing anything -- `compute()` treats a
 * null table as a refusal, which is the behaviour we want.
 */
export function growthTablesIfLoaded(): GrowthTables | null {
  return cached;
}

export function referenceCitation(reference: 'WHO' | 'CDC'): string | null {
  return cached?.editions[reference] ?? null;
}

export function chartSources(reference: 'WHO' | 'CDC'): string[] {
  return (cached?.provenance ?? [])
    .filter((p) => p.reference === reference)
    .map((p) => `${p.chart} ${p.range} — ${p.url}`);
}
