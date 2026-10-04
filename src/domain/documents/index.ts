/**
 * What KIND of document is being written (CLAUDE.md 6d's discipline, applied
 * to the document itself rather than to a calculator).
 *
 * A prescription and a discharge summary are the same act -- a doctor records
 * what happened and hands the patient something to take home -- performed over
 * a different span of time. The temptation is to build the second one as a
 * copy of the first; the copy then drifts, and two years later a fix to the
 * medication row lands in one of them.
 *
 * So this file says what a kind IS -- its tabs, its printed blocks, what it
 * cannot go out without -- and nothing else changes. `MedicationLine`,
 * `AdviceItem`, `LabOrder`, `ExamSystem` are reused verbatim. In particular
 * the discharge summary's patient-facing Urdu comes entirely through the
 * existing tier-1/2/3 advice machinery, so it adds NO new translation surface:
 * every sentence a family takes home is one the pack already vouches for.
 *
 * Framework-free -- `render/screen/documents/registry.tsx` maps a kind to its
 * extra panel, `render/pdf/layout.ts` maps a printed block to its painter.
 */
import type { SectionId } from '@config/appDefaults.ts';
import type { LabsPlacement } from '@config/appDefaults.ts';

/**
 * A CLOSED union, for the reason `ModuleId` is one: a kind is code -- a
 * section component, a painter, a set of required fields -- and a pack must
 * not be able to invent one by naming it. Adding a kind means adding a case
 * here AND the code it names; an id with no matching code is a build error.
 */
export type DocumentKindId = 'prescription' | 'discharge';

/**
 * Everything the PDF renderer knows how to draw, as an id a kind can order.
 *
 * Wider than `SectionId` on purpose: `calculations` and `followUp` print but
 * have no tab of their own, and `stay` is the one genuinely new block a
 * discharge needs. Keeping the two lists separate is what stops "a thing with
 * a tab" and "a thing that prints" from being forced to mean the same thing.
 */
export type PrintBlockId =
  | 'problems'
  | 'stay'
  | 'examination'
  | 'diagnosis'
  | 'labs'
  | 'calculations'
  | 'medications'
  | 'advice'
  | 'followUp';

export interface DocumentKindMeta {
  id: DocumentKindId;
  /** what the doctor calls it, in the app */
  label: string;
  /** key into the locale pack for the title printed on the document */
  titleKey: string;
  /** the tabs this kind offers, in order */
  sections: SectionId[];
  /**
   * Per-kind tab wording. A discharge's "Presenting complaints" is "On
   * admission", and calling it the same thing in both would be a small lie
   * that a reader of the printed page would notice first.
   */
  sectionLabel: Partial<Record<SectionId, string>>;
  /** printed blocks, in order */
  print: PrintBlockId[];
  /**
   * Whether this kind honours the doctor's `labsPlacement` setting.
   *
   * A prescription's investigations are an instruction ("go and have these
   * done"), so where they sit is taste. A discharge summary's are a result
   * from the admission, and they belong with the hospital course -- moving
   * them below the medications would put findings after the plan they explain.
   */
  movableLabs: boolean;
  /**
   * Blocks whose absence makes the document meaningless, checked before print
   * rather than before save. Saving half a discharge summary at 2am and
   * finishing it in the morning is normal; PRINTING half of one is not.
   */
  requiresForPrint: PrintBlockId[];
}

const PRESCRIPTION: DocumentKindMeta = {
  id: 'prescription',
  label: 'Prescription',
  titleKey: 'doc.prescription',
  sections: ['problems', 'examination', 'diagnosis', 'labs', 'medications', 'advice'],
  sectionLabel: {},
  print: [
    'problems',
    'examination',
    'diagnosis',
    'labs',
    'calculations',
    'medications',
    'advice',
    'followUp',
  ],
  movableLabs: true,
  // Nothing. A script with one drug on it is a script; a script with only
  // advice on it is a legitimate "no medicine, here is what to do".
  requiresForPrint: [],
};

const DISCHARGE: DocumentKindMeta = {
  id: 'discharge',
  label: 'Discharge summary',
  titleKey: 'doc.discharge',
  /**
   * `stay` leads, because the first question the next doctor reading this asks
   * is "when, and for how long". Examination is what was found ON DISCHARGE,
   * not on admission -- that is why it sits after the course rather than
   * before it.
   */
  sections: ['stay', 'problems', 'diagnosis', 'labs', 'examination', 'medications', 'advice'],
  sectionLabel: {
    problems: 'On admission',
    examination: 'On discharge',
    labs: 'Results',
    medications: 'To continue',
    advice: 'At home',
  },
  print: [
    'stay',
    'problems',
    'diagnosis',
    'labs',
    'examination',
    'calculations',
    'medications',
    'advice',
    'followUp',
  ],
  movableLabs: false,
  /**
   * A discharge summary with no diagnosis and no dates is a piece of paper
   * that says a person was somewhere. The follow-up requirement is the one
   * that matters clinically: the commonest failure of a discharge is not a
   * wrong drug, it is nobody knowing who sees the patient next.
   */
  requiresForPrint: ['stay', 'diagnosis', 'followUp'],
};

export const DOCUMENT_META: Record<DocumentKindId, DocumentKindMeta> = {
  prescription: PRESCRIPTION,
  discharge: DISCHARGE,
};

/**
 * The kind a record is. Absent means prescription.
 *
 * Every record written before document kinds existed has no `kind`, and those
 * records live on a doctor's device as the only copy there is. Reading absence
 * as the original behaviour is what lets this ship without a schema bump and
 * without a migration pass over an encrypted backup -- the migration that goes
 * wrong here does not lose a row, it loses a practice's history.
 */
export function kindOf(doc: { kind?: DocumentKindId }): DocumentKindMeta {
  return DOCUMENT_META[doc.kind ?? 'prescription'];
}

/** The kinds a pack offers, resolved to their metadata, in offer order. */
export function documentsFor(enabled: DocumentKindId[] | undefined): DocumentKindMeta[] {
  const ids = enabled?.length ? enabled : (['prescription'] as DocumentKindId[]);
  return ids.map((id) => DOCUMENT_META[id]).filter((m): m is DocumentKindMeta => Boolean(m));
}

/**
 * The printed block order for a kind, with the doctor's labs setting applied
 * where the kind allows it.
 *
 * Resolved here rather than in the renderer so that "where do investigations
 * go" has exactly one answer, and so a new kind states its position by
 * declaring it rather than by adding another branch to `buildDocument`.
 */
export function printOrder(
  kind: DocumentKindMeta,
  labsPlacement: LabsPlacement,
): PrintBlockId[] {
  if (!kind.movableLabs || labsPlacement === 'after-diagnosis') return kind.print;
  const without = kind.print.filter((b) => b !== 'labs');
  const at = without.indexOf('medications');
  if (at === -1) return kind.print;
  return [...without.slice(0, at + 1), 'labs', ...without.slice(at + 1)];
}

/**
 * What this kind still needs before it can be PRINTED, in the doctor's words.
 *
 * Checked at print, not at save. Finishing a discharge summary the morning
 * after the admission is normal practice, and a form that refuses to save at
 * 2am is a form people photograph instead. Handing a family a summary with no
 * follow-up on it is the failure worth blocking.
 *
 * Returns reasons rather than a boolean so the button can say WHY it is off.
 * A disabled control with no explanation is a bug report waiting to happen.
 */
export function missingForPrint(
  kind: DocumentKindMeta,
  doc: {
    diagnosis: string[];
    followUp?: unknown;
    stay?: { admittedOn?: string; followUpWith?: string };
  },
): string[] {
  const missing: string[] = [];
  for (const block of kind.requiresForPrint) {
    if (block === 'diagnosis' && doc.diagnosis.length === 0) {
      missing.push('a diagnosis');
    }
    if (block === 'stay' && !doc.stay?.admittedOn) {
      missing.push('the admission date');
    }
    if (block === 'followUp' && !doc.followUp && !doc.stay?.followUpWith?.trim()) {
      missing.push('a follow-up');
    }
  }
  return missing;
}

/** The tab label for a section, in the wording this kind uses. */
export function sectionLabelFor(
  kind: DocumentKindMeta,
  section: SectionId,
  fallback: string,
): string {
  return kind.sectionLabel[section] ?? fallback;
}
