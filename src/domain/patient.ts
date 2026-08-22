/**
 * Patient identity.
 *
 * THE BUG THIS FILE EXISTS TO FIX
 * ------------------------------
 * The previous key was `reference || name`, lowercased. Two children called
 * "Ali Khan" were therefore one patient, and their growth points landed in one
 * series. In paediatrics that is not a corner case: siblings share a surname
 * and a clinic sees a hundred Muhammads a month. A merged weight series reads
 * as growth faltering, which is a diagnosis the data invented.
 *
 * So a patient is now an ENTITY with a generated id. Nothing is derived from
 * the name, because names are not unique and never were.
 *
 * THE RULE THAT KEEPS THIS FROM BEING A DANGEROUS EMR
 * --------------------------------------------------
 * *Identity may be remembered. Clinical decisions may not be carried.*
 *
 * Knowing that this is the same child as last month is safe and useful. Loading
 * last month's prescription because of it is the wrong-patient medication-error
 * vector PRODUCT.md rule 3.4 forbids. This module deals only in identity; the
 * refill path stays an explicit manual search-and-select.
 *
 * MATCHING IS NEVER AUTOMATIC. `rankCandidates` returns a list for a human to
 * choose from. There is deliberately no `findPatient(name)` that returns one
 * answer, because a function like that is how the wrong chart gets opened.
 */
import type { Sex } from './prescription.ts';

export interface PatientRecord {
  /** generated, opaque, never derived from the name */
  id: string;
  name: string;
  /** ISO date; often unknown for a walk-in */
  dob?: string;
  sex?: Sex;
  phone?: string;
  /** the doctor's own file number, if they keep one */
  fileNo?: string;
  createdAt: string;
  updatedAt: string;
}

/** Fold a name for comparison only. Never used as a storage key. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How strongly a stored patient matches what was typed.
 *
 * Deliberately returns a SCORE rather than a boolean. There is no threshold at
 * which this module decides two records are the same person — that judgement
 * belongs to whoever is looking at the child.
 */
export interface Candidate {
  patient: PatientRecord;
  score: number;
  /** why it matched, shown to the human making the call */
  reasons: string[];
}

export interface PatientQuery {
  name?: string;
  dob?: string;
  sex?: Sex;
  phone?: string;
  fileNo?: string;
}

export function rankCandidates(
  query: PatientQuery,
  patients: PatientRecord[],
  limit = 8,
): Candidate[] {
  const wantName = query.name ? normaliseName(query.name) : '';
  const wantPhone = query.phone?.replace(/\D/g, '') ?? '';
  const wantFile = query.fileNo?.trim().toLowerCase() ?? '';

  const out: Candidate[] = [];
  for (const patient of patients) {
    let score = 0;
    const reasons: string[] = [];

    // A file number is the only thing a doctor deliberately assigns, so it is
    // the strongest signal available.
    if (wantFile && patient.fileNo?.trim().toLowerCase() === wantFile) {
      score += 100;
      reasons.push('same file number');
    }
    if (wantPhone && (patient.phone?.replace(/\D/g, '') ?? '') === wantPhone) {
      score += 60;
      reasons.push('same phone');
    }
    if (wantName) {
      const have = normaliseName(patient.name);
      if (have === wantName) {
        score += 30;
        reasons.push('same name');
      } else if (have.includes(wantName) || wantName.includes(have)) {
        score += 12;
        reasons.push('similar name');
      }
    }
    // Date of birth CONFIRMS a name match; on its own it means little, since
    // a busy clinic has many children born on the same day.
    if (query.dob && patient.dob === query.dob) {
      score += 40;
      reasons.push('same date of birth');
    }
    // A conflicting sex is a strong signal these are different people.
    if (query.sex && patient.sex && query.sex !== patient.sex) {
      score -= 50;
      reasons.push('different sex');
    }

    if (score > 0) out.push({ patient, score, reasons });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * True when two stored records are so alike that keeping both is probably an
 * accident. Used to OFFER a merge, never to perform one.
 */
export function looksDuplicate(a: PatientRecord, b: PatientRecord): boolean {
  if (a.id === b.id) return false;
  if (normaliseName(a.name) !== normaliseName(b.name)) return false;
  // Same name is not enough. Something else must agree, and nothing may conflict.
  if (a.sex && b.sex && a.sex !== b.sex) return false;
  if (a.dob && b.dob && a.dob !== b.dob) return false;
  const agrees =
    (a.dob !== undefined && a.dob === b.dob) ||
    (!!a.phone && a.phone === b.phone) ||
    (!!a.fileNo && a.fileNo === b.fileNo);
  return agrees;
}

/** Display label. Includes whatever distinguishes this child from a namesake. */
export function patientLabel(patient: PatientRecord): string {
  const bits = [patient.name.trim() || 'Unnamed'];
  if (patient.fileNo?.trim()) bits.push(`#${patient.fileNo.trim()}`);
  else if (patient.dob) bits.push(patient.dob);
  else if (patient.phone?.trim()) bits.push(patient.phone.trim());
  return bits.join(' · ');
}

/**
 * A legacy growth series, keyed by the old name-derived key.
 *
 * These CANNOT be migrated automatically. The old key merged namesakes, and no
 * field records which point belonged to which child — so a series under
 * "ali khan" may hold two children's weights interleaved, and nothing in the
 * data can separate them. Silently attaching it to a new patient id would
 * launder that into a chart that looks authoritative.
 *
 * The only honest migration is to show the points to a human with their dates
 * and let them decide.
 */
export interface LegacyGrowthLink {
  legacyKey: string;
  patientName: string;
  pointCount: number;
  updatedAt: string;
  /**
   * True when the old key was derived from a name rather than a file number,
   * i.e. the case that could have merged two children. A key that came from a
   * deliberate file number is far safer, though still unverified.
   */
  nameDerived: boolean;
}
