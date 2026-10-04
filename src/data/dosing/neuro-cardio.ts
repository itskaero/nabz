/**
 * Anticonvulsants, sedation, diuretics and vitamin K.
 *
 * All `drafted` — see `draft.ts`.
 *
 * THE ANTICONVULSANTS NEED MORE CARE THAN MOST ROWS HERE. Maintenance doses
 * are started low and titrated over weeks against seizure control and blood
 * levels, so a single mg/kg figure is a STARTING point and the note says so
 * every time. Status epilepticus is a different question with different
 * numbers, written as its own row rather than folded into the maintenance one.
 */
import type { DosingEntry } from '@domain/pack.ts';
import { bnfc, draft } from './draft.ts';

export const neuroCardioDosing: DosingEntry[] = [
  draft({
    generic: 'Diazepam',
    indication: 'Status epilepticus (rectal)',
    route: 'rectal',
    mgPerKg: 0.5,
    perDoses: 1,
    maxMgPerDose: 10,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('diazepam'),
    note:
      'One dose, repeated once after 10 minutes if the seizure continues, and ' +
      'then stop — a third dose adds respiratory depression, not seizure ' +
      'control. Have a bag and mask within reach before giving it.',
  }),
  draft({
    generic: 'Diazepam',
    indication: 'Status epilepticus (intravenous)',
    route: 'IV',
    mgPerKg: 0.1,
    mgPerKgHigh: 0.3,
    perDoses: 1,
    maxMgPerDose: 10,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('diazepam'),
    note: 'Slowly, over 3–5 minutes. A separate row from the rectal dose because the two figures are five times apart.',
  }),
  draft({
    generic: 'Clonazepam',
    indication: 'Myoclonic and absence seizures (maintenance)',
    route: 'oral',
    fixedDose: '0.25 mg at night from 1 to 5 years, increased slowly to 0.5–1 mg; 0.5 mg at night from 5 to 12 years, increased to 1–3 mg',
    reference: bnfc('clonazepam'),
    note:
      'A starting dose, titrated upward over 2–4 weeks. Tolerance to the ' +
      'anticonvulsant effect is common within months, and it must never be ' +
      'stopped abruptly.',
  }),
  draft({
    generic: 'Phenobarbital',
    indication: 'Seizure maintenance',
    route: 'oral',
    mgPerKg: 2.5,
    mgPerKgHigh: 4,
    perDoses: 1,
    maxMgPerDay: 180,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('phenobarbital'),
    note:
      'A maintenance dose, usually once at night. The LOADING dose in status ' +
      'is 20 mg/kg and is a different number entirely — do not reach for this ' +
      'row in an emergency. Sedation and behavioural change are the common ' +
      'reasons families stop it.',
  }),
  draft({
    generic: 'Sodium valproate',
    indication: 'Generalised seizures (maintenance)',
    route: 'oral',
    mgPerKg: 10,
    mgPerKgHigh: 15,
    perDoses: 2,
    maxMgPerDay: 2500,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('sodium valproate'),
    note:
      'Start at 10 mg/kg/day in two doses and titrate to 20–40 mg/kg/day over ' +
      'two to four weeks. NOT for a girl who could become pregnant now or ' +
      'later without a documented conversation and a pregnancy prevention ' +
      'plan — the teratogenic and neurodevelopmental risk is high. Hepatic ' +
      'failure risk is greatest under 2 years and on polytherapy.',
  }),
  draft({
    generic: 'Carbamazepine',
    indication: 'Focal seizures (maintenance)',
    route: 'oral',
    mgPerKg: 2.5,
    mgPerKgHigh: 5,
    perDoses: 2,
    maxMgPerDay: 1800,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('carbamazepine'),
    note:
      'A starting dose: 5–10 mg/kg/day in two doses, increased every 1–2 weeks ' +
      'to 10–20 mg/kg/day. It induces its own metabolism, so the dose that ' +
      'worked in week one often does not in week four. Test for HLA-B*1502 ' +
      'before starting in a child of Han Chinese, Thai or other South-East ' +
      'Asian ancestry.',
  }),
  draft({
    generic: 'Levetiracetam',
    indication: 'Focal and generalised seizures (maintenance)',
    route: 'oral',
    mgPerKg: 10,
    perDoses: 2,
    maxMgPerDay: 3000,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('levetiracetam'),
    note:
      'Start at 20 mg/kg/day in two doses and titrate to 40–60 mg/kg/day. ' +
      'Irritability and aggression are the common reason it is abandoned; ' +
      'they often settle, and pyridoxine sometimes helps.',
  }),
  draft({
    generic: 'Furosemide',
    indication: 'Fluid overload, heart failure',
    route: 'oral',
    mgPerKg: 0.5,
    mgPerKgHigh: 2,
    perDoses: 2,
    maxMgPerDose: 40,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('furosemide'),
    note: 'Watch potassium, sodium and the renal function. Prolonged use in infancy causes nephrocalcinosis.',
  }),
  draft({
    generic: 'Spironolactone',
    indication: 'Oedema, with a loop diuretic',
    route: 'oral',
    mgPerKg: 1,
    mgPerKgHigh: 3,
    perDoses: 2,
    maxMgPerDay: 100,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('spironolactone'),
    note: 'Potassium-sparing — check the potassium, and do not combine it with a potassium supplement without a reason.',
  }),
  draft({
    generic: 'Phytomenadione',
    indication: 'Vitamin K deficiency bleeding, prophylaxis at birth',
    route: 'IM',
    fixedDose: '1 mg intramuscularly at birth (0.5 mg under 2.5 kg), as a single dose',
    reference: bnfc('phytomenadione'),
    note:
      'The single most cost-effective injection in paediatrics. The oral ' +
      'regimen is three doses, not one, and is less reliable in a breastfed ' +
      'baby — if a family refuses the injection, the whole oral course must be ' +
      'explained and recorded.',
  }),
];
