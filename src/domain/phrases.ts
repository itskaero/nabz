/**
 * The locale pack: shape, template grammar, resolver, and validation.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE (CLAUDE.md 4, PRODUCT.md 7):
 * each locale owns its OWN template string with its OWN word order. `en` and
 * `ur-PK` for the same templateId are independent authored sentences. Nothing
 * here can derive one from the other, and there is deliberately no code path
 * that could -- no token reversal, no mirroring, no fallback that borrows
 * another locale's ordering.
 *
 * Template grammar (small on purpose):
 *   {slot}        required slot; unresolved => the template fails validation
 *   [ ... ]       optional group; emitted only if EVERY slot inside resolved.
 *                 The brackets are what let each locale attach its own
 *                 particle to a slot -- English "for 5 days", Urdu "5 dn tak"
 *                 -- and drop the particle with the slot.
 */
import type { Direction, Locale } from './locale.ts';
import type { PluralForms, NumeralSystem } from './pluralize/index.ts';
import { formatNumber, selectPluralForm } from './pluralize/index.ts';
import type { Quantity } from './prescription.ts';
import type { RunKind, TextRun } from './text.ts';

/** Vocabulary namespaces a template may draw slots from. Data-extensible. */
export type VocabularyId = string;

export interface LocalePack {
  locale: Locale;
  dir: Direction;
  numerals: NumeralSystem;
  /** templateId -> the authored sentence for THIS locale */
  templates: Record<string, string>;
  /** vocabularyId -> entryId -> phrase. e.g. vocab.frequency.TID */
  vocab: Record<VocabularyId, Record<string, string>>;
  /** unitId -> plural forms in this locale */
  units: Record<string, PluralForms>;
  advice: {
    /** tier-1 composable templates; same grammar as sig templates */
    tier1: Record<string, string>;
    /** tier-2 red flags; fixed sentences, no slots, library-only */
    tier2: Record<string, string>;
  };
  /** printed-document labels and other fixed UI strings */
  strings: Record<string, string>;
}

export type PackRegistry = Record<Locale, LocalePack>;

// --- template parsing ------------------------------------------------------

type Node =
  | { t: 'lit'; text: string }
  | { t: 'slot'; name: string }
  | { t: 'group'; nodes: Node[] };

const TOKEN = /\{([a-zA-Z0-9_.]+)\}|\[|\]/g;

export function parseTemplate(template: string): Node[] {
  const root: Node[] = [];
  const stack: Node[][] = [root];
  let last = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  const push = (node: Node) => stack[stack.length - 1]!.push(node);
  const lit = (text: string) => {
    if (text) push({ t: 'lit', text });
  };

  while ((m = TOKEN.exec(template)) !== null) {
    lit(template.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined) push({ t: 'slot', name: m[1] });
    else if (m[0] === '[') {
      const group: Node = { t: 'group', nodes: [] };
      push(group);
      stack.push(group.nodes);
    } else {
      if (stack.length === 1) throw new Error(`unbalanced ] in template: ${template}`);
      stack.pop();
    }
  }
  lit(template.slice(last));
  if (stack.length !== 1) throw new Error(`unclosed [ in template: ${template}`);
  return root;
}

/** Every slot the template references, optional ones included. */
export function templateSlots(template: string): string[] {
  const out = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.t === 'slot') out.add(n.name);
      else if (n.t === 'group') walk(n.nodes);
    }
  };
  walk(parseTemplate(template));
  return [...out].sort();
}

/** Slots that are NOT inside an optional group, i.e. must resolve. */
export function requiredSlots(template: string): string[] {
  const out = new Set<string>();
  for (const n of parseTemplate(template)) if (n.t === 'slot') out.add(n.name);
  return [...out].sort();
}

// --- slot values -----------------------------------------------------------

/** A resolved slot is already runs, because a quantity is two runs, not one. */
export type SlotValue = TextRun[] | null;

export function textRun(text: string, dir: Direction, kind: RunKind = 'prose'): TextRun[] {
  return text ? [{ text, dir, kind }] : [];
}

/** Look a phrase up in a vocabulary. Returns null when absent -- never guesses. */
export function vocabRun(
  pack: LocalePack,
  vocabulary: VocabularyId,
  entryId: string | undefined,
): SlotValue {
  if (!entryId) return null;
  const phrase = pack.vocab[vocabulary]?.[entryId];
  return phrase ? textRun(phrase, pack.dir) : null;
}

/**
 * Compose a Quantity into runs: the NUMBER as an LTR clinical value, the UNIT
 * as prose in the locale's own direction, pluralised by the locale's rule.
 *
 * Splitting them is the point. It keeps "5" in mono and unbreakable (DESIGN.md
 * 4), lets ur-PK print a real Urdu unit noun rather than a Latin abbreviation,
 * and gives the bidi layer a single small LTR island to isolate instead of a
 * mixed blob.
 */
export function quantityRuns(pack: LocalePack, q: Quantity | undefined): SlotValue {
  if (!q || !Number.isFinite(q.value)) return null;
  const forms: PluralForms | undefined = pack.units[q.unit];
  const number = formatNumber(q.value, pack.numerals);
  const runs: TextRun[] = [{ text: number, dir: 'ltr', kind: 'value' }];
  if (forms) {
    const unit = selectPluralForm(pack.locale, q.value, forms);
    if (unit) runs.push({ text: ' ', dir: pack.dir, kind: 'prose' }, { text: unit, dir: pack.dir, kind: 'prose' });
  } else {
    // Unknown unit id: print it verbatim rather than dropping a dose unit.
    // A missing unit is far more dangerous than an untranslated one.
    runs.push({ text: ' ' + q.unit, dir: 'ltr', kind: 'value' });
  }
  return runs;
}

// --- rendering -------------------------------------------------------------

export interface RenderResult {
  runs: TextRun[];
  /** required slots that had no value; a non-empty list means "do not print" */
  missing: string[];
}

export function renderTemplate(
  template: string,
  slots: Record<string, SlotValue>,
  /** direction of the LITERAL text in the template -- i.e. the locale's own */
  dir: Direction,
): RenderResult {
  const missing: string[] = [];
  const out: TextRun[] = [];

  const emit = (nodes: Node[], into: TextRun[], optional: boolean): boolean => {
    let complete = true;
    for (const n of nodes) {
      if (n.t === 'lit') into.push({ text: n.text, dir, kind: 'prose' });
      else if (n.t === 'slot') {
        const value = slots[n.name];
        if (value === undefined || value === null || value.length === 0) {
          complete = false;
          if (!optional) missing.push(n.name);
        } else into.push(...value);
      } else {
        const inner: TextRun[] = [];
        if (emit(n.nodes, inner, true)) into.push(...inner);
      }
    }
    return complete;
  };

  emit(parseTemplate(template), out, false);
  return { runs: collapse(out), missing };
}

/**
 * Literal runs carry the template's own whitespace. Merge adjacent literals and
 * squeeze runs of spaces so a dropped optional group cannot leave "for  5 days"
 * or a space before a full stop.
 */
function collapse(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && prev.dir === run.dir && prev.kind === run.kind) prev.text += run.text;
    else merged.push({ ...run });
  }
  const out: TextRun[] = [];
  for (const run of merged) {
    const text = run.text.replace(/[ \t]{2,}/g, ' ');
    if (text) out.push({ ...run, text });
  }
  // trim leading/trailing space and tidy space-before-punctuation
  const first = out[0];
  if (first) first.text = first.text.replace(/^\s+/, '');
  const last = out[out.length - 1];
  if (last) last.text = last.text.replace(/\s+$/, '');
  for (let i = 1; i < out.length; i += 1) {
    const cur = out[i]!;
    const prev = out[i - 1]!;
    if (/^[,.;:!?)۔]/.test(cur.text)) prev.text = prev.text.replace(/\s+$/, '');
  }
  return out.filter((r) => r.text.length > 0);
}

// --- validation ------------------------------------------------------------

export interface PackProblem {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

/**
 * Cross-locale pack validation. Runs in tests and in the pack-authoring surface.
 *
 * It checks the things that silently produce a wrong document:
 *  - a template that exists in one locale and not another (half-translated: the
 *    patient gets an English-only line where Urdu was the whole point);
 *  - the same templateId declaring DIFFERENT slot sets per locale (the locales
 *    have drifted apart and one of them is now dropping clinical information);
 *  - a vocabulary entry present in one locale only;
 *  - a unit missing its `other` form.
 * It deliberately does NOT check word order -- differing order is the feature.
 */
export function validatePacks(registry: PackRegistry): PackProblem[] {
  const problems: PackProblem[] = [];
  const locales = Object.keys(registry) as Locale[];
  const base = locales[0];
  if (!base) return problems;

  const allTemplateIds = new Set<string>();
  const allAdvice1 = new Set<string>();
  const allAdvice2 = new Set<string>();
  const allUnits = new Set<string>();
  const allVocab = new Map<string, Set<string>>();

  for (const locale of locales) {
    const pack = registry[locale];
    Object.keys(pack.templates).forEach((id) => allTemplateIds.add(id));
    Object.keys(pack.advice.tier1).forEach((id) => allAdvice1.add(id));
    Object.keys(pack.advice.tier2).forEach((id) => allAdvice2.add(id));
    Object.keys(pack.units).forEach((id) => allUnits.add(id));
    for (const [vid, entries] of Object.entries(pack.vocab)) {
      const set = allVocab.get(vid) ?? new Set<string>();
      Object.keys(entries).forEach((e) => set.add(e));
      allVocab.set(vid, set);
    }
  }

  const checkTemplateSet = (
    ids: Set<string>,
    pick: (p: LocalePack) => Record<string, string>,
    label: string,
    compareSlots: boolean,
  ) => {
    for (const id of ids) {
      const bySlots = new Map<string, Locale[]>();
      for (const locale of locales) {
        const template = pick(registry[locale])[id];
        if (template === undefined) {
          problems.push({
            severity: 'error',
            where: `${label}.${id}`,
            message: `missing in locale "${locale}" - a half-translated phrase prints the wrong language to the patient`,
          });
          continue;
        }
        /*
          An empty string is not a translation.
          
          It used to pass. A line WITH slots was caught by accident -- the empty
          side declared no slots, so the slot-mismatch check fired -- but a line
          with no slots ("Complete the full course of medicine") validated
          clean and printed the patient a blank space where their instruction
          should be. The builder writes exactly this shape when a new line is
          added, so the hole was directly reachable.
        */
        if (template.trim() === '') {
          problems.push({
            severity: 'error',
            where: `${label}.${id}`,
            message: `blank in locale "${locale}" - the patient would be handed an empty line`,
          });
          continue;
        }
        try {
          const key = templateSlots(template).join(',');
          bySlots.set(key, [...(bySlots.get(key) ?? []), locale]);
        } catch (err) {
          problems.push({
            severity: 'error',
            where: `${label}.${id} [${locale}]`,
            message: (err as Error).message,
          });
        }
      }
      if (compareSlots && bySlots.size > 1) {
        const detail = [...bySlots.entries()]
          .map(([slots, ls]) => `${ls.join('+')}: {${slots}}`)
          .join('  vs  ');
        problems.push({
          severity: 'error',
          where: `${label}.${id}`,
          message: `locales declare different slot sets - one of them is dropping clinical information. ${detail}`,
        });
      }
    }
  };

  checkTemplateSet(allTemplateIds, (p) => p.templates, 'templates', true);
  checkTemplateSet(allAdvice1, (p) => p.advice.tier1, 'advice.tier1', true);
  checkTemplateSet(allAdvice2, (p) => p.advice.tier2, 'advice.tier2', false);

  for (const [vid, entries] of allVocab) {
    for (const entry of entries) {
      for (const locale of locales) {
        if (registry[locale].vocab[vid]?.[entry] === undefined) {
          problems.push({
            severity: 'error',
            where: `vocab.${vid}.${entry}`,
            message: `missing in locale "${locale}"`,
          });
        }
      }
    }
  }

  for (const unit of allUnits) {
    for (const locale of locales) {
      const forms = registry[locale].units[unit];
      if (!forms) {
        problems.push({
          severity: 'error',
          where: `units.${unit}`,
          message: `missing in locale "${locale}"`,
        });
      } else if (!forms.other) {
        problems.push({
          severity: 'error',
          where: `units.${unit} [${locale}]`,
          message: 'no "other" plural form; it is the required CLDR fallback',
        });
      }
    }
  }

  return problems;
}
