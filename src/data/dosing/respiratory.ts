/**
 * Airways, inhaled and systemic: bronchodilators, inhaled and oral steroids,
 * leukotriene antagonists, and the adrenaline that goes with them.
 *
 * All `drafted` — see `draft.ts`.
 *
 * ONE THING WORTH SAYING ABOUT INHALERS. A puff is not a milligram per
 * kilogram, and the schema is right to refuse to pretend otherwise: inhaled
 * doses are stated as puffs or as a nebule, and the number that matters
 * clinically is as much the spacer and the technique as the dose. Those rows
 * use `fixedDose` and say so, which is also why they carry no concentration
 * and offer no millilitre figure.
 */
import type { DosingEntry } from '@domain/pack.ts';
import { bnfc, draft } from './draft.ts';

export const respiratoryDosing: DosingEntry[] = [
  draft({
    generic: 'Salbutamol',
    indication: 'Acute wheeze (inhaler with spacer)',
    route: 'inhaled',
    fixedDose: '2–10 puffs of 100 micrograms through a spacer, repeated as needed',
    reference: bnfc('salbutamol'),
    note:
      'A spacer with a metered-dose inhaler works at least as well as a ' +
      'nebuliser in a child who is not in extremis, and is faster to set up. ' +
      'One puff at a time, five tidal breaths each, rather than ten puffs fired ' +
      'into the chamber at once.',
  }),
  draft({
    generic: 'Salbutamol',
    indication: 'Acute wheeze (nebulised)',
    route: 'nebulised',
    fixedDose: '2.5 mg under 5 years, 5 mg from 5 years, repeated as needed',
    reference: bnfc('salbutamol'),
    note: 'Drive it with oxygen in a child who is hypoxic — air-driven nebulisation can drop the saturation further.',
  }),
  draft({
    generic: 'Salbutamol',
    indication: 'Wheeze (oral syrup)',
    route: 'oral',
    mgPerKg: 0.1,
    mgPerKgHigh: 0.15,
    perDoses: 3,
    maxMgPerDose: 4,
    ageBand: { fromDays: 60, label: 'over 2 months' },
    reference: bnfc('salbutamol'),
    note:
      'Oral salbutamol is slower, weaker and shakier than the same drug ' +
      'inhaled. It is here because it is widely prescribed, not because it is ' +
      'the better choice when an inhaler and a spacer are available.',
  }),
  draft({
    generic: 'Ipratropium bromide',
    indication: 'Acute severe wheeze, with salbutamol',
    route: 'nebulised',
    fixedDose: '250 micrograms under 12 years, 500 micrograms from 12 years, up to 4-hourly',
    reference: bnfc('ipratropium bromide'),
    note: 'Adds to salbutamol in a severe attack; it adds nothing in a mild one.',
  }),
  draft({
    generic: 'Budesonide',
    indication: 'Croup, moderate to severe',
    route: 'nebulised',
    fixedDose: '2 mg as a single nebulised dose',
    reference: bnfc('budesonide'),
    note:
      'An alternative to oral dexamethasone when a child will not swallow or ' +
      'keeps vomiting. Dexamethasone is otherwise the better and cheaper choice.',
  }),
  draft({
    generic: 'Budesonide',
    indication: 'Asthma, preventer',
    route: 'inhaled',
    fixedDose: '100–200 micrograms twice daily, titrated to control',
    reference: bnfc('budesonide'),
    note: 'Start low, review at 8–12 weeks, and step down once control holds. Rinse the mouth after each dose.',
  }),
  draft({
    generic: 'Beclometasone',
    indication: 'Asthma, preventer',
    route: 'inhaled',
    fixedDose: '50–100 micrograms twice daily through a spacer, titrated to control',
    reference: bnfc('beclometasone dipropionate'),
    note:
      'Beclometasone products are NOT interchangeable microgram for ' +
      'microgram — the extra-fine formulations are roughly twice as potent. ' +
      'Prescribe by brand for this one.',
  }),
  draft({
    generic: 'Fluticasone propionate',
    indication: 'Asthma, preventer',
    route: 'inhaled',
    fixedDose: '50–100 micrograms twice daily through a spacer, titrated to control',
    reference: bnfc('fluticasone'),
    note: 'Roughly twice as potent as beclometasone at the same microgram figure.',
  }),
  draft({
    generic: 'Fluticasone + Salmeterol',
    indication: 'Asthma not controlled on an inhaled steroid alone',
    route: 'inhaled',
    fixedDose: '1 inhalation twice daily of the strength prescribed',
    ageBand: { fromDays: 1460, label: '4 years and over' },
    reference: bnfc('fluticasone with salmeterol'),
    note:
      'A long-acting beta agonist is never given to a child without an inhaled ' +
      'steroid in the same device. Step up to this rather than increasing the ' +
      'steroid indefinitely.',
  }),
  draft({
    generic: 'Montelukast',
    indication: 'Asthma, add-on preventer; allergic rhinitis',
    route: 'oral',
    fixedDose: '4 mg once daily from 6 months to 5 years, 5 mg from 6 to 14 years',
    perDoses: 1,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: bnfc('montelukast'),
    note:
      'Dosed by age band rather than by weight. Warn the family about mood ' +
      'change, sleep disturbance and nightmares — they are not rare, they are ' +
      'reversible, and parents who have not been told do not connect them.',
  }),
  draft({
    generic: 'Prednisolone',
    indication: 'Acute asthma or wheeze',
    route: 'oral',
    mgPerKg: 1,
    mgPerKgHigh: 2,
    perDoses: 1,
    maxMgPerDay: 40,
    ageBand: { fromDays: 60, label: 'over 2 months' },
    reference: bnfc('prednisolone'),
    note:
      'Once daily in the morning for 3 days, usually; no tapering is needed ' +
      'for a course this short. Give it with food.',
  }),
  draft({
    generic: 'Dexamethasone',
    indication: 'Croup',
    route: 'oral',
    mgPerKg: 0.15,
    mgPerKgHigh: 0.6,
    perDoses: 1,
    maxMgPerDose: 12,
    reference: bnfc('dexamethasone'),
    note:
      'A single dose. 0.15 mg/kg works as well as 0.6 mg/kg in mild and ' +
      'moderate croup, which is worth knowing when the only preparation to ' +
      'hand is an injection being given by mouth.',
  }),
  draft({
    generic: 'Hydrocortisone sodium succinate',
    indication: 'Acute severe asthma, anaphylaxis, adrenal crisis',
    route: 'IV',
    mgPerKg: 4,
    perDoses: 4,
    maxMgPerDose: 100,
    reference: bnfc('hydrocortisone'),
    note: '6-hourly while intravenous steroid is needed; switch to oral prednisolone as soon as the child can take it.',
  }),
  draft({
    generic: 'Methylprednisolone',
    indication: 'Severe inflammatory flare',
    route: 'IV',
    mgPerKg: 1,
    mgPerKgHigh: 2,
    perDoses: 2,
    maxMgPerDay: 60,
    reference: bnfc('methylprednisolone'),
    note: 'Pulse regimens for nephrotic syndrome and vasculitis are far higher and are a different row — do not scale this one up to reach them.',
  }),
  draft({
    generic: 'Epinephrine',
    indication: 'Anaphylaxis',
    route: 'IM',
    fixedDose:
      '0.01 mg/kg of 1 mg/ml (1:1000) into the outer thigh — 0.15 mg under 6 years, ' +
      '0.3 mg from 6 to 12 years, 0.5 mg from 12 years — repeat after 5 minutes if needed',
    reference: bnfc('adrenaline/epinephrine'),
    note:
      'Intramuscular into the anterolateral thigh, not subcutaneous and not ' +
      'intravenous. Written as a fixed dose because the age-banded figures are ' +
      'what is drawn up under pressure, and because an intravenous mg/kg ' +
      'number sitting on the same row is how the wrong one gets given.',
  }),
  draft({
    generic: 'Epinephrine',
    indication: 'Severe croup (nebulised)',
    route: 'nebulised',
    fixedDose: '0.5 ml/kg of 1 mg/ml (1:1000), up to 5 ml, nebulised',
    reference: bnfc('adrenaline/epinephrine'),
    note:
      'Buys 2 hours, not a cure — the child must be watched for rebound for ' +
      'at least that long, and must have had a steroid as well.',
  }),
];
