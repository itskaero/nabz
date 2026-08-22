/**
 * The locale-pack registry.
 *
 * Adding a language is exactly this: author a sibling pack file, import it,
 * add it to the record below, and add the locale id to `LOCALES` in
 * domain/locale.ts. No renderer, no component and no composition function
 * changes. If a new language ever needs more than that, the abstraction has
 * sprung a leak and it is the abstraction that should be fixed.
 */
import type { Locale } from '@domain/locale.ts';
import type { LocalePack, PackRegistry } from '@domain/phrases.ts';
import en from './en.ts';
import urPK from './ur-PK.ts';

export const packs: PackRegistry = {
  en,
  'ur-PK': urPK,
};

export function packFor(locale: Locale): LocalePack {
  return packs[locale];
}

/**
 * A fixed string from the pack, with {slot} substitution for simple labels.
 *
 * Takes the registry explicitly. The shipped packs are no longer necessarily
 * the live ones -- a doctor can have edited them in the pack builder -- and a
 * helper that silently reaches for the module-level default would print the
 * shipped labels onto a document composed from edited content.
 */
export function packStringFrom(
  registry: PackRegistry,
  locale: Locale,
  key: string,
  vars: Record<string, string | number> = {},
): string {
  const template = registry[locale].strings[key] ?? key;
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_m, name: string) =>
    name in vars ? String(vars[name]) : '',
  );
}

/** Convenience over the shipped packs. Only for surfaces with no live registry. */
export function packString(
  locale: Locale,
  key: string,
  vars: Record<string, string | number> = {},
): string {
  return packStringFrom(packs, locale, key, vars);
}

export { en, urPK };
