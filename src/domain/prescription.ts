/**
 * The stored clinical record. LANGUAGE-NEUTRAL by construction.
 *
 * Nothing in this file holds rendered text. A Prescription is structured data;
 * English chart view and Urdu patient view are two renders of the SAME object
 * (PRODUCT.md 6). If a field here ever starts holding a composed sentence, the
 * two renders can drift apart, and drift between a drug and its instruction is
 * a safety failure.
 *
 * The one deliberate exception is advice tier 3, which stores the doctor's own
 * prose in the language they typed it in, because it prints as typed and is
 * never translated (PRODUCT.md rule 3.8).
 */
import type { Locale } from './locale.ts';
import type { DocumentKindId } from './documents/index.ts';

/** A number with a unit id. The unit id keys into the locale pack, not a string. */
export interface Quantity {
  value: number;
  /** unit id, e.g. 'ml' | 'tablet' | 'day' -- resolved per locale */
  unit: string;
}

export type Sex = 'M' | 'F';

export interface Patient {
  name: string;
  /** free text: "3 y 2 m", "8 months". Age for CALCULATION comes from dob/ageDays. */
  age?: string;
  /** ISO date; optional because a walk-in may not know it */
  dob?: string;
  /** required by the growth module; never inferred from `age` free text */
  ageDays?: number;
  sex?: Sex;
  weightKg?: number;
  heightCm?: number;
  /** free text; drives the persistent allergy banner (DESIGN.md 11) */
  allergies?: string;
  /** doctor's own identifier for the patient, e.g. a file number */
  reference?: string;
  contact?: string;
}

// --- medications -----------------------------------------------------------

export interface Drug {
  /** free text allowed; the library autocompletes the NAME only */
  brand?: string;
  generic?: string;
  strength?: string;
  /** form id, e.g. 'syrup' | 'tablet' -- resolved per locale */
  form?: string;
  /** what the doctor typed when nothing in the library matched; never blocks */
  raw?: string;
  /** DRAP registration number when the row came from the catalogue */
  drapRegNo?: string;
}

/**
 * Every field is DOCTOR-CONFIRMED. The library may suggest; it may not fill.
 * PRODUCT.md rule 3.2.
 */
export interface Sig {
  /** id into the locale pack's `templates` */
  templateId: string;
  dose: Quantity;
  /** frequency slot id, e.g. 'TID' */
  frequency: string;
  /** timing slot id, e.g. 'after_food' */
  timing?: string;
  duration?: Quantity;
  /**
   * Ceiling for as-needed dosing, e.g. "no more than 4 doses in 24 hours".
   * Present because the commonest paediatric PRN drug is an antipyretic and the
   * commonest paediatric overdose is the same drug: the cap belongs on the
   * paper the parent is holding, not only in the doctor's head.
   */
  max?: Quantity;
  /** route slot id, e.g. 'oral' | 'topical' */
  route?: string;
  /**
   * Any further vocabulary slots the template declares, as slotId -> entryId.
   * `administer` ('give' vs 'take') lives here: paediatric instructions address
   * a caregiver, adult ones address the patient, and that is a pack decision,
   * not a code decision.
   */
  slots?: Record<string, string>;
}

export interface MedicationLine {
  id: string;
  drug: Drug;
  sig: Sig;
  /**
   * The cited dosing suggestion the doctor SAW, if one was shown. Recorded so
   * the record states what evidence was on screen at signing time. Its presence
   * never implies it was accepted. See PRODUCT.md 11a.
   */
  citedSuggestion?: { text: string; reference: string };
}

// --- examination -----------------------------------------------------------

/** 'not-tapped' is represented by absence from the list, never by a third state. */
export type FindingState = 'present' | 'absent';

export interface ExamFinding {
  /** id into the content pack's findings palette, or 'free:<text>' when typed */
  id: string;
  /** the English label as shown; kept so a palette edit cannot rewrite history */
  label: string;
  state: FindingState;
  /** optional modifier: "3cm", "grade 2" */
  value?: string;
}

export interface ExamSystem {
  /** system id from the content pack, e.g. 'cvs' */
  system: string;
  findings: ExamFinding[];
  freeText?: string;
}

// --- investigations --------------------------------------------------------

/**
 * One ordered test.
 *
 * Mirrors ExamFinding, including the frozen `label`: a later edit to the pack's
 * palette must not be able to retitle a test on a script already printed. There
 * is no `state` -- a test is ordered or it is not (see domain/labs.ts).
 */
export interface LabOrder {
  id: string;
  /** id into the pack's labsPalette, or 'free:<text>' when typed */
  labId: string;
  /** the English label as shown, frozen at order time */
  label: string;
  /** the qualifier: "PA view", "abdomen", "left ear" */
  value?: string;
}

// --- advice ----------------------------------------------------------------

/**
 * Three tiers, three different trust levels, and the UI must not flatten them
 * into one look (PRODUCT.md 9, DESIGN.md 8).
 */
export type AdviceItem =
  /** vetted composable template, both locales pre-approved */
  | { kind: 1; id: string; templateId: string; slots: Record<string, string | number> }
  /** vetted red-flag / return precaution. Library-only: free text is forbidden here. */
  | { kind: 2; id: string; redFlagId: string }
  /** the doctor's own words, printed as typed, in the language typed. No translation. */
  | { kind: 3; id: string; lang: Locale; text: string };

export type AdviceTier = AdviceItem['kind'];

// --- growth ----------------------------------------------------------------

export type GrowthMeasureId = 'weight' | 'length' | 'height' | 'hc' | 'bmi';

/** One plotted point, stored WITH the reference that produced its percentile. */
export interface GrowthPoint {
  id: string;
  /** ISO date of measurement */
  date: string;
  ageDays: number;
  sex: Sex;
  measure: GrowthMeasureId;
  value: number;
  unit: string;
  /** computed by domain/growth only; never recomputed by a chart component */
  z?: number;
  percentile?: number;
  reference?: 'WHO' | 'CDC';
  chart?: string;
  edition?: string;
}

/**
 * One clinical-tool result, stored WITH what produced it -- the same
 * discipline `GrowthPoint` uses. `moduleId` is a plain string, not the
 * `ModuleId` union: `domain/pack.ts` already imports `GrowthMeasureId` from
 * this file, so importing `ModuleId` back the other way would be circular.
 * `domain/pack.ts` and `domain/modules/*` are what actually enforce the
 * closed set of ids; this record just remembers which one produced a number.
 */
export interface CalcResult {
  id: string;
  moduleId: string;
  /** "eGFR (CKD-EPI 2021)" -- frozen at compute time, like a chip's label */
  label: string;
  value: number;
  unit: string;
  /** formula + edition, e.g. "CKD-EPI 2021 (race-free, creatinine)" */
  method: string;
  /** the inputs it was computed from, so a stale number is auditable later */
  inputs: Record<string, number | string>;
  computedAt: string;
}

/** One printable line per recorded result -- "eGFR (CKD-EPI 2021): 73 mL/min/1.73m2". */
export function composeCalculations(items: CalcResult[]): string[] {
  return items.map((c) => `${c.label}: ${c.value} ${c.unit}`);
}

// --- the admission ---------------------------------------------------------

/**
 * What a discharge summary knows that a prescription does not.
 *
 * Deliberately small, and deliberately all English clinical prose or a date.
 * Nothing here is patient-facing: the sentences a family takes home come
 * through `advice`, which is already vetted in both languages. A discharge
 * summary therefore adds no new translation surface, which is the property
 * that makes it safe to add at all (PRODUCT.md 9 -- nothing reaches a patient
 * in Urdu that the pack has not vouched for).
 *
 * Every field is optional and NOTHING is computed. `domain/documents` decides
 * what a discharge cannot be PRINTED without; a half-written one still saves,
 * because finishing a summary the morning after the admission is normal
 * practice and a form that refuses to save at 2am is a form people photograph
 * instead.
 */
export interface StayRecord {
  /** ISO date. Typed, never inferred from the record's own createdAt. */
  admittedOn?: string;
  dischargedOn?: string;
  /** free text: "Paediatric Ward B", "HDU" */
  ward?: string;
  /** English clinical prose, one paragraph per entry: what happened, in order */
  course: string[];
  /** procedures and interventions performed during the admission */
  procedures: string[];
  /**
   * How the patient was on the day they left. Free text for the same reason
   * `diagnosis` is: it is a judgement, and a chip list would quietly become
   * the set of judgements the app is willing to accept.
   */
  condition?: string;
  /**
   * Who sees them next, and where. Separate from `followUp`, which carries
   * only the interval: the commonest failure of a discharge is not a wrong
   * drug, it is nobody knowing whose clinic the patient belongs to now, and an
   * interval with no name attached does not fix that.
   */
  followUpWith?: string;
  followUpWhere?: string;
}

// --- the record ------------------------------------------------------------

export interface Prescription {
  id: string;
  /**
   * Which kind of document this is (`domain/documents`).
   *
   * OPTIONAL, and absent means 'prescription'. Every record written before
   * document kinds existed has no `kind`, and those records are the only copy
   * their practice has -- so absence is given a meaning rather than a schema
   * bump and a migration pass over an encrypted backup.
   */
  kind?: DocumentKindId;
  /** ISO datetime of creation */
  createdAt: string;
  /** ISO date shown on the script */
  date: string;
  patient: Patient;
  /**
   * The identified patient this belongs to, when there is one.
   *
   * OPTIONAL on purpose. A walk-in with no record must still get a script --
   * free text never blocks (PRODUCT.md 11, 16). `patient` above stays the
   * snapshot that was printed; this is only the link back to the person.
   */
  patientId?: string;
  /** English; free text + own-history autocomplete */
  problems: string[];
  examination: ExamSystem[];
  /** English; free text. Deliberately NOT chip-ified -- PRODUCT.md 8. */
  diagnosis: string[];
  /**
   * Investigations ordered. English-only: a lab technician reads "CBC", and a
   * transliteration would be unusable at the laboratory. See domain/labs.ts.
   */
  labs: LabOrder[];
  medications: MedicationLine[];
  advice: AdviceItem[];
  /** doctor-initiated only; see PRODUCT.md 4b longitudinal carve-out */
  growth?: GrowthPoint[];
  /** results from a clinical-tool module (eGFR, ...); printing is a setting */
  calculations?: CalcResult[];
  /** present on a discharge summary; ignored by every other kind */
  stay?: StayRecord;
  followUp?: { in: Quantity } | undefined;
  /** which content pack was loaded when this was written */
  packId: string;
  /** schema version, so an old export can be migrated rather than guessed at */
  schema: 1;
}

export const PRESCRIPTION_SCHEMA_VERSION = 1 as const;

/**
 * A blank document of the given kind.
 *
 * `kind` is left OFF for a prescription rather than written out, so a script
 * saved today is byte-identical to one saved before document kinds existed --
 * which keeps `kindOf`'s "absent means prescription" reading true of new
 * records as well as old ones, instead of only of old ones.
 *
 * The `stay` block is created empty for a discharge summary so the section has
 * something to edit; it is NOT created for a prescription, because a
 * prescription that carries an empty admission record would print a heading
 * for an admission that never happened.
 */
export function emptyPrescription(
  packId: string,
  id: string,
  now = new Date(),
  kind: DocumentKindId = 'prescription',
): Prescription {
  const iso = now.toISOString();
  return {
    id,
    ...(kind === 'prescription' ? {} : { kind }),
    ...(kind === 'discharge' ? { stay: { course: [], procedures: [] } } : {}),
    createdAt: iso,
    date: iso.slice(0, 10),
    patient: { name: '' },
    problems: [],
    examination: [],
    diagnosis: [],
    labs: [],
    medications: [],
    advice: [],
    packId,
    schema: PRESCRIPTION_SCHEMA_VERSION,
  };
}

function hasStayContent(stay: StayRecord | undefined): boolean {
  if (!stay) return false;
  return Boolean(
    stay.admittedOn ||
      stay.dischargedOn ||
      stay.ward?.trim() ||
      stay.condition?.trim() ||
      stay.followUpWith?.trim() ||
      stay.followUpWhere?.trim() ||
      stay.course.length ||
      stay.procedures.length,
  );
}

/** True when there is nothing worth saving or printing. */
export function isBlank(rx: Prescription): boolean {
  return (
    rx.patient.name.trim() === '' &&
    // A discharge summary whose only content so far is "admitted on the 4th"
    // is not blank: it is the first thing anyone types into one.
    !hasStayContent(rx.stay) &&
    rx.problems.length === 0 &&
    rx.diagnosis.length === 0 &&
    rx.labs.length === 0 &&
    rx.medications.length === 0 &&
    rx.advice.length === 0 &&
    rx.examination.every((s) => s.findings.length === 0 && !s.freeText?.trim())
  );
}
