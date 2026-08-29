/**
 * Where the app gets its content from.
 *
 * Stage A turned this from "one pack, maybe edited" into a LIBRARY: every
 * pack the doctor has (shipped or imported) lives in `storage/db.ts`'s
 * `packs` store, and `resolveContent(packId)` resolves whichever one
 * `profile.packId` currently names. Switching packs is choosing a different
 * key in that library, never a merge -- see `data/packs/medicine.ts` for what
 * makes each entry self-contained.
 *
 * THE RULE THIS FILE ENFORCES, UNCHANGED: invalid stored content never runs.
 * If what comes back from storage fails validation, the shipped default for
 * that pack id is used instead and the app says so, loudly. A half-parsed
 * phrase pack does not degrade into "mostly fine" -- it prints the wrong
 * language to a patient, or drops a dose unit, and there is no way for the
 * doctor to tell by looking. Falling back to something known-good and
 * complaining is the only safe response.
 */
import type { ContentPack } from '@domain/pack.ts';
import { packErrors } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { validatePacks } from '@domain/phrases.ts';
import { DEFAULT_PACK_ID, contentPacks, isShippedPack, packById, phrasesForShippedPack } from './packs/index.ts';
import type { InstalledPack, StoredContent } from '@storage/db.ts';
import * as db from '@storage/db.ts';

export const APP_CONTENT_VERSION = '1';

export interface ResolvedContent {
  pack: ContentPack;
  phrases: PackRegistry;
  /** true when this is the doctor's edited copy rather than the shipped default */
  edited: boolean;
  /** the pack's own sign-off state -- badged as a draft wherever it appears */
  verified: boolean;
  /**
   * Why stored content was rejected, if it was. Non-empty here means the app is
   * running on the shipped default despite an edited copy existing on the device.
   */
  rejected: string[];
}

function shippedResolved(packId: string): ResolvedContent {
  const pack = packById(packId);
  return { pack, phrases: phrasesForShippedPack(packId), edited: false, verified: pack.verified, rejected: [] };
}

/** Structural check applied to anything before it is allowed to drive the app. */
export function contentErrors(pack: ContentPack, phrases: PackRegistry): string[] {
  const out: string[] = [];
  for (const issue of packErrors(pack)) out.push(`${issue.where}: ${issue.message}`);
  for (const issue of validatePacks(phrases)) {
    if (issue.severity === 'error') out.push(`${issue.where}: ${issue.message}`);
  }
  // A pack that offers an id no locale defines would render an empty line on
  // the patient's copy, which the per-layer validators cannot see on their own.
  const missing = (ids: string[], has: (id: string) => boolean, label: string) => {
    for (const id of ids) {
      if (!has(id)) out.push(`${label}.${id}: offered by the pack but no locale defines it`);
    }
  };
  const locales = Object.values(phrases);
  missing(pack.sigTemplates, (id) => locales.every((p) => p.templates[id] !== undefined), 'sigTemplates');
  missing(pack.advicePacks.tier1, (id) => locales.every((p) => p.advice.tier1[id] !== undefined), 'advice.tier1');
  missing(pack.advicePacks.tier2, (id) => locales.every((p) => p.advice.tier2[id] !== undefined), 'advice.tier2');
  return out;
}

const cache = new Map<string, ResolvedContent>();
let librarySeeded: Promise<void> | null = null;

/**
 * Populate the library on first use, WITHOUT ever clobbering a doctor's edit.
 *
 * Two things happen here, both additive-only:
 *  1. A legacy single-slot edited copy (pre-Stage-A, stored under the old
 *     `content`/`current` key) is migrated in as that pack's installed entry,
 *     so upgrading this build does not silently discard an hour of authoring.
 *  2. Every shipped pack id with no library entry yet gets seeded from its
 *     source default. This is what makes a NEW shipped pack (this build added
 *     `medicine`) appear for an existing install without touching whatever
 *     that doctor already has for `paediatrics`.
 */
function ensureLibrarySeeded(): Promise<void> {
  librarySeeded ??= (async () => {
    const existing = await db.listInstalledPacks();
    const have = new Set(existing.map((e) => e.id));

    if (!have.has(DEFAULT_PACK_ID)) {
      const legacy: StoredContent | undefined = await db.loadContent().catch(() => undefined);
      if (legacy) {
        await db.putInstalledPack({
          id: legacy.basedOn.packId || DEFAULT_PACK_ID,
          pack: legacy.pack,
          phrases: legacy.phrases,
          source: isShippedPack(legacy.basedOn.packId) ? 'shipped' : 'imported',
          verified: legacy.pack.verified,
          edited: true,
          installedAt: legacy.updatedAt,
          updatedAt: legacy.updatedAt,
        });
        have.add(legacy.basedOn.packId || DEFAULT_PACK_ID);
      }
    }

    for (const id of Object.keys(contentPacks)) {
      if (have.has(id)) continue;
      const shipped = shippedResolved(id);
      const now = new Date().toISOString();
      await db.putInstalledPack({
        id,
        pack: shipped.pack,
        phrases: shipped.phrases,
        source: 'shipped',
        verified: shipped.verified,
        edited: false,
        installedAt: now,
        updatedAt: now,
      });
    }
  })();
  return librarySeeded;
}

/**
 * Resolve the content the app should run on for one pack id. Cached per id:
 * content changes only when the builder publishes, an install/remove happens,
 * or the active pack switches -- and every one of those calls the matching
 * invalidation below.
 */
export async function resolveContent(packId: string = DEFAULT_PACK_ID): Promise<ResolvedContent> {
  const cached = cache.get(packId);
  if (cached) return cached;

  await ensureLibrarySeeded();
  const entry = await db.getInstalledPack(packId);
  if (!entry) {
    const resolved = shippedResolved(packId);
    cache.set(packId, resolved);
    return resolved;
  }

  const rejected = contentErrors(entry.pack, entry.phrases);
  const resolved: ResolvedContent = rejected.length
    ? { ...shippedResolved(packId), rejected }
    : { pack: entry.pack, phrases: entry.phrases, edited: entry.edited, verified: entry.verified, rejected: [] };
  cache.set(packId, resolved);
  return resolved;
}

/** Every pack in the library, for the Settings picker. Seeds first if needed. */
export async function listPacks(): Promise<InstalledPack[]> {
  await ensureLibrarySeeded();
  return db.listInstalledPacks();
}

/** Save edited content for ONE pack and make it live. Refuses content with errors. */
export async function publishContent(
  packId: string,
  pack: ContentPack,
  phrases: PackRegistry,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors = contentErrors(pack, phrases);
  if (errors.length) return { ok: false, errors };
  const prior = await db.getInstalledPack(packId);
  const now = new Date().toISOString();
  await db.putInstalledPack({
    id: packId,
    pack,
    phrases,
    source: prior?.source ?? (isShippedPack(packId) ? 'shipped' : 'imported'),
    verified: pack.verified,
    edited: true,
    installedAt: prior?.installedAt ?? now,
    updatedAt: now,
  });
  cache.set(packId, { pack, phrases, edited: true, verified: pack.verified, rejected: [] });
  return { ok: true };
}

/**
 * Add a pack from a `.nabzpack.json` file as a NEW library entry, keyed by
 * the file's own `pack.id`. If that id is already installed, this replaces
 * it -- the same "importing is destructive, the file said what it is about
 * to replace" contract the sectional importer already uses.
 */
export async function installPack(file: {
  pack: ContentPack;
  phrases: PackRegistry;
}): Promise<{ ok: true; id: string } | { ok: false; errors: string[] }> {
  const errors = contentErrors(file.pack, file.phrases);
  if (errors.length) return { ok: false, errors };
  const now = new Date().toISOString();
  await db.putInstalledPack({
    id: file.pack.id,
    pack: file.pack,
    phrases: file.phrases,
    source: isShippedPack(file.pack.id) ? 'shipped' : 'imported',
    verified: file.pack.verified,
    edited: true,
    installedAt: now,
    updatedAt: now,
  });
  cache.delete(file.pack.id);
  return { ok: true, id: file.pack.id };
}

/** Remove a pack from the library. Refuses to remove the last one standing. */
export async function removePack(packId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const all = await db.listInstalledPacks();
  if (all.length <= 1) {
    return { ok: false, reason: 'at least one content pack must stay installed' };
  }
  await db.deleteInstalledPack(packId);
  cache.delete(packId);
  return { ok: true };
}

/**
 * Discard one pack's edited copy and go back to what this build ships for it.
 * Only meaningful for a SHIPPED pack id -- an imported pack with no shipped
 * counterpart has nothing to revert to, and the builder does not offer this
 * button for one (see `isShippedPack`).
 */
export async function revertToShipped(packId: string = DEFAULT_PACK_ID): Promise<ResolvedContent> {
  await db.deleteInstalledPack(packId);
  cache.delete(packId);
  const resolved = shippedResolved(packId);
  // Re-seed immediately so the library still has an (unedited) entry for it.
  const now = new Date().toISOString();
  await db.putInstalledPack({
    id: packId,
    pack: resolved.pack,
    phrases: resolved.phrases,
    source: 'shipped',
    verified: resolved.verified,
    edited: false,
    installedAt: now,
    updatedAt: now,
  });
  cache.set(packId, resolved);
  return resolved;
}

/** Test seam. */
export function resetContentCache(): void {
  cache.clear();
  librarySeeded = null;
}

/**
 * A safe placeholder while the real content is still loading, and the
 * fallback whenever no packId is known yet. Always the shipped default, never
 * an edited copy -- the async resolve that follows is what may replace it.
 */
export function defaultResolvedContent(): ResolvedContent {
  return shippedResolved(DEFAULT_PACK_ID);
}

/** A deep copy to edit, so the builder never mutates the live objects. */
export function forkForEditing(content: { pack: ContentPack; phrases: PackRegistry }): {
  pack: ContentPack;
  phrases: PackRegistry;
} {
  return {
    pack: structuredClone(content.pack),
    phrases: structuredClone(content.phrases),
  };
}
