/**
 * ContentPack: the specialty seam (PRODUCT.md 4a, CLAUDE.md 6a).
 *
 * The rule the type system is here to make cheap to obey: NO specialty content
 * is a hardcoded constant in a component. Exam systems, findings chips, advice
 * tiers 1-2, formulary seed -- all of it arrives as data through this shape.
 * If adding a specialty would require editing a .tsx file, that is a bug, in
 * exactly the same way that needing to edit .tsx to add a language is a bug.
 *
 * v1 ships exactly one pack: paediatrics, authored by a paediatrician. The
 * schema is open; the content is not ours to write. A pack authored by a
 * non-specialist is a liability with someone's name on it.
 */
import type { GrowthMeasureId } from './prescription.ts';

// --- catalogue vs evidence, kept apart on purpose ---------------------------

/**
 * Layer 1: the CATALOGUE. What brands exist. Keyed by brand.
 * Sourced from DRAP (the registry of record) plus the brands actually
 * prescribed. Commercial sites may contribute price/alternates and NOTHING else
 * -- their "dosage" text is leaflet-derived marketing copy, not evidence.
 */
export interface FormularyEntry {
  brand: string;
  generic: string;
  strength?: string;
  /** form id, resolved through the locale pack */
  form?: string;
  /** DRAP registration number; the provenance that makes the row checkable */
  drapRegNo?: string;
  price?: { amount: number; currency: string };
  alternates?: string[];
  provenance: 'DRAP' | 'manual';
}

/**
 * Layer 2: the EVIDENCE. What dose is right. Keyed by generic, joined to the
 * catalogue on `generic` so messy commercial catalogue data is quarantined away
 * from the safety-critical part.
 *
 * `reference` is REQUIRED and non-empty. A dose without a citation is a build
 * error, not a warning: the citation is both the legal cover and the
 * prescriber's sanity-check before signing. See PRODUCT.md 11a.
 */
export interface DosingEntry {
  generic: string;
  indication?: string;
  ageBand?: { fromDays?: number; toDays?: number; label: string };
  weightBand?: { fromKg?: number; toKg?: number };
  mgPerKg?: number;
  /** doses per day this mg/kg figure assumes */
  perDoses?: number;
  maxPerDay?: string;
  /**
   * A fixed adult regimen -- "500 mg to 1 g every 4 to 6 hours" -- for the
   * common case where dosing is not weight-based at all. `mgPerKg` and
   * `fixedDose` are alternative ways to express the SAME thing (the dose),
   * not a dose plus a ceiling; a row may also legitimately use this field to
   * say a dose cannot be reduced to a formula (INR-guided, titrated against a
   * glucose log) -- see the "row must express a dose" check below, which
   * exists so that case renders instead of silently showing nothing.
   */
  fixedDose?: string;
  route: string;
  /** source + edition + section. Non-empty, always. */
  reference: string;
  /**
   * Whether a clinician has signed this row off against the source. Seed rows
   * ship false and the UI says so: an uncited-by-me suggestion must not wear
   * the same authority as one the prescribing doctor has verified.
   */
  verified: boolean;
  /** free-text caution shown with the suggestion */
  note?: string;
  /**
   * True only for a drug where a daily frequency is not merely wrong but
   * dangerous -- once-weekly methotrexate taken daily is a known killer. Set
   * this ONLY when the weekly interval itself is the safety boundary, not for
   * every drug that happens to be dosed weekly by convention. See
   * `weeklyOnlyViolation` in domain/sig.ts, which is what actually acts on it.
   */
  weeklyOnly?: boolean;
}

// --- exam palette ----------------------------------------------------------

export interface FindingDefinition {
  id: string;
  /** English; exam is en-only by design (PRODUCT.md 6) */
  label: string;
  /** offer an inline value field ("3cm", "grade 2") */
  takesValue?: boolean;
  /** placeholder for that field */
  valueHint?: string;
}

export interface ExamSystemDefinition {
  id: string;
  label: string;
  /** systems the doctor opens most, first */
  order?: number;
}

// --- investigations palette ------------------------------------------------

/**
 * One offered test. Same shape as FindingDefinition on purpose -- labs reuse
 * the exam chip control wholesale, so the definitions should not diverge.
 */
export interface LabDefinition {
  id: string;
  /** English, always. A lab technician reads "CBC", never a transliteration. */
  label: string;
  /** offer an inline qualifier field ("PA view", "abdomen") */
  takesValue?: boolean;
  valueHint?: string;
  /**
   * A property of the TEST, not a decision about the patient.
   *
   * Used to OFFER the matching tier-1 advice line ("nothing to eat for 8 hours
   * before the test"), never to add one silently -- the library suggests and
   * the prescriber confirms (PRODUCT.md rule 3.2).
   */
  fasting?: boolean;
}

/** Haematology, Biochemistry, Microbiology, Imaging -- editable per specialty. */
export interface LabCategoryDefinition {
  id: string;
  label: string;
  order?: number;
}

// --- clinical scores ---------------------------------------------------------

/**
 * A score is PACK DATA -- tick criteria, add integers, look up a band -- and
 * that ceiling is deliberate. Anything needing arithmetic beyond a sum and a
 * band lookup (a percentile, an exponentiated ratio) is a FORMULA, and a
 * formula belongs in code with tests against published values, the same way
 * the growth module does. See `ModuleId` below and CLAUDE.md 6d.
 */
export interface ScoreCriterion {
  id: string;
  label: string;
  points: number;
  /**
   * Criteria sharing a `group` are MUTUALLY EXCLUSIVE -- e.g. CHA₂DS₂-VASc's
   * two age bands (65-74 vs ≥75): a patient is in exactly one, never both, so
   * ticking a second criterion in the same group must not simply add its
   * points on top. `computeScore` enforces this defensively (counts only the
   * highest-point ticked criterion per group) regardless of what ticked them;
   * the UI additionally unticks the rest of the group when one is chosen, so
   * the score never visibly shows two mutually-exclusive boxes ticked at once.
   */
  group?: string;
}

/**
 * `note` carries the SOURCE'S OWN published outcome, attributed -- "30-day
 * mortality 14% (Lim et al., Thorax 2003)" -- never an instruction in the
 * app's voice. The app must never print "admit" or "start anticoagulation";
 * that is automated clinical judgement (PRODUCT.md rule 3.3).
 */
export interface ScoreBand {
  min: number;
  max: number;
  label: string;
  note?: string;
}

export interface ScoreDefinition {
  id: string;
  label: string;
  criteria: ScoreCriterion[];
  bands: ScoreBand[];
  /** source + edition. REQUIRED and non-empty, exactly like DosingEntry. */
  reference: string;
}

// --- the pack --------------------------------------------------------------

/**
 * A CLOSED union on purpose. A module is code -- a formula, tested against
 * published values, with its own panel -- never something a pack can invent
 * by declaring an id. Adding a module means adding both a case here AND the
 * code it names (`domain/modules/`); an id with no matching code is a build
 * error, and that is the property this union exists to buy (CLAUDE.md 6d).
 */
export type ModuleId = 'growth' | 'gfr' | 'bmi';

/**
 * Sign-off on one tier-2 red flag.
 *
 * PRODUCT.md 9 forbids free text in tier 2 because "a mistranslated red flag
 * can hurt a child". The structural validators catch a MISSING translation;
 * nothing automatic can catch a WRONG one. So authoring a red flag carries the
 * same discipline a dose does: a named human, on a date, saying they checked
 * it. `reference` is to a dosing row what `reviewedBy` is to a red flag.
 *
 * Editing the wording of a reviewed red flag clears its review -- a sign-off is
 * on a specific sentence, not on an id.
 */
export interface RedFlagReview {
  reviewedBy: string;
  /** ISO date */
  date: string;
  /** hash of the reviewed wording, so an edit invalidates the sign-off */
  wording: string;
}

export interface ContentPack {
  id: string;
  specialty: string;
  /** who authored the clinical content, and when. Not decoration. */
  author: { name: string; credential: string; updated: string };
  /**
   * Whether a clinician of this specialty has signed the pack itself off --
   * doses reviewed, formulary reconciled, Urdu read aloud. `false` badges the
   * pack as a draft everywhere it appears (Settings, the pack picker) rather
   * than hiding it: the honesty is carried by the UI, not by keeping the pack
   * out of reach. Independent of the per-row `verified` on a DosingEntry --
   * a pack can ship with every row still individually unverified.
   */
  verified: boolean;
  examSystems: ExamSystemDefinition[];
  /** systemId -> chips offered for that system */
  findingsPalette: Record<string, FindingDefinition[]>;
  /** investigation categories this specialty offers, in offer order */
  labCategories: LabCategoryDefinition[];
  /** categoryId -> tests offered under it */
  labsPalette: Record<string, LabDefinition[]>;
  advicePacks: {
    /** tier-1 template ids this specialty offers, in offer order */
    tier1: string[];
    /** tier-2 red-flag ids this specialty offers */
    tier2: string[];
  };
  /** sig template ids this specialty offers, in offer order */
  sigTemplates: string[];
  formularySeed: FormularyEntry[];
  dosing: DosingEntry[];
  /** clinical scores this specialty offers -- see ScoreDefinition above */
  scores?: ScoreDefinition[];
  modules: ModuleId[];
  /** redFlagId -> who signed the wording off, and when */
  redFlagReview?: Record<string, RedFlagReview>;
  /** module-specific configuration, e.g. which growth measures to offer */
  moduleConfig?: {
    growth?: {
      measures: GrowthMeasureId[];
      defaultReference: 'WHO' | 'CDC';
    };
  };
  /**
   * Default vocabulary choices for this specialty. Paediatric instructions
   * address a caregiver ("give"), adult ones address the patient ("take") --
   * a pack decision, not a code decision.
   */
  sigDefaults?: { slots?: Record<string, string> };
}

// --- validation ------------------------------------------------------------

export interface PackIssue {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

/**
 * Structural validation for a content pack. Runs in tests, and is the same
 * check the pack-authoring surface applies before it will let you export --
 * so an authoring mistake is caught by the author, not by a patient.
 */
export function validateContentPack(pack: ContentPack): PackIssue[] {
  const issues: PackIssue[] = [];

  const systemIds = new Set(pack.examSystems.map((s) => s.id));
  for (const id of Object.keys(pack.findingsPalette)) {
    if (!systemIds.has(id)) {
      issues.push({
        severity: 'error',
        where: `findingsPalette.${id}`,
        message: 'palette for a system this pack does not declare',
      });
    }
  }
  for (const system of pack.examSystems) {
    if (!pack.findingsPalette[system.id]) {
      issues.push({
        severity: 'warning',
        where: `examSystems.${system.id}`,
        message: 'system has no findings palette; it will be free-text only',
      });
    }
  }

  const seenFinding = new Set<string>();
  for (const [systemId, findings] of Object.entries(pack.findingsPalette)) {
    for (const finding of findings) {
      const key = `${systemId}/${finding.id}`;
      if (seenFinding.has(key)) {
        issues.push({ severity: 'error', where: key, message: 'duplicate finding id' });
      }
      seenFinding.add(key);
      if (!finding.label.trim()) {
        issues.push({ severity: 'error', where: key, message: 'finding has no label' });
      }
    }
  }

  const categoryIds = new Set(pack.labCategories.map((c) => c.id));
  for (const id of Object.keys(pack.labsPalette)) {
    if (!categoryIds.has(id)) {
      issues.push({
        severity: 'error',
        where: `labsPalette.${id}`,
        message: 'palette for a lab category this pack does not declare',
      });
    }
  }
  for (const category of pack.labCategories) {
    if (!pack.labsPalette[category.id]) {
      issues.push({
        severity: 'warning',
        where: `labCategories.${category.id}`,
        message: 'category has no tests; it will be free-text only',
      });
    }
  }
  const seenLab = new Set<string>();
  for (const [categoryId, labs] of Object.entries(pack.labsPalette)) {
    for (const lab of labs) {
      const key = `${categoryId}/${lab.id}`;
      if (seenLab.has(key)) {
        issues.push({ severity: 'error', where: key, message: 'duplicate lab id' });
      }
      seenLab.add(key);
      if (!lab.label.trim()) {
        issues.push({ severity: 'error', where: key, message: 'lab has no label' });
      }
    }
  }

  // The rule with teeth: no dose without a citation.
  const genericsWithDosing = new Set<string>();
  pack.dosing.forEach((row, i) => {
    genericsWithDosing.add(row.generic.toLowerCase());
    if (!row.reference || !row.reference.trim()) {
      issues.push({
        severity: 'error',
        where: `dosing[${i}] ${row.generic}`,
        message:
          'dosing row has no reference. A dose without a citation cannot ship (PRODUCT.md 11a).',
      });
    }
    if (!row.route?.trim()) {
      issues.push({
        severity: 'error',
        where: `dosing[${i}] ${row.generic}`,
        message: 'dosing row has no route',
      });
    }
    // A row must express SOME dose -- weight-based, fixed, or (rarely) just a
    // ceiling -- or it renders as nothing on the script, which is a UI bug
    // wearing a data hole. A row whose whole content is a refusal to suggest a
    // dose (INR-guided warfarin, titrated insulin) still says so via
    // `fixedDose`; that is a valid dose expression, not an empty one.
    if (!row.mgPerKg && !row.fixedDose && !row.maxPerDay) {
      issues.push({
        severity: 'error',
        where: `dosing[${i}] ${row.generic}`,
        message:
          'dosing row expresses no dose at all -- none of mgPerKg, fixedDose or maxPerDay is set',
      });
    }
  });

  const seenBrand = new Set<string>();
  pack.formularySeed.forEach((row, i) => {
    const key = `${row.brand.toLowerCase()}|${row.strength ?? ''}|${row.form ?? ''}`;
    if (seenBrand.has(key)) {
      issues.push({
        severity: 'error',
        where: `formularySeed[${i}] ${row.brand}`,
        message: 'duplicate brand/strength/form',
      });
    }
    seenBrand.add(key);
    if (!row.generic.trim()) {
      issues.push({
        severity: 'error',
        where: `formularySeed[${i}] ${row.brand}`,
        message: 'catalogue row has no generic; the dosing join is on generic',
      });
    }
    if (row.provenance === 'DRAP' && !row.drapRegNo) {
      issues.push({
        severity: 'error',
        where: `formularySeed[${i}] ${row.brand}`,
        message: 'claims DRAP provenance but carries no registration number',
      });
    }
  });

  for (const id of pack.advicePacks.tier2) {
    const review = pack.redFlagReview?.[id];
    if (!review?.reviewedBy?.trim()) {
      issues.push({
        severity: 'warning',
        where: `advicePacks.tier2.${id}`,
        message:
          'red flag has no clinical sign-off. Nothing automatic can catch a wrong translation of a return precaution (PRODUCT.md 9).',
      });
    }
  }

  if (pack.modules.includes('growth') && !pack.moduleConfig?.growth) {
    issues.push({
      severity: 'error',
      where: 'moduleConfig.growth',
      message: 'pack enables the growth module but does not configure it',
    });
  }

  // Same rule as dosing: a score with no citation is a number with no
  // provenance in front of a doctor, and that is a build error, not a warning.
  const seenScore = new Set<string>();
  for (const score of pack.scores ?? []) {
    if (seenScore.has(score.id)) {
      issues.push({ severity: 'error', where: `scores.${score.id}`, message: 'duplicate score id' });
    }
    seenScore.add(score.id);
    if (!score.reference || !score.reference.trim()) {
      issues.push({
        severity: 'error',
        where: `scores.${score.id}`,
        message: 'score has no reference. A score without a citation cannot ship.',
      });
    }
    if (score.criteria.length === 0) {
      issues.push({
        severity: 'error',
        where: `scores.${score.id}`,
        message: 'score has no criteria',
      });
    }
    if (score.bands.length === 0) {
      issues.push({
        severity: 'error',
        where: `scores.${score.id}`,
        message: 'score has no bands to report a result in',
      });
    }
  }

  return issues;
}

export function packErrors(pack: ContentPack): PackIssue[] {
  return validateContentPack(pack).filter((i) => i.severity === 'error');
}

/** A stable fingerprint of a red flag's wording across every locale. */
export function redFlagWording(strings: string[]): string {
  const joined = strings.join('\u0000');
  let hash = 0;
  for (let i = 0; i < joined.length; i += 1) {
    hash = (Math.imul(hash, 31) + joined.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Red flags nobody has signed off, or whose wording changed after sign-off.
 *
 * Reported as a WARNING by `validateContentPack` so the shipped pack -- whose
 * Urdu is a first draft awaiting the review PRODUCT.md 15 demands -- still
 * loads and still prints. The pack BUILDER treats the same list as blocking,
 * because that is the moment a human is present to do the reviewing.
 */
export function unreviewedRedFlags(
  pack: ContentPack,
  wordingOf: (redFlagId: string) => string,
): Array<{ id: string; reason: 'never-reviewed' | 'wording-changed' }> {
  const out: Array<{ id: string; reason: 'never-reviewed' | 'wording-changed' }> = [];
  for (const id of pack.advicePacks.tier2) {
    const review = pack.redFlagReview?.[id];
    if (!review?.reviewedBy?.trim()) out.push({ id, reason: 'never-reviewed' });
    else if (review.wording !== wordingOf(id)) out.push({ id, reason: 'wording-changed' });
  }
  return out;
}
