/**
 * The longitudinal chart, as a PROJECTION over what is already on disk.
 *
 * THE IDEA THAT KEEPS THIS SMALL
 * ------------------------------
 * The record already exists. Every saved prescription is a dated clinical
 * encounter carrying problems, examination, diagnosis, labs ordered,
 * medications and advice. "Everything prescribed, with its duration" is
 * `MedicationLine.sig.duration` read across every encounter -- not a second
 * database to keep in step with the first.
 *
 * So nothing here writes. It takes the encounters a caller has already loaded
 * and arranges them, which is why it is framework-free and why the arranging
 * is testable without a database or a browser.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It does not decide anything. No "overdue", no "poor adherence", no "this
 * looks like X". `domain/patient.ts` already names that failure in this
 * codebase's own words -- a merged weight series "reads as growth faltering,
 * which is a diagnosis the data invented" -- and the same applies to counting
 * four courses of amoxicillin and calling it anything. Grouping by generic
 * says "four courses"; whether that is a pattern is the doctor's judgement and
 * it goes in `diagnosis`, where judgements go.
 */
import type { MedicationLine, Prescription, Quantity } from './prescription.ts';
import { drugShortLabel } from './sig.ts';

/** One visit, flattened to what a timeline row needs. */
export interface ChartVisit {
  id: string;
  /** ISO date shown on the document -- the day the patient was in the room */
  date: string;
  kind: Prescription['kind'];
  diagnosis: string[];
  problems: string[];
  medicationCount: number;
  labCount: number;
  /** what the doctor typed in the allergy box that day, if anything */
  allergySnapshot?: string;
}

/**
 * One drug, every time it was prescribed.
 *
 * Grouped by GENERIC where there is one, falling back to the name as typed.
 * That is the grouping that answers the question actually being asked --
 * "has this child had amoxicillin before" -- which a brand-keyed grouping
 * cannot, because Amoxil and Moxiclav land in different buckets.
 */
export interface ChartMedication {
  /** the grouping key, lowercased */
  key: string;
  /** what to show: the generic if known, otherwise what was typed */
  label: string;
  /** every brand this generic was written as, so the chart is not a lie */
  brands: string[];
  courses: ChartCourse[];
}

export interface ChartCourse {
  encounterId: string;
  date: string;
  strength?: string;
  duration?: Quantity;
  /** the sig frequency slot id, shown through the locale pack by the caller */
  frequency: string;
}

export interface PatientChart {
  patientId: string;
  visits: ChartVisit[];
  medications: ChartMedication[];
  /** every distinct diagnosis ever recorded, most recent first */
  diagnoses: string[];
  firstSeen?: string;
  lastSeen?: string;
}

/** Newest first, the order every part of this chart is read in. */
function byDateDesc(a: { date: string }, b: { date: string }): number {
  return b.date.localeCompare(a.date);
}

function medicationKey(line: MedicationLine): { key: string; label: string } {
  const generic = line.drug.generic?.trim();
  if (generic) return { key: generic.toLowerCase(), label: generic };
  const typed = drugShortLabel(line.drug);
  return { key: typed.toLowerCase(), label: typed };
}

/**
 * Build one patient's chart from encounters.
 *
 * `encounters` may be the whole store: anything without this `patientId` is
 * dropped. That filter is the safety property -- an unlinked walk-in's script
 * must never appear in somebody else's chart, and the cheapest way to
 * guarantee that is for this function to be the only place the question is
 * asked.
 */
export function buildChart(patientId: string, encounters: Prescription[]): PatientChart {
  const mine = encounters.filter((rx) => rx.patientId === patientId);

  const visits: ChartVisit[] = mine
    .map((rx) => ({
      id: rx.id,
      date: rx.date,
      kind: rx.kind,
      diagnosis: rx.diagnosis,
      problems: rx.problems,
      medicationCount: rx.medications.length,
      labCount: rx.labs?.length ?? 0,
      ...(rx.patient.allergies?.trim() ? { allergySnapshot: rx.patient.allergies.trim() } : {}),
    }))
    .sort(byDateDesc);

  const byDrug = new Map<string, ChartMedication>();
  for (const rx of mine) {
    for (const line of rx.medications) {
      const { key, label } = medicationKey(line);
      if (!key) continue;
      let entry = byDrug.get(key);
      if (!entry) {
        entry = { key, label, brands: [], courses: [] };
        byDrug.set(key, entry);
      }
      const brand = line.drug.brand?.trim();
      if (brand && !entry.brands.includes(brand)) entry.brands.push(brand);
      entry.courses.push({
        encounterId: rx.id,
        date: rx.date,
        ...(line.drug.strength ? { strength: line.drug.strength } : {}),
        ...(line.sig.duration ? { duration: line.sig.duration } : {}),
        frequency: line.sig.frequency,
      });
    }
  }

  const medications = [...byDrug.values()]
    .map((m) => ({ ...m, courses: [...m.courses].sort(byDateDesc) }))
    // Most recently prescribed first: the chart is read to answer "what is
    // this child on", and a drug from 2024 is not the answer.
    .sort((a, b) => (b.courses[0]?.date ?? '').localeCompare(a.courses[0]?.date ?? ''));

  const diagnoses: string[] = [];
  const seen = new Set<string>();
  for (const v of visits) {
    for (const d of v.diagnosis) {
      const fold = d.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!fold || seen.has(fold)) continue;
      seen.add(fold);
      diagnoses.push(d);
    }
  }

  const dates = visits.map((v) => v.date).sort();
  return {
    patientId,
    visits,
    medications,
    diagnoses,
    ...(dates.length ? { firstSeen: dates[0], lastSeen: dates[dates.length - 1] } : {}),
  };
}

/**
 * How many distinct courses of one drug, as a plain count.
 *
 * Deliberately a count and not a verdict. "4 courses" is a fact; "frequent
 * antibiotic use" is a clinical opinion, and this module does not hold one.
 */
export function courseCount(m: ChartMedication): number {
  return m.courses.length;
}

/**
 * The allergy snapshots that disagree with each other across visits.
 *
 * This is why the patient-level list exists, and showing it is how a doctor
 * finds out it happened. Returns the distinct non-empty strings, newest first,
 * and an empty array when every visit said the same thing -- so the chart can
 * stay quiet in the normal case and speak up in the one that matters.
 */
export function allergyDisagreements(chart: PatientChart): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of chart.visits) {
    const snap = v.allergySnapshot;
    if (!snap) continue;
    const fold = snap.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(fold)) continue;
    seen.add(fold);
    out.push(snap);
  }
  return out.length > 1 ? out : [];
}
