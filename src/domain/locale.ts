/**
 * Locale identity. Deliberately tiny.
 *
 * Adding a language is a DATA change (a new locale pack in src/data/phrases),
 * never a code change. The only thing code may know about a locale is its id and
 * its writing direction. Anything else -- word order, plural forms, numeral
 * system, the verb that ends the sentence -- lives in the pack.
 * See CLAUDE.md 4.
 */

export type Locale = 'en' | 'ur-PK';

export type Direction = 'ltr' | 'rtl';

/**
 * Direction is declared by the locale pack, not inferred here; this map exists
 * only so code that has an id but not a loaded pack (routing, DOM `dir`) can
 * still ask. Keep it in sync with the packs.
 */
const DIRECTIONS: Record<Locale, Direction> = {
  en: 'ltr',
  'ur-PK': 'rtl',
};

export function directionOf(locale: Locale): Direction {
  return DIRECTIONS[locale];
}

export function isRtl(locale: Locale): boolean {
  return directionOf(locale) === 'rtl';
}

/** Locales the build ships. Order is display order. */
export const LOCALES: readonly Locale[] = ['en', 'ur-PK'] as const;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Which language(s) a section renders in. PRODUCT.md 6: this is a
 * per-section, language-by-audience app -- not a "bilingual app".
 */
export interface SectionLanguage {
  /** primary render locale */
  primary: Locale;
  /**
   * Second locale printed alongside. For medications this is NOT optional in
   * practice: PRODUCT.md rule 3.5 forbids printing a patient instruction in
   * Urdu alone, because the English is the safety net that lets the doctor or
   * pharmacist catch a bad translation.
   */
  secondary?: Locale;
}
