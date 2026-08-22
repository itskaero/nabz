/**
 * Advice composition, three tiers (PRODUCT.md 9).
 *
 * The tiers are not a convenience ladder, they are three different TRUST
 * levels, and this module's job is to keep them distinguishable all the way to
 * the paper:
 *
 *   tier 1  vetted composable template   -> both locales, reviewed Urdu
 *   tier 2  vetted red flag              -> both locales, library-only, no free text
 *   tier 3  the doctor's own prose       -> printed AS TYPED, in the language
 *                                           typed, NEVER machine-translated
 *
 * Tier 3 returning `null` for a locale it was not written in is the whole point
 * of rule 3.8: there is no code path that could produce an Urdu rendering of an
 * English free-text line, so an unverifiable translation can never reach a
 * patient. The renderer spans such an item across the bilingual grid instead.
 */
import type { Locale } from './locale.ts';
import type { AdviceItem } from './prescription.ts';
import type { PackRegistry, SlotValue } from './phrases.ts';
import { renderTemplate, textRun } from './phrases.ts';
import type { ComposedText } from './text.ts';
import { makeComposedText } from './text.ts';
import { directionOf } from './locale.ts';
import { formatNumber } from './pluralize/index.ts';

/** How much the app vouches for a line. Drives the non-colour safety channel. */
export type Vouch = 'vetted' | 'red-flag' | 'doctors-own';

export interface ComposedAdvice extends ComposedText {
  vouch: Vouch;
  /** true when this item has no rendering in the requested locale (tier 3) */
  passthrough: boolean;
}

export function vouchOf(item: AdviceItem): Vouch {
  switch (item.kind) {
    case 1:
      return 'vetted';
    case 2:
      return 'red-flag';
    case 3:
      return 'doctors-own';
  }
}

/**
 * Compose one advice item for one locale.
 * Returns null when the item simply does not exist in that locale, which for a
 * tier-3 line is correct behaviour, not a failure.
 */
export function composeAdvice(
  item: AdviceItem,
  locale: Locale,
  packs: PackRegistry,
): ComposedAdvice | null {
  const pack = packs[locale];

  if (item.kind === 3) {
    if (item.lang !== locale) return null;
    return {
      ...makeComposedText(locale, directionOf(locale), textRun(item.text, directionOf(locale))),
      vouch: 'doctors-own',
      passthrough: true,
    };
  }

  if (item.kind === 2) {
    const phrase = pack.advice.tier2[item.redFlagId];
    if (phrase === undefined) return null;
    return {
      ...makeComposedText(locale, pack.dir, textRun(phrase, pack.dir)),
      vouch: 'red-flag',
      passthrough: false,
    };
  }

  const template = pack.advice.tier1[item.templateId];
  if (template === undefined) return null;
  const slots: Record<string, SlotValue> = {};
  for (const [name, value] of Object.entries(item.slots)) {
    slots[name] =
      typeof value === 'number'
        ? [{ text: formatNumber(value, pack.numerals), dir: 'ltr', kind: 'value' }]
        : textRun(value, pack.dir);
  }
  const { runs } = renderTemplate(template, slots, pack.dir);
  return {
    ...makeComposedText(locale, pack.dir, runs),
    vouch: 'vetted',
    passthrough: false,
  };
}

/**
 * Advice in print order: red flags last and together, because they are the line
 * a frightened parent needs to find again at 2am, and scattering them through
 * routine advice buries them.
 */
export function orderAdvice(items: AdviceItem[]): AdviceItem[] {
  const rank = (i: AdviceItem) => (i.kind === 2 ? 1 : 0);
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/** Tier-2 items are library-selected by construction; this asserts it at runtime. */
export function assertNoFreeTextRedFlags(items: AdviceItem[]): void {
  for (const item of items) {
    if (item.kind === 2 && !item.redFlagId) {
      throw new Error(
        'red-flag advice must be library-selected: a mistranslated return precaution can kill a child (PRODUCT.md 9, tier 2)',
      );
    }
  }
}
