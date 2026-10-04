/**
 * Addons: how a clinic gets a capability without waiting for a release.
 *
 * WHAT AN ADDON IS, AND WHAT IT CAN NEVER BE
 * ------------------------------------------
 * A single JSON file carrying DATA AND ENABLEMENT, and no executable code.
 * `ModuleId` stays a closed union: an addon cannot invent a module, it can
 * only switch on one this build already ships tested code for. An addon that
 * names a module this build does not have is REFUSED at install, naming the
 * module -- not filtered out silently, because a file that quietly drops the
 * capability it was installed for is worse than one that will not install.
 *
 * That is the whole safety argument. Everything an addon turns on has a green
 * suite behind it (CLAUDE.md 6d); everything it adds is content the same
 * validators already police.
 *
 * AN ADDON MAY ADD, NEVER OVERWRITE
 * ---------------------------------
 * Lists are appended and de-duplicated. Maps refuse a key that already
 * exists. This is the rule that matters most: an addon that could silently
 * replace the wording of an existing tier-2 red flag would be a way to change
 * what a patient is told without anyone reviewing the change -- exactly what
 * `RedFlagReview` exists to prevent. A collision is a refusal, not a merge.
 *
 * WHERE IT IS APPLIED
 * -------------------
 * At RESOLVE time, as a layer over the installed pack, never by rewriting it
 * (`data/provider.ts`). Removing an addon is therefore trivially complete:
 * the base pack was never touched. The same two-layer split the builder
 * already uses applies -- refuse at install, where a human is present and can
 * act; degrade rather than block at runtime.
 */
import type { Locale } from './locale.ts';
import type { ContentPack, ModuleId, ScoreDefinition } from './pack.ts';
import type { DocumentKindId } from './documents/index.ts';
import type { PackRegistry } from './phrases.ts';
import { DOCUMENT_META } from './documents/index.ts';
import { MODULE_META } from './modules/index.ts';

export const ADDON_SCHEMA_VERSION = 1 as const;

export interface AddonManifest {
  id: string;
  title: string;
  /** free-form, shown to the doctor; not parsed or compared */
  version: string;
  /** who authored it and their credential -- the same shape ContentPack.author uses */
  author: { name: string; credential: string; updated: string };
  /** one line saying what installing this does, in the doctor's words */
  summary: string;
  /**
   * The pack ids this addon applies to. Empty means "whichever pack is
   * active", which is the normal case for a protocol addon.
   */
  appliesTo?: string[];
}

/**
 * What an addon contributes. Every field is additive and every one has an
 * explicit merge rule -- see `mergeAddon`. There is deliberately no
 * `Partial<ContentPack>` escape hatch: a deep partial merge over the whole
 * pack has ambiguous semantics for every array in it, and "ambiguous" is how
 * an addon ends up replacing a formulary somebody spent a week reconciling.
 */
export interface AddonContributions {
  /** modules to switch on. Refused if this build has no code for one. */
  modules?: ModuleId[];
  /** document kinds to offer. Same rule. */
  documents?: DocumentKindId[];
  /** per-module configuration. Replaces wholesale, per module key. */
  moduleConfig?: ContentPack['moduleConfig'];
  /** clinical scores to offer. Appended; a duplicate id is a refusal. */
  scores?: ScoreDefinition[];
  /** advice ids to offer, in offer order. Appended. */
  advice?: { tier1?: string[]; tier2?: string[] };
  /**
   * The wording behind those ids, per locale. A key that already exists in
   * the pack is a REFUSAL -- see the header. Both locales or neither: a
   * half-translated line prints the wrong language to a patient.
   */
  adviceText?: Partial<
    Record<Locale, { tier1?: Record<string, string>; tier2?: Record<string, string> }>
  >;
  /** printed-document labels and fixed UI strings, per locale. Same refusal. */
  strings?: Partial<Record<Locale, Record<string, string>>>;
}

export interface AddonSignature {
  /** the signer's public key: base64 SPKI, ECDSA P-256 */
  publicKey: string;
  /** base64 ECDSA-SHA256 over `canonical(manifest, contributes)` */
  signature: string;
  signedAt: string;
}

export interface Addon {
  schema: typeof ADDON_SCHEMA_VERSION;
  manifest: AddonManifest;
  contributes: AddonContributions;
  signature?: AddonSignature;
}

export interface AddonIssue {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

// --- validation ------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Is this file an addon at all? Structural only -- what it would DO to a
 * specific pack is `mergeAddon`'s question.
 */
export function parseAddon(raw: unknown): { ok: true; addon: Addon } | { ok: false; errors: AddonIssue[] } {
  const errors: AddonIssue[] = [];
  const bad = (where: string, message: string) => errors.push({ severity: 'error', where, message });

  if (!isObject(raw)) {
    return { ok: false, errors: [{ severity: 'error', where: 'file', message: 'not an object' }] };
  }
  if (raw['schema'] !== ADDON_SCHEMA_VERSION) {
    bad('schema', `expected schema ${ADDON_SCHEMA_VERSION}, found ${String(raw['schema'])}`);
  }
  const manifest = raw['manifest'];
  if (!isObject(manifest)) bad('manifest', 'missing');
  else {
    for (const key of ['id', 'title', 'version', 'summary'] as const) {
      if (typeof manifest[key] !== 'string' || !(manifest[key] as string).trim()) {
        bad(`manifest.${key}`, 'missing');
      }
    }
    const author = manifest['author'];
    // Same discipline a pack's author block carries: an addon that changes
    // what a patient is told says who wrote it.
    if (!isObject(author) || typeof author['name'] !== 'string' || !author['name'].trim()) {
      bad('manifest.author.name', 'an addon must say who wrote it');
    }
  }
  if (!isObject(raw['contributes'])) bad('contributes', 'missing');

  if (errors.length) return { ok: false, errors };
  return { ok: true, addon: raw as unknown as Addon };
}

/**
 * What this addon would do to THIS build and THIS content. The install gate.
 *
 * Returns errors and warnings separately, because they mean different things:
 * an error refuses the install; a warning installs and is badged.
 */
export function validateAddon(
  addon: Addon,
  pack: ContentPack,
  phrases: PackRegistry,
): AddonIssue[] {
  const issues: AddonIssue[] = [];
  const c = addon.contributes;

  // --- the closed-union gate. The property this whole design exists to buy.
  for (const id of c.modules ?? []) {
    if (!MODULE_META[id]) {
      issues.push({
        severity: 'error',
        where: `contributes.modules.${id}`,
        message: `this version of the app has no "${id}" module. An addon carries data and settings, never code, so it cannot bring one with it — you need a build that has it.`,
      });
    }
  }
  for (const id of c.documents ?? []) {
    if (!DOCUMENT_META[id]) {
      issues.push({
        severity: 'error',
        where: `contributes.documents.${id}`,
        message: `this version of the app has no "${id}" document kind`,
      });
    }
  }

  // --- a module switched on must arrive configured, when it needs to be.
  // The addon is the only chance to supply it; the pack validator would
  // otherwise refuse the merged result with nothing to point at.
  for (const id of c.modules ?? []) {
    if (id === 'malnutrition' && !c.moduleConfig?.malnutrition && !pack.moduleConfig?.malnutrition) {
      issues.push({
        severity: 'error',
        where: 'contributes.moduleConfig.malnutrition',
        message:
          'this addon switches on the malnutrition module but names no protocol, and the pack has none either',
      });
    }
    if (id === 'growth' && !c.moduleConfig?.growth && !pack.moduleConfig?.growth) {
      issues.push({
        severity: 'error',
        where: 'contributes.moduleConfig.growth',
        message: 'this addon switches on the growth module but does not configure it',
      });
    }
  }

  // --- add, never overwrite.
  for (const score of c.scores ?? []) {
    if ((pack.scores ?? []).some((s) => s.id === score.id)) {
      issues.push({
        severity: 'error',
        where: `contributes.scores.${score.id}`,
        message: 'the pack already has a score with this id. An addon may add, never replace.',
      });
    }
    if (!score.reference?.trim()) {
      issues.push({
        severity: 'error',
        where: `contributes.scores.${score.id}.reference`,
        message: 'a score with no citation is a number with no provenance',
      });
    }
  }

  const locales = Object.keys(phrases) as Locale[];

  for (const locale of locales) {
    const text = c.adviceText?.[locale];
    for (const tier of ['tier1', 'tier2'] as const) {
      for (const id of Object.keys(text?.[tier] ?? {})) {
        if (phrases[locale].advice[tier][id] !== undefined) {
          issues.push({
            severity: 'error',
            where: `contributes.adviceText.${locale}.${tier}.${id}`,
            message:
              'this wording already exists. An addon that could replace it would be a way to change what a patient is told with nobody reviewing it.',
          });
        }
      }
    }
    for (const key of Object.keys(c.strings?.[locale] ?? {})) {
      if (phrases[locale].strings[key] !== undefined) {
        issues.push({
          severity: 'error',
          where: `contributes.strings.${locale}.${key}`,
          message: 'this string already exists. An addon may add, never replace.',
        });
      }
    }
  }

  // --- every offered advice id must arrive with wording in EVERY locale.
  const offered = [
    ...(c.advice?.tier1 ?? []).map((id) => ['tier1', id] as const),
    ...(c.advice?.tier2 ?? []).map((id) => ['tier2', id] as const),
  ];
  for (const [tier, id] of offered) {
    for (const locale of locales) {
      const fromAddon = c.adviceText?.[locale]?.[tier]?.[id];
      const fromPack = phrases[locale].advice[tier][id];
      if (fromAddon === undefined && fromPack === undefined) {
        issues.push({
          severity: 'error',
          where: `contributes.advice.${tier}.${id}`,
          message: `offered but not written in "${locale}". A half-translated line prints the wrong language to a patient.`,
        });
      }
    }
  }

  // --- tier-2 wording that nobody has signed off.
  // A warning, not an error, and deliberately so: the builder is where a
  // human can sign off, and that is where `useDraft` escalates this to
  // blocking. Refusing the install instead would leave a clinic unable to
  // take a protocol their own ministry published.
  for (const id of c.advice?.tier2 ?? []) {
    if (!addon.signature) {
      issues.push({
        severity: 'warning',
        where: `contributes.advice.tier2.${id}`,
        message:
          'a return precaution from an unsigned addon. Nothing automatic can catch a wrong translation — read it in the builder before using it.',
      });
      break;
    }
  }

  /*
    Replacing a module's configuration is allowed, and it is the one place the
    "add, never overwrite" rule bends. Swapping a clinic from the national
    MUAC-only criteria to WHO 2023 is a legitimate thing to want, and it is a
    SETTING rather than a sentence a patient reads.

    But it changes who gets classified, so it is never silent. The install says
    which protocol is being replaced and the doctor decides.
  */
  for (const key of Object.keys(c.moduleConfig ?? {}) as Array<keyof NonNullable<ContentPack['moduleConfig']>>) {
    if (pack.moduleConfig?.[key]) {
      issues.push({
        severity: 'warning',
        where: `contributes.moduleConfig.${key}`,
        message: `this replaces the "${key}" settings the pack already has. Different criteria classify different patients — check which protocol you want.`,
      });
    }
  }

  if (!addon.signature) {
    issues.push({
      severity: 'warning',
      where: 'signature',
      message: 'this addon is not signed, so there is no way to tell who really wrote it',
    });
  }

  return issues;
}

export const addonErrors = (issues: AddonIssue[]): AddonIssue[] =>
  issues.filter((i) => i.severity === 'error');

// --- merging ---------------------------------------------------------------

const union = <T>(base: readonly T[] | undefined, extra: readonly T[] | undefined): T[] => [
  ...new Set([...(base ?? []), ...(extra ?? [])]),
];

/**
 * Apply an addon over content, without mutating either input.
 *
 * Pure and total: it assumes `validateAddon` has already refused anything
 * that should not be here, and it never drops a contribution silently. The
 * caller validates the RESULT too -- see `data/provider.ts` -- so a merge that
 * somehow produces an invalid pack falls back rather than running.
 */
export function mergeAddon(
  pack: ContentPack,
  phrases: PackRegistry,
  addon: Addon,
): { pack: ContentPack; phrases: PackRegistry } {
  const c = addon.contributes;

  const merged: ContentPack = {
    ...pack,
    modules: union(pack.modules, c.modules),
    ...(c.documents?.length || pack.documents
      ? { documents: union(pack.documents, c.documents) }
      : {}),
    ...(c.moduleConfig
      ? { moduleConfig: { ...pack.moduleConfig, ...c.moduleConfig } }
      : {}),
    ...(c.scores?.length ? { scores: [...(pack.scores ?? []), ...c.scores] } : {}),
    advicePacks: {
      tier1: union(pack.advicePacks.tier1, c.advice?.tier1),
      tier2: union(pack.advicePacks.tier2, c.advice?.tier2),
    },
  };

  const nextPhrases = {} as PackRegistry;
  for (const locale of Object.keys(phrases) as Locale[]) {
    const base = phrases[locale];
    const text = c.adviceText?.[locale];
    nextPhrases[locale] = {
      ...base,
      strings: { ...base.strings, ...(c.strings?.[locale] ?? {}) },
      advice: {
        tier1: { ...base.advice.tier1, ...(text?.tier1 ?? {}) },
        tier2: { ...base.advice.tier2, ...(text?.tier2 ?? {}) },
      },
    };
  }

  return { pack: merged, phrases: nextPhrases };
}

/** Apply several addons in install order. */
export function mergeAddons(
  pack: ContentPack,
  phrases: PackRegistry,
  addons: readonly Addon[],
): { pack: ContentPack; phrases: PackRegistry } {
  return addons.reduce(
    (acc, addon) => mergeAddon(acc.pack, acc.phrases, addon),
    { pack, phrases },
  );
}

/** Does this addon apply to this pack? An empty `appliesTo` means any. */
export function appliesTo(addon: Addon, packId: string): boolean {
  const list = addon.manifest.appliesTo;
  return !list?.length || list.includes(packId);
}
