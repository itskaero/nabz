/**
 * Where the app gets its content from.
 *
 * Until now the pack and the locale packs were static imports. They still are
 * the FALLBACK, but an edited copy in IndexedDB wins when one exists, which is
 * what makes the pack builder more than a JSON editor.
 *
 * THE RULE THIS FILE ENFORCES: invalid stored content never runs. If what comes
 * back from storage fails validation, the shipped packs are used instead and
 * the app says so, loudly. A half-parsed phrase pack does not degrade into
 * "mostly fine" -- it prints the wrong language to a patient, or drops a dose
 * unit, and there is no way for the doctor to tell by looking. Falling back to
 * something known-good and complaining is the only safe response.
 */
import type { ContentPack } from '@domain/pack.ts';
import { packErrors } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { validatePacks } from '@domain/phrases.ts';
import { paediatrics } from './packs/index.ts';
import { packs as shippedPhrases } from './phrases/index.ts';
import type { StoredContent } from '@storage/db.ts';
import { loadContent, saveContent, clearContent } from '@storage/db.ts';

export const APP_CONTENT_VERSION = '1';

export interface ResolvedContent {
  pack: ContentPack;
  phrases: PackRegistry;
  /** true when this is the doctor's edited content rather than the shipped default */
  edited: boolean;
  /**
   * Why stored content was rejected, if it was. Non-empty here means the app is
   * running on the shipped packs despite an edited copy existing on the device.
   */
  rejected: string[];
}

export const shippedContent: ResolvedContent = {
  pack: paediatrics,
  phrases: shippedPhrases,
  edited: false,
  rejected: [],
};

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

let cached: ResolvedContent | null = null;

/**
 * Resolve the content the app should run on. Cached: content changes only when
 * the builder saves, and that path calls `publishContent`.
 */
export async function resolveContent(): Promise<ResolvedContent> {
  if (cached) return cached;
  let stored: StoredContent | undefined;
  try {
    stored = await loadContent();
  } catch {
    // A storage read failing is not a reason to have no app.
    stored = undefined;
  }
  if (!stored) {
    cached = shippedContent;
    return cached;
  }

  const rejected = contentErrors(stored.pack, stored.phrases);
  cached = rejected.length
    ? { ...shippedContent, rejected }
    : { pack: stored.pack, phrases: stored.phrases, edited: true, rejected: [] };
  return cached;
}

/** Save edited content and make it live. Refuses to publish content with errors. */
export async function publishContent(
  pack: ContentPack,
  phrases: PackRegistry,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors = contentErrors(pack, phrases);
  if (errors.length) return { ok: false, errors };
  await saveContent({
    pack,
    phrases,
    basedOn: { packId: pack.id, appVersion: APP_CONTENT_VERSION },
    updatedAt: new Date().toISOString(),
  });
  cached = { pack, phrases, edited: true, rejected: [] };
  return { ok: true };
}

/** Discard the edited copy and go back to what this build shipped with. */
export async function revertToShipped(): Promise<ResolvedContent> {
  await clearContent();
  cached = shippedContent;
  return cached;
}

/** Test seam. */
export function resetContentCache(): void {
  cached = null;
}

/** A deep copy to edit, so the builder never mutates the live objects. */
export function forkForEditing(content: ResolvedContent): {
  pack: ContentPack;
  phrases: PackRegistry;
} {
  return {
    pack: structuredClone(content.pack),
    phrases: structuredClone(content.phrases),
  };
}
