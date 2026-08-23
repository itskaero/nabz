/**
 * Pack import / export.
 *
 * PLAIN JSON, NOT ENCRYPTED — and that is the opposite of `storage/backup.ts`
 * on purpose. A records backup holds patient data and is encrypted because it
 * must never be readable by anyone but the doctor. A pack holds drug names,
 * chip labels and phrase templates: it contains nothing clinical about anyone,
 * and its whole value is that a specialist can hand it to a colleague. Encrypting
 * it would protect nothing and prevent the one thing it is for.
 *
 * DESIGN.md 12: "Live JSON preview = exactly what the app imports." The string
 * this module produces for the preview is the string it writes to the file.
 */
import type { ContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { APP_CONTENT_VERSION } from '@data/provider.ts';

const MAGIC = 'NABZ-PACK';

export interface PackFile {
  magic: typeof MAGIC;
  version: string;
  exportedAt: string;
  /**
   * Written when the pack still had blocking problems at export time.
   *
   * Exporting used to be refused outright in that state, which sounds careful
   * and is the opposite: an unfinished pack is the NORMAL state of authoring,
   * and refusing to write a file is refusing to let someone save their work.
   * The gate that matters is Save -- publishing to the prescribing side -- and
   * that one stays closed. A file can always be written; it just says what it
   * is, and the importing side re-checks everything anyway.
   */
  draft?: boolean;
  pack: ContentPack;
  phrases: PackRegistry;
}

export function serialisePack(
  pack: ContentPack,
  phrases: PackRegistry,
  draft = false,
): string {
  const file: PackFile = {
    magic: MAGIC,
    version: APP_CONTENT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(draft ? { draft: true } : {}),
    pack,
    phrases,
  };
  return JSON.stringify(file, null, 2);
}

export function parsePackFile(text: string): PackFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const file = parsed as Partial<PackFile>;
  if (file.magic !== MAGIC) {
    throw new Error('That file is not a Nabz content pack.');
  }
  if (!file.pack || !file.phrases) {
    throw new Error('That pack file is missing its content.');
  }
  // Structural validation is the caller's job -- it holds the live validators
  // and can show the failures in place rather than as one thrown string.
  return file as PackFile;
}

/**
 * Which slice of a pack an import should replace.
 *
 * Importing used to be all-or-nothing: one file landed and the entire pack plus
 * both locale packs were overwritten. That makes the common case impossible --
 * taking a colleague's formulary while keeping your own advice and your own
 * exam chips, or pulling in a reviewed Urdu phrase set without losing the
 * medicines you have spent months reconciling against DRAP.
 */
export type PackSection = 'all' | 'formulary' | 'dosing' | 'phrases' | 'advice' | 'exam' | 'labs';

export const SECTION_LABEL: Record<PackSection, string> = {
  all: 'Everything',
  formulary: 'Medicines',
  dosing: 'Doses',
  phrases: 'Phrases',
  advice: 'Advice & red flags',
  exam: 'Exam chips',
  labs: 'Investigations',
};

/** How many rows a section carries, for telling someone what they are replacing. */
export function sectionSize(
  pack: ContentPack,
  phrases: PackRegistry,
  section: PackSection,
): number {
  const locales = Object.keys(phrases) as Array<keyof PackRegistry>;
  const first = locales[0];
  switch (section) {
    case 'formulary':
      return pack.formularySeed.length;
    case 'dosing':
      return pack.dosing.length;
    case 'phrases':
      return first ? Object.keys(phrases[first].templates).length : 0;
    case 'advice':
      return pack.advicePacks.tier1.length + pack.advicePacks.tier2.length;
    case 'exam':
      return Object.values(pack.findingsPalette).reduce((n, f) => n + f.length, 0);
    case 'labs':
      return Object.values(pack.labsPalette).reduce((n, l) => n + l.length, 0);
    default:
      return pack.formularySeed.length + pack.dosing.length;
  }
}

/**
 * Replace one section of the current content with the incoming file's.
 *
 * Everything outside that section is left exactly as it was. Two pairings are
 * deliberate and worth knowing:
 *
 *  - `advice` moves the tier lists AND the locale wording AND the red-flag
 *    sign-offs together. Splitting them would produce advice ids with no text,
 *    or reviewed wording attached to lines that are no longer offered.
 *  - `phrases` moves templates, vocabulary, units and printed labels, but NOT
 *    advice wording -- that belongs to the advice section, which has its own
 *    review gate. Importing "phrases" must not quietly re-sign a red flag.
 */
export function mergeSection(
  current: { pack: ContentPack; phrases: PackRegistry },
  incoming: { pack: ContentPack; phrases: PackRegistry },
  section: PackSection,
): { pack: ContentPack; phrases: PackRegistry } {
  if (section === 'all') {
    return { pack: incoming.pack, phrases: incoming.phrases };
  }

  const pack = structuredClone(current.pack);
  const phrases = structuredClone(current.phrases);
  const locales = Object.keys(phrases) as Array<keyof PackRegistry>;

  switch (section) {
    case 'formulary':
      pack.formularySeed = structuredClone(incoming.pack.formularySeed);
      break;

    case 'dosing':
      pack.dosing = structuredClone(incoming.pack.dosing);
      break;

    case 'exam':
      pack.examSystems = structuredClone(incoming.pack.examSystems);
      pack.findingsPalette = structuredClone(incoming.pack.findingsPalette);
      break;

    case 'labs':
      pack.labCategories = structuredClone(incoming.pack.labCategories);
      pack.labsPalette = structuredClone(incoming.pack.labsPalette);
      break;

    case 'advice':
      pack.advicePacks = structuredClone(incoming.pack.advicePacks);
      if (incoming.pack.redFlagReview) {
        pack.redFlagReview = structuredClone(incoming.pack.redFlagReview);
      } else {
        delete pack.redFlagReview;
      }
      for (const locale of locales) {
        const from = incoming.phrases[locale];
        if (from) phrases[locale].advice = structuredClone(from.advice);
      }
      break;

    case 'phrases':
      pack.sigTemplates = structuredClone(incoming.pack.sigTemplates);
      for (const locale of locales) {
        const from = incoming.phrases[locale];
        if (!from) continue;
        phrases[locale] = {
          ...phrases[locale],
          templates: structuredClone(from.templates),
          vocab: structuredClone(from.vocab),
          units: structuredClone(from.units),
          strings: structuredClone(from.strings),
          // advice is deliberately NOT taken here; it is the advice section's.
          advice: phrases[locale].advice,
        };
      }
      break;
  }

  return { pack, phrases };
}

export function packFilename(pack: ContentPack, now = new Date(), draft = false): string {
  const slug = pack.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  // The filename says it too, so an unfinished pack is recognisable in a folder
  // six months later without opening it.
  const mark = draft ? '-draft' : '';
  return `nabz-pack-${slug}${mark}-${now.toISOString().slice(0, 10)}.json`;
}

export function downloadPack(
  pack: ContentPack,
  phrases: PackRegistry,
  draft = false,
): void {
  const blob = new Blob([serialisePack(pack, phrases, draft)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = packFilename(pack, new Date(), draft);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
