/**
 * The shared shape of a DRAFTED dosing row.
 *
 * WHAT "DRAFTED" MEANS, AND WHY IT IS A FLAG RATHER THAN A COMMENT. These rows
 * were written from ordinary paediatric practice so that the pack author's job
 * is checking a number rather than authoring one. Nobody opened the reference
 * they name. `drafted: true` says so in the data, the sign-off screen says so
 * in words, and signing the row clears it -- because the signature IS somebody
 * opening the reference.
 *
 * WHY NOT TRANSCRIBE A TABLE INSTEAD. A dose is a fact and facts are not
 * copyrightable; a monograph's prose, and the selection and arrangement of a
 * dosing table, are. `src/data/dosing/who.ts` holds the rows that came out of
 * an openly-licensed WHO source and says so. Everything here is written fresh,
 * in this schema, selected by what the Pakistani formulary in
 * `src/data/formulary/seed.ts` actually stocks -- not by any publisher's
 * contents page.
 *
 * WHAT A REFERENCE MEANS HERE. On a WHO row it is where the number came FROM.
 * On a drafted row it is where the number is to be CHECKED, which is a
 * different claim, so it is worded as one.
 */
import type { DosingEntry } from '@domain/pack.ts';

/** "check it in BNFC under this drug", phrased so it cannot read as "taken from". */
export function bnfc(generic: string): string {
  return `BNF for Children, ${generic.toLowerCase()} monograph — check the current edition before signing`;
}

/** For the handful where WHO's children's formulary is the natural check. */
export function whoFormulary(generic: string): string {
  return `WHO Model Formulary for Children (2010), ${generic.toLowerCase()} — check against the current edition before signing`;
}

/**
 * Build a drafted row.
 *
 * `verified` and `drafted` are set here rather than typed out 150 times,
 * because a file where every row repeats `verified: false` is a file where one
 * row eventually does not.
 */
export function draft(row: Omit<DosingEntry, 'verified' | 'drafted'>): DosingEntry {
  return { ...row, verified: false, drafted: true };
}
