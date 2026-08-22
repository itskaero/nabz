/**
 * Per-locale number grammar.
 *
 * "for 1 days" is the kind of thing that makes a doctor stop trusting the whole
 * document, and trust is the entire product. So a Quantity is never interpolated
 * bare: it is resolved through the locale's plural rule against a unit whose
 * forms the locale pack supplies. See CLAUDE.md 4.
 *
 * Two separable concerns live here:
 *   1. WHICH plural category a count selects  -- a rule, per locale, in code
 *      (it is a grammar fact about the language, and is closed-form);
 *   2. WHAT STRING that category maps to      -- data, in the locale pack
 *      (open-ended: every new unit is a new noun to inflect).
 *
 * Adding a locale therefore adds one rule here and one pack file in src/data.
 * The rule is a pure function of a number; it never sees clinical content.
 */
import type { Locale } from '../locale.ts';

/** CLDR plural categories. Not every locale uses every one. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** A unit noun's forms in one locale. `other` is the required fallback. */
export type PluralForms = Partial<Record<PluralCategory, string>> & {
  other: string;
};

export type PluralRule = (count: number) => PluralCategory;

/**
 * CLDR `en`: one when i = 1 and v = 0 (integer one), otherwise other.
 * "1 day", "0 days", "1.0 days", "5 days".
 */
const en: PluralRule = (count) => (count === 1 && Number.isInteger(count) ? 'one' : 'other');

/**
 * CLDR `ur`: same category split as English (one when i = 1 and v = 0).
 *
 * The categories coinciding does NOT mean the strings coincide, and this is the
 * trap the code must not fall into: Urdu nouns inflect differently from English
 * ones, and differently from each other. dn (day) is invariant -- "1 dn",
 * "5 dn" -- while goli (tablet) is not: "1 goli" but "5 goliyan". The rule
 * below only picks a category; the pack decides whether the two forms differ.
 */
const urPK: PluralRule = (count) => (count === 1 && Number.isInteger(count) ? 'one' : 'other');

const RULES: Record<Locale, PluralRule> = {
  en,
  'ur-PK': urPK,
};

export function pluralCategory(locale: Locale, count: number): PluralCategory {
  return RULES[locale](count);
}

/** Select a unit's form for `count`, falling back to `other` per CLDR. */
export function selectPluralForm(
  locale: Locale,
  count: number,
  forms: PluralForms,
): string {
  const category = pluralCategory(locale, count);
  return forms[category] ?? forms.other;
}

/**
 * Numeral systems a locale pack may declare.
 *  - `latn`    : 0-9. The default for ur-PK too, deliberately: Pakistani
 *                pharmacy labels and packaging use Latin digits, and a dose is
 *                the last place to introduce an unfamiliar glyph set.
 *  - `arabext` : Eastern Arabic-Indic digits, for doctors who want them.
 */
export type NumeralSystem = 'latn' | 'arabext';

const ARABEXT_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Format a clinical number. Never locale-groups (no "1,000") -- a thousands
 * separator in a dose field is a misreading waiting to happen -- and never
 * shows trailing zeros it was not given.
 */
export function formatNumber(value: number, numerals: NumeralSystem = 'latn'): string {
  if (!Number.isFinite(value)) return '';
  // Round to 3dp to kill float dust (0.30000000000000004 ml), then trim.
  const rounded = Math.round(value * 1000) / 1000;
  const latin = String(rounded);
  if (numerals === 'latn') return latin;
  return latin.replace(/[0-9]/g, (d) => ARABEXT_DIGITS[Number(d)] ?? d);
}
