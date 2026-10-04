/**
 * Which history questions to ask, and what has been answered.
 *
 * The questions are pack DATA (`HistorySectionDefinition` in pack.ts); this is
 * the small amount of logic that sits between them and the screen, and it is
 * framework-free because the interesting rule -- an age band that hides a
 * section but never hides an ANSWER -- is worth testing without a browser.
 *
 * THE RULE THAT MATTERS
 * ---------------------
 * A section outside its age band is not offered. Birth history is noise on a
 * fourteen-year-old and a questionnaire that asks everything of everyone is
 * one nobody fills in.
 *
 * But a section outside its band that ALREADY HOLDS CONTENT is still shown.
 * The alternative is that a child crosses a birthday and their birth history
 * silently disappears from the chart -- still on disk, invisible, which is
 * worse than deleting it because nobody finds out.
 */
import type { HistoryFieldDefinition, HistorySectionDefinition } from './pack.ts';

/**
 * What has been answered, flat.
 *
 * Keyed `"<sectionId>.<fieldId>"` rather than nested, so it serialises into
 * the backup without a shape to migrate and reads back without walking a tree.
 * Each answer carries its own date because some of these change: "exclusively
 * breastfed" is a fact about a moment, and a two-year-old's record saying it
 * with no date beside it is misleading.
 */
export interface HistoryAnswer {
  value: string | string[];
  /** ISO date the answer was recorded or last corrected */
  notedOn: string;
}

export type HistoryAnswers = Record<string, HistoryAnswer>;

export function answerKey(sectionId: string, fieldId: string): string {
  return `${sectionId}.${fieldId}`;
}

function isAnswered(a: HistoryAnswer | undefined): boolean {
  if (!a) return false;
  return Array.isArray(a.value) ? a.value.length > 0 : a.value.trim().length > 0;
}

/** Whether an age falls inside a section's band. No band means always. */
export function inBand(
  band: HistorySectionDefinition['appliesTo'],
  ageDays: number | undefined,
): boolean {
  if (!band) return true;
  // An unknown age is not a reason to hide a question. A walk-in whose mother
  // does not know the date of birth still has a birth history.
  if (ageDays === undefined) return true;
  if (band.fromDays !== undefined && ageDays < band.fromDays) return false;
  if (band.toDays !== undefined && ageDays > band.toDays) return false;
  return true;
}

export interface ResolvedSection {
  section: HistorySectionDefinition;
  /** how many of its fields have an answer */
  filled: number;
  total: number;
  /**
   * True when this section is only here because it already holds content --
   * the patient has aged out of it. The UI says so rather than silently
   * presenting a question that no longer applies.
   */
  outsideBand: boolean;
}

/**
 * The sections to show for this patient, in order.
 *
 * `ageDays` is the patient's age at the time of asking. Sections with no
 * answers outside their band are dropped; sections with answers are kept and
 * marked `outsideBand`.
 */
export function resolveSections(
  sections: readonly HistorySectionDefinition[] | undefined,
  answers: HistoryAnswers,
  ageDays?: number,
): ResolvedSection[] {
  const out: ResolvedSection[] = [];
  for (const section of sections ?? []) {
    const filled = section.fields.filter((f) =>
      isAnswered(answers[answerKey(section.id, f.id)]),
    ).length;
    const applies = inBand(section.appliesTo, ageDays);
    if (!applies && filled === 0) continue;
    out.push({ section, filled, total: section.fields.length, outsideBand: !applies });
  }
  return out.sort((a, b) => (a.section.order ?? 0) - (b.section.order ?? 0));
}

/** How much of the whole history has been filled in, for a one-line summary. */
export function historyProgress(resolved: ResolvedSection[]): { filled: number; total: number } {
  return resolved.reduce(
    (acc, r) => ({ filled: acc.filled + r.filled, total: acc.total + r.total }),
    { filled: 0, total: 0 },
  );
}

/**
 * Write one answer.
 *
 * Returns a NEW map, and deletes the key outright when the answer is cleared
 * rather than storing an empty string -- so "has anyone answered this" stays a
 * question about whether the key exists, and a blanked field does not read as
 * a recorded negative.
 */
export function setAnswer(
  answers: HistoryAnswers,
  sectionId: string,
  fieldId: string,
  value: string | string[],
  now = new Date().toISOString(),
): HistoryAnswers {
  const key = answerKey(sectionId, fieldId);
  const next = { ...answers };
  const empty = Array.isArray(value) ? value.length === 0 : !value.trim();
  if (empty) delete next[key];
  else next[key] = { value, notedOn: now.slice(0, 10) };
  return next;
}

/** Toggle one option of a `chips` field. */
export function toggleChip(
  answers: HistoryAnswers,
  sectionId: string,
  fieldId: string,
  option: string,
  now = new Date().toISOString(),
): HistoryAnswers {
  const current = answers[answerKey(sectionId, fieldId)]?.value;
  const list = Array.isArray(current) ? current : current ? [current] : [];
  const next = list.includes(option) ? list.filter((o) => o !== option) : [...list, option];
  return setAnswer(answers, sectionId, fieldId, next, now);
}

/** One line per answered field, for the chart summary. */
export function summarise(
  section: HistorySectionDefinition,
  answers: HistoryAnswers,
): Array<{ field: HistoryFieldDefinition; text: string; notedOn: string }> {
  const out: Array<{ field: HistoryFieldDefinition; text: string; notedOn: string }> = [];
  for (const field of section.fields) {
    const a = answers[answerKey(section.id, field.id)];
    if (!isAnswered(a)) continue;
    const text = Array.isArray(a!.value) ? a!.value.join(', ') : a!.value;
    out.push({ field, text: field.unit ? `${text} ${field.unit}` : text, notedOn: a!.notedOn });
  }
  return out;
}
