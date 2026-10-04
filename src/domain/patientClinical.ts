/**
 * The facts about a patient that persist between visits.
 *
 * WHY THIS IS NOT ON `PatientRecord`
 * ----------------------------------
 * The obvious home for an allergy list is the patient record. It would be a
 * data leak and a data-loss bug, and neither is visible in review:
 *
 *   - `storage/clinicSync.ts` posts `{ patients, queue }` wholesale, and says
 *     so in its own header: "Patients and queue rows. That is the entire
 *     payload." An allergy riding on a patient row travels to the reception
 *     station over the wire, which is the one property the whole device-role
 *     design exists to guarantee. `tests/server.test.ts` would not catch it --
 *     it posts PRESCRIPTIONS at a live server, so clinical content smuggled on
 *     a patient row passes.
 *   - The same file then does `for (const patient of merged.patients) await
 *     db.savePatient(patient)` on the way back. A station that has never heard
 *     of these fields round-trips the record without them and silently erases
 *     a child's allergy list.
 *
 * So `PatientRecord` stays identity-only -- name, dob, sex, phone, file number
 * -- and stays syncable, and everything clinical about a patient lives here, in
 * its own store, write-guarded on a reception device. That is the reasoning
 * `storage/db.ts` already gives for keeping growth points out of the
 * prescription store: keeping them separate makes the carve-out visible
 * instead of hidden inside a filter. A filter can be dropped by a refactor; a
 * store that throws on a reception device cannot.
 *
 * WHAT THIS FIXES
 * ---------------
 * `patient.allergies` is a STRING on each prescription, retyped at every
 * visit. Two visits can therefore disagree about whether a child is allergic
 * to penicillin and nothing anywhere reconciles them -- in a product whose
 * loudest UI element is the allergy banner. These are facts that get
 * CORRECTED, not re-entered; the prescription keeps its string as the snapshot
 * at signing, which is what was true on the paper that day.
 *
 * Framework-free on purpose: the reconciliation rules are the interesting part
 * and they are testable without a database.
 */
import type { HistoryAnswers } from './history.ts';


export interface AllergyFact {
  /** what the patient reacts to, as the doctor says it: a drug, a food, a dye */
  substance: string;
  /** what happened. Optional, because "penicillin" alone is still worth knowing */
  reaction?: string;
  /**
   * Two values, not five.
   *
   * A scale with "moderate" in it invites a judgement nobody can make
   * consistently at OPD speed, and the only question the banner has to answer
   * is whether this one can kill. `severe` means anaphylaxis, airway or
   * admission; everything else is `mild`.
   */
  severity: 'mild' | 'severe';
  /** ISO date this was recorded. A fact with no date is a rumour. */
  notedOn: string;
  /** who recorded it, when that is not the device owner (a locum, a referral) */
  notedBy?: string;
}

export interface ProblemFact {
  label: string;
  status: 'active' | 'resolved';
  /** ISO date, if known */
  onset?: string;
  resolvedOn?: string;
}

export interface PatientClinical {
  patientId: string;
  allergies: AllergyFact[];
  problems: ProblemFact[];
  bloodGroup?: string;
  /**
   * The background history -- antenatal, birth, feeding, social -- keyed
   * `"<sectionId>.<fieldId>"`. The QUESTIONS are pack data
   * (`HistorySectionDefinition`); these are the answers.
   *
   * Optional, because a record written before the history existed has none and
   * absence is given a meaning rather than a migration (the same choice
   * `Prescription.kind` makes).
   */
  history?: HistoryAnswers;
  /**
   * Which immunisation visits have been given, against the schedule the pack
   * declares.
   *
   * `source` earns its place: a mother's recollection is not a vaccination
   * card, and recording which one it was is the difference between a record
   * and a guess. A visit absent from this list is a visit NOT RECORDED -- not
   * a visit missed, which is a conclusion nothing here draws.
   */
  immunisations?: ImmunisationRecord[];
  milestones?: MilestoneRecord[];
  updatedAt: string;
}

export interface ImmunisationRecord {
  /** matches a visit id in `pack.immunisationSchedule` */
  visitId: string;
  /** ISO date it was given, when it is known */
  givenOn?: string;
  /** where the information came from */
  source?: 'card' | 'recall';
  notedOn: string;
}

export interface MilestoneRecord {
  /** matches an item id in `pack.milestones` */
  itemId: string;
  /** ISO date, or an age the parent gave -- free text, because they say "about 10 months" */
  attainedOn?: string;
  /**
   * Explicitly recorded as not yet attained.
   *
   * Distinct from absent, which means nobody asked. A blank milestone must
   * never read as a negative finding -- that is the difference between a
   * record and an accusation.
   */
  notYet?: boolean;
  notedOn: string;
}

export function emptyClinical(patientId: string, now = new Date().toISOString()): PatientClinical {
  return { patientId, allergies: [], problems: [], updatedAt: now };
}

/** Nothing recorded at all -- so the UI can say "not recorded" rather than "none". */
export function isBlank(c: PatientClinical | undefined): boolean {
  if (!c) return true;
  return (
    c.allergies.length === 0 &&
    c.problems.length === 0 &&
    !c.bloodGroup &&
    Object.keys(c.history ?? {}).length === 0 &&
    (c.immunisations?.length ?? 0) === 0 &&
    (c.milestones?.length ?? 0) === 0
  );
}

/**
 * How much of the schedule has been recorded.
 *
 * A COUNT, deliberately, and never "N overdue". The app does not know whether
 * a child had their 14-week visit at a government centre and nobody wrote it
 * here; "4 of 6 recorded" is true, and "2 overdue" would be a claim about the
 * world made from the absence of data.
 */
export function immunisationProgress(
  c: PatientClinical | undefined,
  scheduleSize: number,
): { recorded: number; total: number } {
  return { recorded: c?.immunisations?.length ?? 0, total: scheduleSize };
}

export function activeProblems(c: PatientClinical | undefined): ProblemFact[] {
  return (c?.problems ?? []).filter((p) => p.status === 'active');
}

/**
 * The recorded allergies as the one line the banner and the printed sheet use.
 *
 * Severe first, because the banner truncates on a 390px phone and the thing
 * that gets cut off should be the mild one. Returns '' for a patient with
 * nothing recorded -- NOT "none known", which is a clinical claim this
 * function is not entitled to make. Someone has to have asked.
 */
export function allergyLine(c: PatientClinical | undefined): string {
  const list = c?.allergies ?? [];
  if (list.length === 0) return '';
  const ordered = [...list].sort((a, b) => Number(b.severity === 'severe') - Number(a.severity === 'severe'));
  return ordered
    .map((a) => (a.reaction ? `${a.substance} (${a.reaction})` : a.substance))
    .join(', ');
}

export function hasSevereAllergy(c: PatientClinical | undefined): boolean {
  return (c?.allergies ?? []).some((a) => a.severity === 'severe');
}

/**
 * Fold what the doctor typed on this script into the patient's recorded list.
 *
 * Deliberately NOT automatic anywhere. The caller is a button the doctor
 * presses, because promoting a free-text string to a durable clinical fact is
 * a decision -- "pcm?" typed in a hurry must not become a paracetamol allergy
 * on the chart forever.
 *
 * Splits on commas and semicolons, trims, drops anything already recorded
 * (case- and spacing-insensitive), and records everything new as `mild`:
 * severity is a question someone has to answer, and guessing `severe` from a
 * word would make the banner cry wolf.
 */
export function adoptTypedAllergies(
  c: PatientClinical,
  typed: string,
  now = new Date().toISOString(),
): PatientClinical {
  const fold = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const known = new Set(c.allergies.map((a) => fold(a.substance)));
  const added: AllergyFact[] = [];
  for (const part of typed.split(/[,;]/)) {
    const substance = part.trim();
    if (!substance) continue;
    if (known.has(fold(substance))) continue;
    known.add(fold(substance));
    added.push({ substance, severity: 'mild', notedOn: now.slice(0, 10) });
  }
  if (added.length === 0) return c;
  return { ...c, allergies: [...c.allergies, ...added], updatedAt: now };
}
