/**
 * Sig composition: structured MedicationLine -> a sentence, per locale.
 *
 * This is the wedge (PRODUCT.md 2). Everything else in the app is a faster way
 * to type; this is the only thing that produces something the patient can act
 * on. It is also the module where a bug is a dosing error rather than a typo,
 * so it is pure, framework-free and tested in isolation (CLAUDE.md 2).
 *
 * Composition order, per locale, every time:
 *   1. resolve each slot IN THE TARGET LOCALE   (never via another locale)
 *   2. pluralise quantities by the target locale's rule
 *   3. fill the target locale's OWN template, in its OWN word order
 *   4. isolate LTR islands for RTL hosts
 */
import type { Locale } from './locale.ts';
import type { Drug, MedicationLine, Sig } from './prescription.ts';
import type { LocalePack, PackRegistry, SlotValue } from './phrases.ts';
import { quantityRuns, renderTemplate, vocabRun } from './phrases.ts';
import type { ComposedText, TextRun } from './text.ts';
import { makeComposedText } from './text.ts';

/**
 * How a drug is displayed. Generic-first when we know the generic, because
 * PRODUCT.md 11 wants the document to teach generics and to travel: a
 * pharmacist in another city may not stock the brand.
 */
export function drugLabel(drug: Drug): string {
  const brand = drug.brand?.trim();
  const generic = drug.generic?.trim();
  const raw = drug.raw?.trim();
  if (brand && generic) return `${brand} (${generic})`;
  return brand || generic || raw || '';
}

/** Just the name, without the parenthetical generic. Used where space is tight. */
export function drugShortLabel(drug: Drug): string {
  return (drug.brand || drug.generic || drug.raw || '').trim();
}

/** Name + strength, as a pharmacist reads it off a shelf. */
export function drugFullLabel(drug: Drug): string {
  const name = drugLabel(drug);
  const strength = drug.strength?.trim();
  return strength ? `${name} ${strength}` : name;
}

export interface SigComposition extends ComposedText {
  /** required slots the doctor has not filled yet */
  missing: string[];
  /** true when every required slot resolved, i.e. this line is printable */
  complete: boolean;
}

/**
 * Build the slot table for one sig, in one locale.
 *
 * Note what is NOT here: no defaults, no "sensible" fallbacks, no borrowing a
 * value from a previous line. An unfilled slot stays unfilled and surfaces in
 * `missing`, because the alternative is the app quietly inventing a dose.
 * PRODUCT.md rule 3.2.
 */
function sigSlots(pack: LocalePack, sig: Sig, drug: Drug): Record<string, SlotValue> {
  const slots: Record<string, SlotValue> = {
    dose: quantityRuns(pack, sig.dose),
    duration: quantityRuns(pack, sig.duration),
    max: quantityRuns(pack, sig.max),
    frequency: vocabRun(pack, 'frequency', sig.frequency),
    timing: vocabRun(pack, 'timing', sig.timing),
    route: vocabRun(pack, 'route', sig.route),
    form: vocabRun(pack, 'form', drug.form),
    drug: latinRun(drugShortLabel(drug)),
    strength: latinRun(drug.strength),
  };
  for (const [slotId, entryId] of Object.entries(sig.slots ?? {})) {
    slots[slotId] = vocabRun(pack, slotId, entryId);
  }
  return slots;
}

/**
 * Drug names and strengths stay Latin in every locale -- that is what is printed
 * on the box the parent is holding, and transliterating it would break the match.
 * Marked `name`/`value` so the RTL renderer isolates them (DESIGN.md 6).
 */
function latinRun(text: string | undefined): SlotValue {
  const t = text?.trim();
  if (!t) return null;
  return [{ text: t, dir: 'ltr', kind: /\d/.test(t) ? 'value' : 'name' } satisfies TextRun];
}

export function composeSig(
  line: MedicationLine,
  locale: Locale,
  packs: PackRegistry,
): SigComposition {
  const pack = packs[locale];
  const template = pack.templates[line.sig.templateId];
  if (template === undefined) {
    // A template id with no entry in THIS locale is a pack bug, not a runtime
    // condition to paper over. Surface it rather than emitting the other
    // locale's sentence, which would print English where Urdu was promised.
    return {
      ...makeComposedText(locale, pack.dir, []),
      missing: [`template:${line.sig.templateId}`],
      complete: false,
    };
  }
  const { runs, missing } = renderTemplate(
    template,
    sigSlots(pack, line.sig, line.drug),
    pack.dir,
  );
  return {
    ...makeComposedText(locale, pack.dir, runs),
    missing,
    complete: missing.length === 0,
  };
}

/**
 * The full patient-facing line: which medicine, then what to do with it.
 * The joining punctuation is a pack string (`strings['patient.line']`) so a new
 * locale can put the name somewhere else without touching this file.
 */
export function composePatientLine(
  line: MedicationLine,
  locale: Locale,
  packs: PackRegistry,
): SigComposition {
  const pack = packs[locale];
  const sig = composeSig(line, locale, packs);
  const wrapper = pack.strings['patient.line'] ?? '{name}: {instruction}';
  const { runs } = renderTemplate(
    wrapper,
    {
      name: latinRun(drugFullLabel(line.drug)),
      instruction: sig.runs.length ? sig.runs : null,
    },
    pack.dir,
  );
  return {
    ...makeComposedText(locale, pack.dir, runs),
    missing: sig.missing,
    complete: sig.complete,
  };
}

/** Every locale a section prints in, composed together. */
export function composeSigAll(
  line: MedicationLine,
  locales: readonly Locale[],
  packs: PackRegistry,
): Record<string, SigComposition> {
  const out: Record<string, SigComposition> = {};
  for (const locale of locales) out[locale] = composeSig(line, locale, packs);
  return out;
}

/**
 * The once-weekly methotrexate check.
 *
 * A frequency picker and a template picker are independent controls, so
 * nothing stops a doctor choosing the right drug and the wrong frequency --
 * that mistake is how a fatal daily-methotrexate error happens, and it is
 * exactly the kind of silent, structurally-valid error the composer cannot
 * see on its own (the sig still renders a complete, well-formed sentence; it
 * is just the wrong one). This runs alongside composition, not inside it, so
 * it can be surfaced as a hard warning rather than folded into `missing`.
 *
 * Takes a lookup rather than the whole pack: `domain/` stays framework-free
 * and does not know about `data/packs`, which is where that lookup is built
 * (`packIndex(pack).dosingByGeneric`).
 */
export function weeklyOnlyViolation(
  line: MedicationLine,
  dosingByGeneric: Map<string, { weeklyOnly?: boolean }[]>,
): string | null {
  const generic = (line.drug.generic || line.drug.raw || '').trim().toLowerCase();
  if (!generic) return null;
  const rows = dosingByGeneric.get(generic);
  if (!rows?.some((r) => r.weeklyOnly)) return null;
  if (line.sig.frequency === 'WEEKLY') return null;
  const name = line.drug.generic || line.drug.raw || 'this medicine';
  return `${name} is dosed ONCE A WEEK, never daily. Set the frequency to "once a week" before signing -- a daily dose of this drug can be fatal.`;
}
