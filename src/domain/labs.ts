/**
 * Investigations: which tests were ordered, composed to English prose.
 *
 * WHY CHIPS ARE RIGHT HERE WHEN PRODUCT.md 8 FORBIDS THEM FOR DIAGNOSIS
 * ---------------------------------------------------------------------
 * The distinction is boundedness. Diagnoses are an open set, and offering a
 * closed list of them pushes click-convenience ahead of judgement -- which is
 * why chips are banned there. A paediatrician's investigation repertoire is
 * roughly thirty tests with ten covering most days: the same shape as exam
 * findings, so labs reuse that machinery. Free text still never blocks; a
 * doctor must be able to type "serum ceruloplasmin" and have it print.
 *
 * ENGLISH ONLY, DELIBERATELY
 * --------------------------
 * A lab technician reads "CBC". Transliterating test names into Urdu would
 * hand a patient a slip nobody at the laboratory can act on, so this section
 * has no locale pack, no bidi and no plural rules (PRODUCT.md 6). Patient-
 * facing instruction about the tests -- fasting, when to go, bringing the
 * report -- belongs in tier-1 advice, where the Urdu is authored and reviewed.
 *
 * SIMPLER THAN EXAM ON PURPOSE
 * ----------------------------
 * An exam chip has three states because a pertinent negative ("no neck
 * stiffness") is a clinical claim worth recording. A test is either ordered or
 * it is not: there is no such thing as a "pertinently un-ordered" test, and
 * inventing an `absent` state here would print "no CBC" on a prescription.
 */
import type { LabOrder } from './prescription.ts';

/** Free-typed tests carry this prefix so they never collide with palette ids. */
export const FREE_LAB_PREFIX = 'free:';

export function freeLabId(text: string): string {
  return `${FREE_LAB_PREFIX}${text.trim().toLowerCase()}`;
}

export function isFreeLab(order: Pick<LabOrder, 'labId'>): boolean {
  return order.labId.startsWith(FREE_LAB_PREFIX);
}

export function findLab(labs: LabOrder[], labId: string): LabOrder | undefined {
  return labs.find((l) => l.labId === labId);
}

/**
 * Order or un-order a test. Pure; returns a new list.
 *
 * `label` is stored on the order rather than looked up at render time, so a
 * later edit to the pack's palette cannot retitle a test on a script that has
 * already been printed. Same reasoning as `ExamFinding.label`.
 */
export function toggleLab(
  labs: LabOrder[],
  labId: string,
  label: string,
  id: () => string,
): LabOrder[] {
  if (findLab(labs, labId)) return labs.filter((l) => l.labId !== labId);
  return [...labs, { id: id(), labId, label }];
}

/** Attach or clear the qualifier: "PA view", "abdomen", "left ear". */
export function setLabValue(
  labs: LabOrder[],
  labId: string,
  value: string | undefined,
): LabOrder[] {
  return labs.map((l) => {
    if (l.labId !== labId) return l;
    const next: LabOrder = { ...l };
    if (value && value.trim()) next.value = value.trim();
    else delete next.value;
    return next;
  });
}

export function labCount(labs: LabOrder[]): number {
  return labs.length;
}

/**
 * One ordered test as it prints.
 *   with a qualifier -> "Chest X-ray PA view"
 *   without          -> "CBC with ESR"
 *
 * The qualifier is appended rather than folded into the label so that a value
 * can be cleared later without having to reconstruct the original test name.
 */
export function composeLab(order: LabOrder): string {
  const label = order.label.trim();
  return order.value ? `${label} ${order.value.trim()}` : label;
}

/**
 * The whole investigations block, in the order the doctor tapped them.
 *
 * Not sorted. A doctor who orders a CBC first and an X-ray second is usually
 * signalling priority, and re-ordering the list would quietly discard that.
 */
export function composeLabs(labs: LabOrder[]): string[] {
  return labs.map(composeLab).filter((line) => line.length > 0);
}
