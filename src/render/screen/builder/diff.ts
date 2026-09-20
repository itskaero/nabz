/**
 * What saving would actually change.
 *
 * The builder autosaves a draft and then publishes it in one button. Until now
 * the doctor pressed that button on faith: the screen said "3 problems must be
 * fixed" or "nothing is blocking", and nothing anywhere said what was about to
 * become live. After an afternoon of editing, or after a sectional import that
 * replaced a whole formulary, that is a lot to take on trust.
 *
 * The import path already asks for confirmation and says what it is about to
 * replace (`PackBuilder`'s incoming dialog). This is the same courtesy applied
 * to the operation that actually reaches patients.
 *
 * WHAT IT COMPARES
 * ----------------
 * The draft against what is currently LIVE, not against what shipped. A doctor
 * who has published twice today wants to see the second afternoon's work, not
 * everything they have ever changed.
 *
 * Pure and framework-free, so the interesting half is testable without
 * rendering anything.
 */
import type { Locale } from '@domain/locale.ts';
import type { ContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface Change {
  kind: ChangeKind;
  /** the thing that changed, in the author's words -- "Panadol", "sig.oral.liquid" */
  label: string;
  /**
   * Extra context where the label alone is not enough: which locale a phrase
   * changed in, which generic a dosing row belongs to.
   */
  detail?: string;
}

export interface SectionDiff {
  section: string;
  changes: Change[];
}

export interface PackDiff {
  sections: SectionDiff[];
  total: number;
  /**
   * Changes that alter what a PATIENT reads, as opposed to what the doctor
   * sees while prescribing. Called out separately because they are the ones
   * worth slowing down for.
   */
  patientFacing: number;
}

function byKey<T>(items: readonly T[], key: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [key(item), item]));
}

/** Added, removed and changed, for any keyed collection. */
function diffKeyed<T>(
  before: readonly T[],
  after: readonly T[],
  key: (item: T) => string,
  label: (item: T) => string,
  same: (a: T, b: T) => boolean,
): Change[] {
  const a = byKey(before, key);
  const b = byKey(after, key);
  const out: Change[] = [];
  for (const [k, item] of b) {
    const prior = a.get(k);
    if (!prior) out.push({ kind: 'added', label: label(item) });
    else if (!same(prior, item)) out.push({ kind: 'changed', label: label(item) });
  }
  for (const [k, item] of a) {
    if (!b.has(k)) out.push({ kind: 'removed', label: label(item) });
  }
  return out;
}

/** The same, for a plain record of strings -- phrases, vocabulary, labels. */
function diffStrings(
  before: Record<string, string>,
  after: Record<string, string>,
  detail?: string,
): Change[] {
  const out: Change[] = [];
  for (const [k, v] of Object.entries(after)) {
    if (!(k in before)) out.push({ kind: 'added', label: k, ...(detail ? { detail } : {}) });
    else if (before[k] !== v) out.push({ kind: 'changed', label: k, ...(detail ? { detail } : {}) });
  }
  for (const k of Object.keys(before)) {
    if (!(k in after)) out.push({ kind: 'removed', label: k, ...(detail ? { detail } : {}) });
  }
  return out;
}

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffPack(
  before: { pack: ContentPack; phrases: PackRegistry },
  after: { pack: ContentPack; phrases: PackRegistry },
): PackDiff {
  const sections: SectionDiff[] = [];
  const add = (section: string, changes: Change[]) => {
    if (changes.length) sections.push({ section, changes });
  };

  add(
    'Medicines',
    diffKeyed(
      before.pack.formularySeed,
      after.pack.formularySeed,
      (e) => e.brand.toLowerCase(),
      (e) => e.brand,
      eq,
    ),
  );

  add(
    'Cited doses',
    diffKeyed(
      before.pack.dosing,
      after.pack.dosing,
      (e) => `${e.generic}|${e.indication ?? ''}|${e.ageBand?.label ?? ''}`,
      (e) => e.generic,
      eq,
    ),
  );

  add(
    'Exam systems',
    diffKeyed(before.pack.examSystems, after.pack.examSystems, (e) => e.id, (e) => e.label, eq),
  );

  const chipChanges: Change[] = [];
  for (const systemId of new Set([
    ...Object.keys(before.pack.findingsPalette),
    ...Object.keys(after.pack.findingsPalette),
  ])) {
    for (const change of diffKeyed(
      before.pack.findingsPalette[systemId] ?? [],
      after.pack.findingsPalette[systemId] ?? [],
      (f) => f.id,
      (f) => f.label,
      eq,
    )) {
      chipChanges.push({ ...change, detail: systemId });
    }
  }
  add('Examination chips', chipChanges);

  const labChanges: Change[] = [];
  for (const categoryId of new Set([
    ...Object.keys(before.pack.labsPalette),
    ...Object.keys(after.pack.labsPalette),
  ])) {
    for (const change of diffKeyed(
      before.pack.labsPalette[categoryId] ?? [],
      after.pack.labsPalette[categoryId] ?? [],
      (l) => l.id,
      (l) => l.label,
      eq,
    )) {
      labChanges.push({ ...change, detail: categoryId });
    }
  }
  add('Investigations', labChanges);

  add(
    'Clinical scores',
    diffKeyed(before.pack.scores ?? [], after.pack.scores ?? [], (s) => s.id, (s) => s.label, eq),
  );

  // --- what a patient reads -------------------------------------------------

  const locales = Object.keys(after.phrases) as Locale[];
  const patient: SectionDiff[] = [];
  const addPatient = (section: string, changes: Change[]) => {
    if (changes.length) patient.push({ section, changes });
  };

  for (const locale of locales) {
    const a = before.phrases[locale];
    const b = after.phrases[locale];
    if (!a || !b) continue;
    addPatient(`Instruction sentences (${locale})`, diffStrings(a.templates, b.templates, locale));
    addPatient(`Advice (${locale})`, diffStrings(a.advice.tier1, b.advice.tier1, locale));
    addPatient(`Red flags (${locale})`, diffStrings(a.advice.tier2, b.advice.tier2, locale));
    addPatient(`Printed labels (${locale})`, diffStrings(a.strings, b.strings, locale));

    const vocabChanges: Change[] = [];
    for (const slot of new Set([...Object.keys(a.vocab), ...Object.keys(b.vocab)])) {
      for (const change of diffStrings(a.vocab[slot] ?? {}, b.vocab[slot] ?? {})) {
        vocabChanges.push({ ...change, detail: `${slot} · ${locale}` });
      }
    }
    addPatient(`Slot words (${locale})`, vocabChanges);
  }

  /*
    A sign-off that was cleared is worth its own line. It is not a change to
    any wording -- it is the wording's REVIEW falling away, which is easy to
    do by accident and invisible in a list of edited phrases.
  */
  const lostReviews: Change[] = [];
  for (const [field, label] of [
    ['redFlagReview', 'red flag'],
    ['adviceReview', 'advice line'],
  ] as const) {
    const a = before.pack[field] ?? {};
    const b = after.pack[field] ?? {};
    for (const id of Object.keys(a)) {
      if (a[id]?.reviewedBy && !b[id]?.reviewedBy) {
        lostReviews.push({ kind: 'removed', label: id, detail: `${label} sign-off cleared` });
      }
    }
  }
  addPatient('Sign-offs', lostReviews);

  const patientFacing = patient.reduce((n, s) => n + s.changes.length, 0);
  const all = [...sections, ...patient];
  return {
    sections: all,
    total: all.reduce((n, s) => n + s.changes.length, 0),
    patientFacing,
  };
}
