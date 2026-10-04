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
import type { DocumentKindId } from './documents/index.ts';
import type { Concentration } from './dose.ts';
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
  /**
   * The same strength, as a number the millilitre calculation can use.
   *
   * `strength` stays the display string -- it is what prints and what a
   * pharmacist reads -- and this is the machine-readable half, because the
   * display string cannot be parsed at run time without being wrong
   * dangerously. `250mcg/ml` read by a regex that takes the digits before a
   * unit is 250 mg/mL, a thousandfold overdose one character away from the
   * ordinary case; `3.35g/5ml` is wrong by the same factor the other way.
   *
   * Absent on purpose for every strength that is not a mass per millilitre:
   * percentages, combinations (`20/120mg`), per-puff and per-drop strengths,
   * sachets and bare solids. A row without it shows milligrams and says
   * plainly that it cannot give a volume -- never a guessed one.
   *
   * See `domain/dose.ts`.
   */
  concentration?: Concentration;
  /** form id, resolved through the locale pack */
  form?: string;
  /** DRAP registration number; the provenance that makes the row checkable */
  drapRegNo?: string;
  price?: { amount: number; currency: string };
  alternates?: string[];
  provenance: 'DRAP' | 'manual';
  /**
   * WHO checked this row against the registry, and WHEN.
   *
   * `provenance: 'DRAP'` plus a registration number says the claim was made.
   * It does not say who made it, and a claim nobody's name is on is a claim
   * nobody can be asked about -- which is the same reasoning that put a named
   * person on a red flag and on a dosing row.
   *
   * DRAP publishes no bulk download and no API (re-checked September 2026;
   * `eapp.dra.gov.pk/WebProductIndex.php` is a search form), so reconciliation
   * is one row at a time by a human. This records that it happened rather than
   * pretending an import could.
   */
  drapChecked?: { by: string; date: string };
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
  /**
   * The top of a dose RANGE, when there is one.
   *
   * Most paediatric dosing is a band, not a number: paracetamol is 10-15
   * mg/kg per dose, and a doctor picks a round, syringe-measurable value
   * inside it. `mgPerKg` alone could not say that, so every range had to be
   * flattened to its low end -- which under-doses on paper and is not what any
   * source actually says.
   *
   * `mgPerKg` is the low end and this is the high end. A row with only
   * `mgPerKg` keeps its exact previous meaning, and a reader that ignores this
   * field still shows a dose that is within the band rather than above it.
   */
  mgPerKgHigh?: number;
  /** doses per day this mg/kg figure assumes */
  perDoses?: number;
  /**
   * The ceiling in the source's own words, for the prescriber to read.
   *
   * Prose, and left as prose: "4 doses in 24 hours", "40 mg/kg in 24 hours",
   * "500 mg as a single dose, or 100 mg twice daily for 3 days". Reading a
   * number out of that with a regex is the same mistake as reading one out of
   * a strength, so nothing does. The three numeric fields below are what the
   * arithmetic actually applies, and a row may state this text without them.
   */
  maxPerDay?: string;
  /** a hard ceiling on one dose, in mg, when the source gives one */
  maxMgPerDose?: number;
  /** a hard ceiling across 24 hours, in mg */
  maxMgPerDay?: number;
  /** a weight-scaled ceiling across 24 hours, in mg/kg */
  maxMgPerKgPerDay?: number;
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
   * The numbers were WRITTEN from standard practice, not transcribed from a
   * passage somebody opened.
   *
   * `reference` says where a dose can be checked. It has never said whether
   * anyone actually looked, and for the ten WHO rows this pack started with
   * the answer was yes -- they were transcribed from open WHO guidance. The
   * rows added since were drafted against ordinary paediatric practice so that
   * reviewing them is a check rather than an authoring job, and a row like
   * that must not be able to pass itself off as the first kind.
   *
   * So it is marked, the screen says so, and signing it off clears the mark --
   * because the sign-off IS somebody opening the reference and confirming the
   * number. There is no other way to clear it.
   */
  drafted?: boolean;
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
/**
 * One question in the background history.
 *
 * Mirrors `FindingDefinition` on purpose. A pack already declares examination
 * systems and a palette of findings, and `ExamSection.tsx` renders any pack's
 * systems without knowing what they are -- so the history is the same idea
 * pointed at a different part of the record, and it needs no new machinery.
 *
 * EVERY FIELD IS OPTIONAL TO FILL. Nothing in the history can block a save or
 * a print; `requiresForPrint` is untouched by any of this. The history is
 * something a doctor adds to over a child's life, not a form standing between
 * them and a prescription (PRODUCT.md 16: identification is an accelerator,
 * never a gate, and the same applies here).
 */
export interface HistoryFieldDefinition {
  id: string;
  label: string;
  /**
   * How it is filled. Defaults to 'text'.
   *
   * 'text' is the default precisely so a pack author who cannot enumerate the
   * answers still gets a usable field; 'choice' and 'chips' are the taps that
   * save typing where the answers ARE enumerable ("SVD / LSCS / instrumental"
   * is three taps, not a sentence).
   */
  kind?: 'text' | 'choice' | 'chips' | 'date' | 'number';
  /** the taps, for 'choice' and 'chips' */
  options?: string[];
  /** placeholder, and only ever a placeholder -- never a required format */
  hint?: string;
  /** unit shown beside a 'number', e.g. 'kg' for birth weight */
  unit?: string;
}

/**
 * A section of the background history: antenatal, birth, feeding, social.
 *
 * Pack DATA rather than code, because a paediatric history and an adult one
 * are different questionnaires and a third specialty will be a fourth.
 * Hardcoding either would make every new specialty a code change, which is
 * exactly what the pack seam exists to prevent.
 */
export interface HistorySectionDefinition {
  id: string;
  label: string;
  order?: number;
  /** one line under the heading, when the section needs explaining */
  note?: string;
  /**
   * The age band this section is OFFERED in.
   *
   * Birth history is noise on a fourteen-year-old, and a questionnaire that
   * asks everything of everyone is one nobody fills in. A section outside the
   * band is not offered -- but it is still SHOWN when it already holds
   * content, so a teenager never loses the birth history somebody recorded at
   * six months. See `domain/history.ts`, which is where that rule lives.
   */
  appliesTo?: { fromDays?: number; toDays?: number };
  fields: HistoryFieldDefinition[];
}

/**
 * A published immunisation schedule, as data.
 *
 * Here rather than in code so a different country's schedule is a different
 * pack. `reference` is not decoration: a schedule with no published source is
 * a list of opinions.
 */
export interface ImmunisationSchedule {
  reference: string;
  visits: Array<{
    id: string;
    label: string;
    /** age in days at which this visit is due, per the published schedule */
    atDays: number;
    /** what is given at this visit, e.g. ['BCG', 'OPV-0', 'Hep B-1'] */
    doses: string[];
  }>;
}

/**
 * A published milestone list.
 *
 * `typicalByDays` is a REFERENCE AGE, the same thing a growth chart's centile
 * band is, and it is displayed the same way: as the published norm beside what
 * was recorded. Nothing anywhere turns a blank into "delayed". That judgement
 * is the doctor's and it goes in `diagnosis`.
 */
export interface MilestoneCatalogue {
  reference: string;
  items: Array<{
    id: string;
    label: string;
    domain: 'gross' | 'fine' | 'speech' | 'social';
    typicalByDays: number;
  }>;
}

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
export type ModuleId = 'growth' | 'gfr' | 'bmi' | 'malnutrition' | 'dosecalc';

/** Re-exported so a pack author reads one file, not two. */
export type { DocumentKindId };

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
  /**
   * The background history this specialty asks about. Optional: a pack that
   * declares none simply has no history screen, rather than an empty one.
   */
  historySections?: HistorySectionDefinition[];
  immunisationSchedule?: ImmunisationSchedule;
  milestones?: MilestoneCatalogue;
  modules: ModuleId[];
  /**
   * The document kinds this specialty offers (`domain/documents`). Absent or
   * empty means prescriptions only, which is what every pack written before
   * this existed meant -- a paediatric OPD pack has no business offering a
   * discharge summary, and a ward pack has no business hiding one.
   */
  documents?: DocumentKindId[];
  /** redFlagId -> who signed the wording off, and when */
  redFlagReview?: Record<string, RedFlagReview>;
  /**
   * tier-1 advice id -> the same sign-off, for the same reason.
   *
   * A SEPARATE map rather than one keyed by any advice id, because the two
   * carry different enforcement: an unreviewed red flag BLOCKS export, and an
   * unreviewed tier-1 line only warns. Tier-1 prose reaches a patient too and
   * deserves a human's name on it, but a pack that predates this field must
   * not become un-exportable the day it is added. Merging the maps would make
   * which rule applies a matter of reading the id prefix.
   */
  adviceReview?: Record<string, RedFlagReview>;
  /**
   * Who signed off each dosing row, and against what numbers.
   *
   * Keyed by `dosingKey(entry)`, with `wording` holding
   * `dosingFingerprint(entry)` -- so editing a dose after sign-off revokes it
   * without anybody remembering to.
   *
   * This exists because the product claimed "clinician-verified" while
   * `DosingEntry.verified` was a boolean anyone could set and nothing checked.
   * `validateContentPack` now refuses `verified: true` without a matching
   * entry here.
   */
  dosingReview?: Record<string, RedFlagReview>;
  /** module-specific configuration, e.g. which growth measures to offer */
  moduleConfig?: {
    growth?: {
      measures: GrowthMeasureId[];
      defaultReference: 'WHO' | 'CDC';
    };
    /**
     * The acute-malnutrition protocol this specialty follows.
     *
     * Required rather than defaulted, because there is no safe default: WHO's
     * 2023 guideline admits on weight-for-height OR MUAC OR oedema, while
     * Pakistan's national programme admits on MUAC or oedema alone. Shipping
     * one as "the" default would silently apply another country's case
     * definition to a clinic's caseload.
     */
    malnutrition?: {
      /** which criteria this protocol admits on */
      criteria: Array<'oedema' | 'whz' | 'muac'>;
      muacSevereMm: number;
      muacModerateMm: number;
      whzSevere: number;
      whzModerate: number;
      /** source + edition. REQUIRED and non-empty, exactly like DosingEntry. */
      reference: string;
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

  /*
    A pack cannot call itself verified while its doses are not.

    `ContentPack.verified` means "a clinician of this specialty has signed the
    pack itself off -- doses reviewed, formulary reconciled, Urdu read aloud".
    The paediatrics pack shipped with it set to true, an author named 'Pack
    author', and zero signed dosing rows; the website repeated the claim. The
    flag was documentation, and documentation drifts. This makes it a
    consequence.
  */
  if (pack.verified) {
    const unsigned = unreviewedDosing(pack);
    if (unsigned.length > 0) {
      issues.push({
        severity: 'error',
        where: 'verified',
        message:
          `pack claims to be clinician-verified, but ${unsigned.length} of ` +
          `${new Set(pack.dosing.map(dosingKey)).size} dosing rows are not signed off`,
      });
    }
  }

  const seenSection = new Set<string>();
  for (const section of pack.historySections ?? []) {
    if (seenSection.has(section.id)) {
      issues.push({
        severity: 'error',
        where: `historySections.${section.id}`,
        message: 'duplicate history section id',
      });
    }
    seenSection.add(section.id);
    if (!section.label.trim()) {
      issues.push({
        severity: 'error',
        where: `historySections.${section.id}`,
        message: 'history section has no label',
      });
    }
    const band = section.appliesTo;
    if (band?.fromDays !== undefined && band.toDays !== undefined && band.fromDays > band.toDays) {
      issues.push({
        severity: 'error',
        where: `historySections.${section.id}`,
        message: 'appliesTo band is inside out: fromDays is after toDays, so it matches nobody',
      });
    }
    const seenField = new Set<string>();
    for (const field of section.fields) {
      const key = `historySections.${section.id}/${field.id}`;
      if (seenField.has(field.id)) {
        issues.push({ severity: 'error', where: key, message: 'duplicate history field id' });
      }
      seenField.add(field.id);
      if (!field.label.trim()) {
        issues.push({ severity: 'error', where: key, message: 'history field has no label' });
      }
      // A choice with nothing to choose renders as an empty row: the whole
      // point of the kind is that the common answer is one tap.
      if ((field.kind === 'choice' || field.kind === 'chips') && !field.options?.length) {
        issues.push({
          severity: 'error',
          where: key,
          message: `history field is a '${field.kind}' with no options`,
        });
      }
    }
  }

  const seenVisit = new Set<string>();
  for (const visit of pack.immunisationSchedule?.visits ?? []) {
    if (seenVisit.has(visit.id)) {
      issues.push({
        severity: 'error',
        where: `immunisationSchedule.${visit.id}`,
        message: 'duplicate immunisation visit id',
      });
    }
    seenVisit.add(visit.id);
    if (!visit.doses.length) {
      issues.push({
        severity: 'error',
        where: `immunisationSchedule.${visit.id}`,
        message: 'immunisation visit gives nothing',
      });
    }
  }
  if (pack.immunisationSchedule && !pack.immunisationSchedule.reference.trim()) {
    // Same rule as a dose: a schedule with no published source is a list of
    // opinions, and this app does not ship those.
    issues.push({
      severity: 'error',
      where: 'immunisationSchedule',
      message: 'schedule has no reference',
    });
  }
  if (pack.milestones && !pack.milestones.reference.trim()) {
    issues.push({ severity: 'error', where: 'milestones', message: 'milestones have no reference' });
  }
  const seenMilestone = new Set<string>();
  for (const item of pack.milestones?.items ?? []) {
    if (seenMilestone.has(item.id)) {
      issues.push({
        severity: 'error',
        where: `milestones.${item.id}`,
        message: 'duplicate milestone id',
      });
    }
    seenMilestone.add(item.id);
  }

  // The rule with teeth: no dose without a citation.
  const genericsWithDosing = new Set<string>();
  const seenDosingKey = new Set<string>();
  pack.dosing.forEach((row, i) => {
    genericsWithDosing.add(row.generic.toLowerCase());
    /*
      `dosingKey` has to be unique, and until now nothing said so.

      A sign-off is stored against the key, not against the array index. Two
      rows that collide therefore share one signature: tick the 5-10 kg row
      and the 10-20 kg row beside it goes green without anyone reading it.
      That is the exact failure the review flow exists to prevent, so a
      collision is an error here rather than a surprise there.

      It bites as soon as the pack grows: `generic|indication|ageBand.label`
      does not include the weight band or the route, so an oral and an IV row
      for the same indication in the same age band are one key. The fix is for
      the pack to say what distinguishes them -- a different indication, or an
      age-band label that names the route -- which is also what the reviewer
      needs to see on screen to tell the two rows apart.
    */
    const key = dosingKey(row);
    if (seenDosingKey.has(key)) {
      issues.push({
        severity: 'error',
        where: `dosing[${i}] ${row.generic}`,
        message:
          `two dosing rows share the identity "${key}", so they would share one ` +
          'sign-off. Give them different indications or age-band labels.',
      });
    }
    seenDosingKey.add(key);
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
    /*
      A citation has to be earned.

      BNFC, Nelson, Harriet Lane, Lexicomp and Micromedex are consult-and-cite:
      a clinician reads the monograph, writes the entry in their own words, and
      stores the citation. A row naming one of them while marked neither
      `drafted` (written to be checked, and saying so) nor `verified` (somebody
      opened it and signed) is claiming a transcription nobody made.

      A warning rather than an error, deliberately: at load time the app has to
      run on whatever pack it is given, and refusing to open a colleague's pack
      over a provenance label would cost a clinic its content. The builder is
      where a human is present, and `tests/pack.test.ts` holds the repo's own
      packs to the harder line.
    */
    if (
      /BNFC|BNF for Children|Nelson|Harriet Lane|Lexicomp|Micromedex/i.test(row.reference) &&
      !row.drafted &&
      !row.verified
    ) {
      issues.push({
        severity: 'warning',
        where: `dosing[${i}] ${row.generic}`,
        message:
          'cites a consult-and-cite source but is neither marked `drafted` nor ' +
          'signed off, so nothing says where its numbers actually came from',
      });
    }
    // A row must express SOME dose -- weight-based, fixed, or (rarely) just a
    // ceiling -- or it renders as nothing on the script, which is a UI bug
    // wearing a data hole. A row whose whole content is a refusal to suggest a
    // dose (INR-guided warfarin, titrated insulin) still says so via
    // `fixedDose`; that is a valid dose expression, not an empty one.
    /*
      The rule that makes `verified` mean something.

      It was a free-floating boolean: anybody could set it, nothing checked
      it, and the site advertised "clinician-verified" while not one row was
      signed. Now it has to be backed by a `dosingReview` entry whose
      fingerprint still matches the row's numbers -- so editing a dose after
      sign-off revokes it rather than silently carrying the old approval
      forward onto a new number.
    */
    if (row.verified) {
      const review = pack.dosingReview?.[dosingKey(row)];
      if (!review?.reviewedBy?.trim()) {
        issues.push({
          severity: 'error',
          where: `dosing[${i}] ${row.generic}`,
          message:
            'row is marked verified but nobody has signed it off. Set `verified` ' +
            'only through the review flow, which records who and when.',
        });
      } else if (review.wording !== dosingFingerprint(row)) {
        issues.push({
          severity: 'error',
          where: `dosing[${i}] ${row.generic}`,
          message:
            `dose changed after ${review.reviewedBy} signed it off on ${review.date}. ` +
            'Re-check it against the source and sign again.',
        });
      }
    }
    /*
      A ceiling that is not a positive number is not a ceiling.

      Zero or a negative would clamp every dose on the row to nothing, and a
      row that silently suggests 0 mg is worse than a row that suggests
      nothing: the screen shows a number, so it looks computed.
    */
    for (const [field, value] of [
      ['maxMgPerDose', row.maxMgPerDose],
      ['maxMgPerDay', row.maxMgPerDay],
      ['maxMgPerKgPerDay', row.maxMgPerKgPerDay],
    ] as const) {
      if (value !== undefined && !(value > 0)) {
        issues.push({
          severity: 'error',
          where: `dosing[${i}] ${row.generic}`,
          message: `${field} must be a positive number`,
        });
      }
    }
    if (row.mgPerKgHigh !== undefined && row.mgPerKg === undefined) {
      issues.push({
        severity: 'error',
        where: `dosing[${i}] ${row.generic}`,
        message: 'has the top of a dose range but not the bottom',
      });
    }
    if (
      row.mgPerKgHigh !== undefined &&
      row.mgPerKg !== undefined &&
      row.mgPerKgHigh < row.mgPerKg
    ) {
      issues.push({
        severity: 'error',
        where: `dosing[${i}] ${row.generic}`,
        message: 'dose range is inside out: the top is below the bottom',
      });
    }
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
    /*
      A warning rather than an error: every row shipped today predates this
      field, and a pack that became un-exportable on upgrade would push
      authors away from the thing instead of toward it. The same reasoning as
      tier-1 sign-off.
    */
    if (row.provenance === 'DRAP' && row.drapRegNo && !row.drapChecked?.by?.trim()) {
      issues.push({
        severity: 'warning',
        where: `formularySeed[${i}] ${row.brand}`,
        message:
          'says it was checked against DRAP, but nobody\u2019s name is on it. A claim nobody signed is a claim nobody can be asked about.',
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

  /*
    Malnutrition is configured or it is off. Unlike growth, there is no safe
    default to fall back to: WHO 2023 and Pakistan's national programme use
    different case definitions, and picking one silently would apply another
    country's criteria to a clinic's caseload.
  */
  if (pack.modules.includes('malnutrition')) {
    const cfg = pack.moduleConfig?.malnutrition;
    if (!cfg) {
      issues.push({
        severity: 'error',
        where: 'moduleConfig.malnutrition',
        message:
          'pack enables the malnutrition module but names no protocol. WHO 2023 and national programmes admit on different criteria; there is no default.',
      });
    } else {
      if (!cfg.criteria?.length) {
        issues.push({
          severity: 'error',
          where: 'moduleConfig.malnutrition.criteria',
          message: 'a protocol that admits on no criteria can never classify a child',
        });
      }
      // Same rule as DosingEntry and ScoreDefinition: a cut-off with no
      // citation is a number with no provenance in front of a doctor.
      if (!cfg.reference?.trim()) {
        issues.push({
          severity: 'error',
          where: 'moduleConfig.malnutrition.reference',
          message: 'no source for these cut-offs. A threshold with no citation is not a threshold.',
        });
      }
      if (cfg.muacSevereMm >= cfg.muacModerateMm) {
        issues.push({
          severity: 'error',
          where: 'moduleConfig.malnutrition',
          message: `severe MUAC cut-off (${cfg.muacSevereMm}mm) must be below the moderate one (${cfg.muacModerateMm}mm)`,
        });
      }
      if (cfg.whzSevere >= cfg.whzModerate) {
        issues.push({
          severity: 'error',
          where: 'moduleConfig.malnutrition',
          message: `severe WHZ cut-off (${cfg.whzSevere}) must be below the moderate one (${cfg.whzModerate})`,
        });
      }
    }
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
 * The stable identity of a dosing row.
 *
 * `DosingEntry` has no id -- a row is identified by what it is about. This
 * composite is already the key `builder/diff.ts` uses to match rows across a
 * publish, and exporting it here means the sign-off and the diff agree by
 * construction rather than by two developers writing the same template string.
 */
export function dosingKey(entry: DosingEntry): string {
  return `${entry.generic}|${entry.indication ?? ''}|${entry.ageBand?.label ?? ''}`;
}

/**
 * A fingerprint of what a clinician actually signed off on.
 *
 * The CLINICAL fields only. `note` and `indication` are prose and can be
 * reworded without changing the dose; `mgPerKg` cannot. Change any of these
 * and the sign-off dies automatically -- which is the whole mechanism
 * `RedFlagReview.wording` already provides for advice, pointed at numbers
 * instead of sentences.
 *
 * Deliberately NOT a cryptographic hash. This detects honest edits, not
 * forgery: a pack file can be edited by hand anyway, which is why a pack that
 * matters is SIGNED (domain/addonSignature.ts). Reusing `redFlagWording` keeps
 * one hash in the codebase rather than two.
 */
export function dosingFingerprint(entry: DosingEntry): string {
  return redFlagWording([
    String(entry.mgPerKg ?? ''),
    String(entry.mgPerKgHigh ?? ''),
    String(entry.perDoses ?? ''),
    entry.maxPerDay ?? '',
    // The numeric ceilings are as clinical as the dose itself -- lowering a
    // cap changes what gets given -- so they revoke a sign-off the same way.
    String(entry.maxMgPerDose ?? ''),
    String(entry.maxMgPerDay ?? ''),
    String(entry.maxMgPerKgPerDay ?? ''),
    entry.fixedDose ?? '',
    entry.route,
    entry.weeklyOnly ? 'weekly-only' : '',
    String(entry.ageBand?.fromDays ?? ''),
    String(entry.ageBand?.toDays ?? ''),
    String(entry.weightBand?.fromKg ?? ''),
    String(entry.weightBand?.toKg ?? ''),
  ]);
}

/**
 * Dosing rows nobody has signed off, or whose numbers changed after sign-off.
 *
 * Same shape and same helper as the advice equivalents below. A dose is the
 * most consequential claim this app makes -- it is printed, handed to a
 * parent, and measured into a syringe -- so it gets the same machinery the
 * red flags get, not a weaker one.
 */
export function unreviewedDosing(
  pack: ContentPack,
): Array<{ id: string; reason: 'never-reviewed' | 'wording-changed' }> {
  const byKey = new Map(pack.dosing.map((row) => [dosingKey(row), row]));
  return unreviewed([...byKey.keys()], pack.dosingReview, (key) => {
    const row = byKey.get(key);
    return row ? dosingFingerprint(row) : '';
  });
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
  return unreviewed(pack.advicePacks.tier2, pack.redFlagReview, wordingOf);
}

/**
 * The same, for tier-1 advice. Reported as a warning everywhere, including in
 * the builder -- see `ContentPack.adviceReview` for why the enforcement
 * differs from tier 2's.
 */
export function unreviewedAdvice(
  pack: ContentPack,
  wordingOf: (adviceId: string) => string,
): Array<{ id: string; reason: 'never-reviewed' | 'wording-changed' }> {
  return unreviewed(pack.advicePacks.tier1, pack.adviceReview, wordingOf);
}

function unreviewed(
  ids: string[],
  reviews: Record<string, RedFlagReview> | undefined,
  wordingOf: (id: string) => string,
): Array<{ id: string; reason: 'never-reviewed' | 'wording-changed' }> {
  const out: Array<{ id: string; reason: 'never-reviewed' | 'wording-changed' }> = [];
  for (const id of ids) {
    const review = reviews?.[id];
    if (!review?.reviewedBy?.trim()) out.push({ id, reason: 'never-reviewed' });
    else if (review.wording !== wordingOf(id)) out.push({ id, reason: 'wording-changed' });
  }
  return out;
}
