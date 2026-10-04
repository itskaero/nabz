/**
 * What this template actually says, once it is a sentence.
 *
 * THE PROBLEM THIS EXISTS TO FIX
 * ------------------------------
 * The builder asks an author to write a template -- `{administer} {dose}
 * {frequency}[ for {duration}]` -- and then asks them to vouch for it. Until
 * now it never showed them the thing they were vouching for. They edited a
 * string with holes in it and signed off a sentence they had never read.
 *
 * That is a strange gap in an app whose entire premise is that the Urdu is
 * authored rather than derived: the one screen where a human is meant to check
 * the Urdu was the one screen that never rendered it.
 *
 * WHY A SPECIMEN AND NOT A REAL PRESCRIPTION
 * ------------------------------------------
 * Filling the slots needs values, and inventing clinical ones would be the app
 * doing exactly what rule 3.2 forbids. So the specimen is deliberately,
 * visibly fake -- a made-up drug and round numbers -- and it draws its slot
 * WORDS from the pack's own vocabulary, so what the author reads is their own
 * Urdu in their own word order. Nothing here can reach a patient: it is
 * assembled in memory for display and never stored.
 */
import type { Locale } from '@domain/locale.ts';
import { LOCALES } from '@domain/locale.ts';
import type { AdviceItem, MedicationLine, Sig } from '@domain/prescription.ts';
import type { LocalePack, PackRegistry } from '@domain/phrases.ts';
import { templateSlots } from '@domain/phrases.ts';
import { composeSig } from '@domain/sig.ts';
import { composeAdvice } from '@domain/advice.ts';

/**
 * Obviously not a real medicine, and that is the point: an author must never
 * mistake a specimen for a row in their formulary.
 */
const SPECIMEN_DRUG = {
  brand: 'Specimen',
  generic: 'specimen',
  strength: '125mg/5ml',
  form: 'syrup',
} as const;

/** The first entry a vocabulary offers, so the specimen speaks the pack's own words. */
function firstVocab(pack: LocalePack, slotId: string): string | undefined {
  return Object.keys(pack.vocab[slotId] ?? {})[0];
}

/**
 * A dose unit that suits the template, so a tablet template does not read
 * "5 ml".
 *
 * COSMETIC, and only a hint. The template does not declare a unit -- the
 * doctor picks one per prescription -- so this reads the id, which is a
 * convention rather than a contract. A pack author who names their templates
 * something else simply gets millilitres, which is honest: the preview is for
 * reading the WORDS, and the number beside them is scaffolding.
 */
function specimenDose(templateId: string, pack: LocalePack): { value: number; unit: string } {
  const has = (unit: string) => pack.units[unit] !== undefined;
  const id = templateId.toLowerCase();
  if (id.includes('solid') && has('tablet')) return { value: 1, unit: 'tablet' };
  if (id.includes('sachet') && has('sachet')) return { value: 1, unit: 'sachet' };
  if (id.includes('drops') && has('drop')) return { value: 2, unit: 'drop' };
  if (id.includes('inhaled') && has('puff')) return { value: 2, unit: 'puff' };
  return { value: 5, unit: has('ml') ? 'ml' : (Object.keys(pack.units)[0] ?? 'ml') };
}

/**
 * A sig that fills whatever slots the template declares, and nothing else.
 *
 * Built from the EN pack's vocabulary ids -- ids are shared across locales by
 * construction (`validatePacks` refuses a vocabulary present in one locale and
 * not the other), so the same sig renders in both.
 */
export function specimenSig(templateId: string, template: string, en: LocalePack): Sig {
  const slots = new Set(templateSlots(template));
  const extra: Record<string, string> = {};

  // Slots that are not one of the known fields are pack-declared vocabularies
  // -- `administer` is the standard one. Fill them from the pack.
  for (const slot of slots) {
    if (['dose', 'duration', 'max', 'frequency', 'timing', 'route', 'form', 'drug', 'strength'].includes(slot)) {
      continue;
    }
    const entry = firstVocab(en, slot);
    if (entry) extra[slot] = entry;
  }

  return {
    templateId,
    dose: specimenDose(templateId, en),
    frequency: firstVocab(en, 'frequency') ?? 'TID',
    ...(slots.has('timing') ? { timing: firstVocab(en, 'timing') ?? 'after_food' } : {}),
    ...(slots.has('duration') ? { duration: { value: 5, unit: 'day' } } : {}),
    ...(slots.has('max') ? { max: { value: 4, unit: 'dose' } } : {}),
    ...(slots.has('route') ? { route: firstVocab(en, 'route') ?? 'oral' } : {}),
    ...(Object.keys(extra).length ? { slots: extra } : {}),
  };
}

export interface Rendering {
  locale: Locale;
  /** the sentence, with bidi isolates already inserted; safe for the DOM */
  plain: string;
  /** slots the template asked for that the pack could not fill */
  missing: string[];
  /** false when a slot is unresolved -- a template that cannot print */
  complete: boolean;
}

/**
 * Render one sig template in every locale.
 *
 * `missing` is the useful half. A template whose Urdu asks for a slot the
 * vocabulary does not define renders with a hole in it, and the author sees
 * the hole rather than a validator message about an id.
 */
export function renderSigTemplate(
  templateId: string,
  phrases: PackRegistry,
): Rendering[] {
  const en = phrases.en;
  const template = en.templates[templateId];
  const sig = specimenSig(templateId, template ?? '', en);
  const line: MedicationLine = { id: 'specimen', drug: { ...SPECIMEN_DRUG }, sig };

  return LOCALES.map((locale) => {
    if (phrases[locale].templates[templateId] === undefined) {
      return { locale, plain: '', missing: [`template:${templateId}`], complete: false };
    }
    const out = composeSig(line, locale, phrases);
    return { locale, plain: out.plain, missing: out.missing, complete: out.complete };
  });
}

/**
 * Render a tier-1 advice template in every locale.
 *
 * Tier-1 lines take numeric slots the doctor chooses (`{n}` days, `{n}`
 * doses). The specimen uses 2, which is small enough to read as an example
 * rather than as a recommendation.
 */
export function renderAdviceTemplate(templateId: string, phrases: PackRegistry): Rendering[] {
  const template = phrases.en.advice.tier1[templateId] ?? '';
  const slots: Record<string, string | number> = {};
  for (const slot of templateSlots(template)) slots[slot] = 2;
  const item: AdviceItem = { kind: 1, id: 'specimen', templateId, slots };

  return LOCALES.map((locale) => {
    const out = composeAdvice(item, locale, phrases);
    if (!out) {
      return { locale, plain: '', missing: [`advice.tier1:${templateId}`], complete: false };
    }
    return { locale, plain: out.plain, missing: [], complete: out.plain.trim().length > 0 };
  });
}

/**
 * Render a tier-2 red flag in every locale. No slots -- tier 2 is library-only
 * prose, which is exactly why it is the tier that carries a sign-off.
 */
export function renderRedFlag(redFlagId: string, phrases: PackRegistry): Rendering[] {
  const item: AdviceItem = { kind: 2, id: 'specimen', redFlagId };
  return LOCALES.map((locale) => {
    const out = composeAdvice(item, locale, phrases);
    if (!out) {
      return { locale, plain: '', missing: [`advice.tier2:${redFlagId}`], complete: false };
    }
    return { locale, plain: out.plain, missing: [], complete: out.plain.trim().length > 0 };
  });
}
