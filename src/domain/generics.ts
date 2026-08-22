/**
 * The generic-name vocabulary, and the near-duplicate guard around it.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `formulary` joins to `dosing` on `generic` (PRODUCT.md 11a). That join is a
 * plain string match, so a typo does not throw and does not warn -- it silently
 * returns no dose, and the cited-suggestion panel just quietly stops appearing
 * for that drug. "Amoxycillin" and "Amoxicillin" are two different medicines as
 * far as the join is concerned.
 *
 * That is the real failure mode in authoring drug data, and it is a
 * normalisation problem rather than a database problem. The vocabulary is
 * DERIVED from the pack rather than sourced from anywhere: the shipped pack
 * already carries ~100 distinct generics, and it grows as the clinician adds
 * rows. PRODUCT.md 11 is explicit that a national formulary on day one is the
 * fantasy that kills the project.
 *
 * (An external list was considered and rejected: DRAP has no bulk download, the
 * WHO EMLc publication is CC BY-NC-SA 3.0 IGO and so conflicts with the paid
 * tier in PRODUCT.md 14, and RxNorm is online-only against an offline-first app.
 * Individual INN names are public property; a curated list of them is somebody's
 * publication. See the plan for the full comparison.)
 */
import type { ContentPack, DosingEntry, FormularyEntry } from './pack.ts';

/**
 * Fold a generic name to a comparison key.
 * Case, surrounding space, internal runs of space, and the separators people
 * vary on (`+`, `/`, `-`) all collapse, because none of them distinguish two
 * real medicines from each other.
 */
export function normaliseGeneric(name: string): string {
  return name
    .toLowerCase()
    .replace(/[+/]/g, ' ')
    .replace(/[-‐-―]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface GenericUsage {
  /** the name as authored, in its most common casing */
  name: string;
  key: string;
  /** how many catalogue rows hang off this generic */
  brands: number;
  /** how many evidence rows hang off it */
  dosing: number;
}

/**
 * Every generic the pack knows about, with what hangs off each.
 *
 * `brands > 0 && dosing === 0` is the visible symptom of the join being
 * pointless for that drug -- brands exist, no dose will ever be suggested.
 * `dosing > 0 && brands === 0` is usually a typo on the dosing side.
 */
export function genericVocabulary(pack: ContentPack): GenericUsage[] {
  const byKey = new Map<string, GenericUsage>();

  const touch = (raw: string, field: 'brands' | 'dosing') => {
    const name = raw.trim();
    if (!name) return;
    const key = normaliseGeneric(name);
    const existing = byKey.get(key);
    if (existing) existing[field] += 1;
    else byKey.set(key, { name, key, brands: 0, dosing: 0, [field]: 1 } as GenericUsage);
  };

  for (const row of pack.formularySeed) touch(row.generic, 'brands');
  for (const row of pack.dosing) touch(row.generic, 'dosing');

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Generics with brands but no dosing evidence: no dose will ever be suggested. */
export function genericsWithoutDosing(pack: ContentPack): GenericUsage[] {
  return genericVocabulary(pack).filter((g) => g.brands > 0 && g.dosing === 0);
}

/** Dosing rows whose generic matches no catalogue row: almost always a typo. */
export function orphanedDosing(pack: ContentPack): DosingEntry[] {
  const known = new Set(pack.formularySeed.map((r) => normaliseGeneric(r.generic)));
  return pack.dosing.filter((row) => !known.has(normaliseGeneric(row.generic)));
}

/**
 * Levenshtein distance, capped.
 *
 * Bailing out once the best possible distance exceeds `max` keeps this cheap
 * enough to run against the whole vocabulary on every keystroke, which is the
 * only place the check is any use -- a warning after the row is saved is a
 * warning nobody acts on.
 */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let best = curr[0]!;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      best = Math.min(best, curr[j]!);
    }
    if (best > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

export interface NearDuplicate {
  /** the existing generic this one is suspiciously close to */
  existing: GenericUsage;
  distance: number;
  /** true when they normalise identically -- same drug, different spelling of it */
  identical: boolean;
}

/**
 * Existing generics that `candidate` is close enough to be a typo of.
 *
 * `identical: true` means the two fold to the same key, so they ARE the same
 * medicine written two ways and one of them will lose its dosing. That case is
 * an error, not a suggestion.
 */
export function nearDuplicates(
  candidate: string,
  vocabulary: GenericUsage[],
  maxDistance = 2,
): NearDuplicate[] {
  const key = normaliseGeneric(candidate);
  if (!key) return [];
  const out: NearDuplicate[] = [];
  for (const existing of vocabulary) {
    if (existing.name.trim() === candidate.trim()) continue; // it IS this one
    if (existing.key === key) {
      out.push({ existing, distance: 0, identical: true });
      continue;
    }
    const distance = editDistance(key, existing.key, maxDistance);
    if (distance <= maxDistance) out.push({ existing, distance, identical: false });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

/** Autocomplete over the pack's own vocabulary. Prefix matches first. */
export function suggestGenerics(
  query: string,
  vocabulary: GenericUsage[],
  limit = 8,
): GenericUsage[] {
  const q = normaliseGeneric(query);
  if (!q) return vocabulary.slice(0, limit);
  const starts: GenericUsage[] = [];
  const contains: GenericUsage[] = [];
  for (const entry of vocabulary) {
    if (entry.key.startsWith(q)) starts.push(entry);
    else if (entry.key.includes(q)) contains.push(entry);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Catalogue rows still to be reconciled against the DRAP registry. */
export function unreconciledBrands(pack: ContentPack): FormularyEntry[] {
  return pack.formularySeed.filter((row) => row.provenance !== 'DRAP' || !row.drapRegNo);
}
