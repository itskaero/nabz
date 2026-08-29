/**
 * Clinical scores for the medicine pack -- PACK DATA, per domain/pack.ts's
 * `ScoreDefinition`: tick criteria, sum integers, look up a band. Nothing
 * here does arithmetic beyond a sum, which is exactly the ceiling that keeps
 * a score out of `domain/modules/` (eGFR, by contrast, is a formula and lives
 * there instead -- see gfr.ts).
 *
 * SAFETY LINE, enforced by convention here and by review in the builder: a
 * band's `note` reports the SOURCE'S OWN published finding, attributed. It
 * never tells the doctor what to do. "30-day mortality ~9% in the derivation
 * cohort" is reporting; "admit" is automated clinical judgement (PRODUCT.md
 * rule 3.3) and does not belong in this file or any pack.
 *
 * Percentages below are given only where they are the figures universally
 * reproduced for that score (CURB-65's are the most consistently quoted
 * clinical statistic in this file); where memory of the exact published rate
 * per point is less certain, the band reports risk qualitatively and points
 * at the citation instead of a number this pack has not verified -- the same
 * caution `verified: false` on the whole pack already signals.
 */
import type { ScoreDefinition } from '@domain/pack.ts';

const CURB65_REF =
  'Lim WS, van der Eerden MM, Laing R, et al. "Defining community acquired pneumonia ' +
  'severity on presentation to hospital: an international derivation and validation ' +
  'study." Thorax 2003;58:377-382. British Thoracic Society community-acquired ' +
  'pneumonia guideline.';

const CHA2DS2VASC_REF =
  'Lip GYH, Nieuwlaat R, Pisters R, Lane DA, Crijns HJGM. "Refining clinical risk ' +
  'stratification for predicting stroke and thromboembolism in atrial fibrillation ' +
  'using a novel risk factor-based approach." Chest 2010;137(2):263-272.';

const HASBLED_REF =
  'Pisters R, Lane DA, Nieuwlaat R, de Vos CB, Crijns HJGM, Lip GYH. "A novel user-' +
  'friendly score (HAS-BLED) to assess 1-year risk of major bleeding in patients ' +
  'with atrial fibrillation." Chest 2010;138(5):1093-1100.';

export const medicineScores: ScoreDefinition[] = [
  {
    id: 'curb65',
    label: 'CURB-65 (pneumonia severity)',
    criteria: [
      { id: 'confusion', label: 'New confusion or disorientation', points: 1 },
      { id: 'urea', label: 'Blood urea > 7 mmol/L (roughly BUN > 19 mg/dL)', points: 1 },
      { id: 'rr', label: 'Respiratory rate ≥ 30 breaths/min', points: 1 },
      {
        id: 'bp',
        label: 'Blood pressure: systolic < 90 mmHg or diastolic ≤ 60 mmHg',
        points: 1,
      },
      { id: 'age65', label: 'Age ≥ 65 years', points: 1 },
    ],
    bands: [
      {
        min: 0,
        max: 1,
        label: 'Low severity',
        note:
          'approx. 1.5% 30-day mortality in the derivation/validation cohorts, the lowest ' +
          'of the three bands',
      },
      {
        min: 2,
        max: 2,
        label: 'Intermediate severity',
        note: 'approx. 9.2% 30-day mortality in the derivation/validation cohorts',
      },
      {
        min: 3,
        max: 5,
        label: 'High severity',
        note:
          'approx. 22% or higher 30-day mortality in the derivation/validation cohorts, ' +
          'rising further at the top of the range',
      },
    ],
    reference: CURB65_REF,
  },
  {
    id: 'cha2ds2vasc',
    label: 'CHA₂DS₂-VASc (stroke risk in atrial fibrillation)',
    criteria: [
      { id: 'chf', label: 'Congestive heart failure / LV dysfunction', points: 1 },
      { id: 'htn', label: 'Hypertension', points: 1 },
      // The two age bands are mutually exclusive -- a patient is in exactly
      // one, never both -- so they share a `group`. See ScoreCriterion's own
      // doc comment: computeScore counts only the higher-point one of a
      // group even if a caller manages to tick both.
      { id: 'age75', label: 'Age ≥ 75 years', points: 2, group: 'age' },
      { id: 'diabetes', label: 'Diabetes mellitus', points: 1 },
      { id: 'stroke', label: 'Prior stroke, TIA or thromboembolism', points: 2 },
      {
        id: 'vascular',
        label: 'Vascular disease (prior MI, peripheral artery disease, aortic plaque)',
        points: 1,
      },
      { id: 'age65', label: 'Age 65–74 years', points: 1, group: 'age' },
      { id: 'sex', label: 'Sex category: female', points: 1 },
    ],
    bands: [
      {
        min: 0,
        max: 0,
        label: 'Lowest estimated annual stroke risk',
        note: 'the lowest-risk category in the derivation and validation cohorts',
      },
      { min: 1, max: 1, label: 'Low estimated annual stroke risk' },
      { min: 2, max: 3, label: 'Moderate estimated annual stroke risk' },
      {
        min: 4,
        max: 9,
        label: 'High estimated annual stroke risk',
        note: 'risk rises with each additional point in the derivation and validation cohorts',
      },
    ],
    reference: CHA2DS2VASC_REF,
  },
  {
    id: 'hasbled',
    label: 'HAS-BLED (bleeding risk on anticoagulation)',
    criteria: [
      { id: 'htn', label: 'Uncontrolled hypertension (systolic > 160 mmHg)', points: 1 },
      { id: 'renal', label: 'Abnormal renal function (dialysis, transplant, Cr > 200 µmol/L)', points: 1 },
      { id: 'liver', label: 'Abnormal liver function (cirrhosis, bilirubin/enzymes > 2x normal)', points: 1 },
      { id: 'stroke', label: 'Prior stroke', points: 1 },
      { id: 'bleeding', label: 'Bleeding history or predisposition (anaemia, etc.)', points: 1 },
      { id: 'labile_inr', label: 'Labile INR (on warfarin, time in therapeutic range < 60%)', points: 1 },
      { id: 'elderly', label: 'Age > 65 years', points: 1 },
      { id: 'drugs', label: 'Antiplatelet or NSAID use', points: 1 },
      { id: 'alcohol', label: 'Alcohol use (≥ 8 units/week)', points: 1 },
    ],
    bands: [
      { min: 0, max: 1, label: 'Low estimated bleeding risk' },
      { min: 2, max: 2, label: 'Moderate estimated bleeding risk' },
      {
        min: 3,
        max: 9,
        label: 'High estimated bleeding risk',
        note:
          'the derivation cohort used a score of 3 or more as the threshold for closer ' +
          'monitoring and review of modifiable risk factors',
      },
    ],
    reference: HASBLED_REF,
  },
];

export default medicineScores;
