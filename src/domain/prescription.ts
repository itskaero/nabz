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

// --- the record ------------------------------------------------------------

export interface Prescription {
  id: string;
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
  followUp?: { in: Quantity } | undefined;
  /** which content pack was loaded when this was written */
  packId: string;
  /** schema version, so an old export can be migrated rather than guessed at */
  schema: 1;
}

export const PRESCRIPTION_SCHEMA_VERSION = 1 as const;

export function emptyPrescription(packId: string, id: string, now = new Date()): Prescription {
  const iso = now.toISOString();
  return {
    id,
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

/** True when there is nothing worth saving or printing. */
export function isBlank(rx: Prescription): boolean {
  return (
    rx.patient.name.trim() === '' &&
    rx.problems.length === 0 &&
    rx.diagnosis.length === 0 &&
    rx.labs.length === 0 &&
    rx.medications.length === 0 &&
    rx.advice.length === 0 &&
    rx.examination.every((s) => s.findings.length === 0 && !s.freeText?.trim())
  );
}
