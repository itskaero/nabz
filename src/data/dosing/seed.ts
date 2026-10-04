/**
 * Dosing evidence, keyed by GENERIC. Joined to the catalogue on generic so the
 * commercial catalogue's mess stays away from the part that decides a dose.
 *
 * ============================ READ BEFORE USE ============================
 * This file COMPOSES the dosing table; it holds no rows of its own. The rows
 * live in sibling files split by class, which is what makes a list of this size
 * reviewable — and, more importantly, what keeps two different kinds of claim
 * from being mixed into one list:
 *
 *   `who.ts`  — TRANSCRIBED from openly-licensed WHO guidance. Somebody opened
 *               the cited chapter and copied the number out of it.
 *   everything else — DRAFTED. Written from ordinary paediatric practice so
 *               that the pack author's job is checking a number rather than
 *               authoring one. Nobody has opened the reference these rows name.
 *               Every one of them carries `drafted: true`, the sign-off screen
 *               says so, and signing clears it.
 *
 * NOTHING HERE IS VERIFIED. `verified` is false on every row in every file, and
 * `validateContentPack` refuses the pack-level claim while that is true. The
 * builder's Sign-off tab is where that changes, one row at a time, by the
 * clinician whose name goes on the pack.
 *
 * WHAT IS STILL NOT ALLOWED. No row may be bulk-copied from BNFC, Nelson,
 * Harriet Lane, Lexicomp or Micromedex. A dose is a fact and facts are free;
 * a monograph's prose, and the selection and arrangement of a dosing table,
 * are not. The selection here is driven by what
 * `src/data/formulary/seed.ts` actually stocks, which is a Pakistani
 * paediatric catalogue and nobody's contents page.
 *
 * WHAT THE VALIDATOR ENFORCES: `reference` must be non-empty on every row, and
 * no two rows may share an identity, or the pack fails to build. A dose without
 * a citation cannot ship, and two rows that would share one signature cannot
 * either.
 * ========================================================================
 */
import type { DosingEntry } from '@domain/pack.ts';
import { whoDosing } from './who.ts';
import { analgesiaDosing } from './analgesia.ts';
import { antimicrobialDosing } from './antimicrobials.ts';
import { respiratoryDosing } from './respiratory.ts';
import { allergyGiDosing } from './allergy-gi.ts';
import { neuroCardioDosing } from './neuro-cardio.ts';
import { topicalSupplementDosing } from './topical-supplements.ts';

export const dosingSeed: DosingEntry[] = [
  ...whoDosing,
  ...analgesiaDosing,
  ...antimicrobialDosing,
  ...respiratoryDosing,
  ...allergyGiDosing,
  ...neuroCardioDosing,
  ...topicalSupplementDosing,
];

export default dosingSeed;
