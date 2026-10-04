/**
 * Antihistamines, gut drugs and the rest of the oral everyday list.
 *
 * All `drafted` — see `draft.ts`.
 *
 * SEVERAL ROWS HERE SAY "DO NOT". That is deliberate and the schema supports
 * it: `fixedDose` is documented as holding "a plainly-worded refusal to suggest
 * one". Sedating antihistamines and cough mixtures are among the most-written
 * paediatric prescriptions in this region and among the least defensible, and a
 * formulary that silently carried no dose for them would read as an omission.
 * A stated reason is more use to a prescriber than a blank.
 */
import type { DosingEntry } from '@domain/pack.ts';
import { bnfc, draft } from './draft.ts';

export const allergyGiDosing: DosingEntry[] = [
  // --- antihistamines ------------------------------------------------------
  draft({
    generic: 'Cetirizine',
    indication: 'Allergic rhinitis, urticaria',
    route: 'oral',
    fixedDose: '2.5 mg once daily from 6 months, 5 mg from 2 years, 10 mg from 6 years',
    perDoses: 1,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: bnfc('cetirizine'),
    note: 'Non-sedating at these doses in most children; a few are still drowsy on it.',
  }),
  draft({
    generic: 'Loratadine',
    indication: 'Allergic rhinitis, urticaria',
    route: 'oral',
    fixedDose: '5 mg once daily under 30 kg, 10 mg once daily at 30 kg and over',
    perDoses: 1,
    ageBand: { fromDays: 730, label: '2 years and over' },
    reference: bnfc('loratadine'),
  }),
  draft({
    generic: 'Fexofenadine',
    indication: 'Allergic rhinitis, urticaria',
    route: 'oral',
    fixedDose: '30 mg twice daily from 6 months to 11 years, 120–180 mg once daily from 12 years',
    perDoses: 2,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: bnfc('fexofenadine'),
    note: 'Fruit juice roughly halves absorption — water, not juice.',
  }),
  draft({
    generic: 'Chlorpheniramine',
    indication: 'Allergic reaction (sedating antihistamine)',
    route: 'oral',
    fixedDose: '1 mg twice daily from 1 to 2 years, 1 mg 4–6 hourly from 2 to 6 years, 2 mg 4–6 hourly from 6 to 12 years',
    ageBand: { fromDays: 365, label: '1 year and over' },
    reference: bnfc('chlorphenamine'),
    note:
      'Sedating, and not for a child under 1 year. Where an antihistamine is ' +
      'wanted for itch or rhinitis a non-sedating one is the better choice; ' +
      'this one earns its place in acute allergic reactions.',
  }),
  draft({
    generic: 'Pheniramine maleate',
    indication: 'Allergic reaction (sedating antihistamine)',
    route: 'oral',
    fixedDose: 'No dose offered — see the note',
    reference: bnfc('antihistamines, sedating'),
    note:
      'Deliberately no mg/kg figure. Pheniramine is not in BNFC, paediatric ' +
      'data for it are thin, and anything it is prescribed for here is better ' +
      'served by cetirizine or by chlorpheniramine, both of which have one. ' +
      'If you want it in this pack, author the row yourself against a source ' +
      'you have read.',
  }),
  draft({
    generic: 'Diphenhydramine + Ammonium chloride',
    indication: 'Cough mixture',
    route: 'oral',
    fixedDose: 'No dose offered — see the note',
    reference: bnfc('cough preparations'),
    note:
      'No dose, on purpose. Over-the-counter cough and cold preparations ' +
      'containing a sedating antihistamine are not recommended under 6 years, ' +
      'and the evidence that they help at any age is absent. Honey and fluids ' +
      'outperform them in trials; a child whose cough needs treating needs a ' +
      'diagnosis rather than a syrup.',
  }),
  draft({
    generic: 'Oxomemazine + Guaifenesin',
    indication: 'Cough mixture',
    route: 'oral',
    fixedDose: 'No dose offered — see the note',
    reference: bnfc('cough preparations'),
    note:
      'Same reasoning as the other sedating cough mixtures: no established ' +
      'benefit, a sedating antihistamine in a child with a cough, and no ' +
      'paediatric dose this pack is willing to state.',
  }),
  draft({
    generic: 'Loratadine + Pseudoephedrine',
    indication: 'Nasal congestion with allergy',
    route: 'oral',
    fixedDose: 'No dose offered — see the note',
    ageBand: { fromDays: 4380, label: '12 years and over' },
    reference: bnfc('pseudoephedrine'),
    note:
      'Pseudoephedrine combinations are not for young children. If a ' +
      'decongestant is genuinely wanted in an older child, prescribe the ' +
      'single agent at its own dose rather than a fixed combination.',
  }),

  // --- gut -----------------------------------------------------------------
  draft({
    generic: 'Domperidone',
    indication: 'Vomiting, gastro-oesophageal reflux',
    route: 'oral',
    mgPerKg: 0.25,
    perDoses: 3,
    maxMgPerDose: 10,
    reference: bnfc('domperidone'),
    note:
      'Shortest effective course, maximum one week. It prolongs the QT ' +
      'interval, which is why the licensed dose came down — do not combine it ' +
      'with other QT-prolonging drugs, and do not use it in a child with a ' +
      'cardiac history without thinking hard.',
  }),
  draft({
    generic: 'Dimenhydrinate',
    indication: 'Motion sickness, vertigo',
    route: 'oral',
    mgPerKg: 1.25,
    perDoses: 3,
    maxMgPerDose: 50,
    ageBand: { fromDays: 730, label: '2 years and over' },
    reference: bnfc('antihistamines, sedating'),
    note: 'Sedating. Not for vomiting of unknown cause, where it masks the picture rather than treating it.',
  }),
  draft({
    generic: 'Omeprazole',
    indication: 'Reflux oesophagitis, peptic ulcer',
    route: 'oral',
    mgPerKg: 0.7,
    mgPerKgHigh: 1.4,
    perDoses: 1,
    maxMgPerDay: 40,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('omeprazole'),
    note: 'Before the first feed of the day. Review at 4–8 weeks — a proton pump inhibitor started in infancy is too often still running at two years.',
  }),
  draft({
    generic: 'Esomeprazole',
    indication: 'Reflux oesophagitis',
    route: 'oral',
    fixedDose: '10 mg once daily from 1 to 11 years (under 20 kg), 20 mg once daily at 20 kg and over',
    perDoses: 1,
    ageBand: { fromDays: 365, label: '1 year and over' },
    reference: bnfc('esomeprazole'),
  }),
  draft({
    generic: 'Ranitidine',
    indication: 'Reflux, peptic ulcer',
    route: 'oral',
    fixedDose: 'No dose offered — see the note',
    reference: bnfc('ranitidine'),
    note:
      'Ranitidine was withdrawn from most markets in 2020 over NDMA ' +
      'contamination and is not recommended. The row exists because the ' +
      'syrup is still on shelves in some places; prescribe a proton pump ' +
      'inhibitor or famotidine instead.',
  }),
  draft({
    generic: 'Hyoscine butylbromide',
    indication: 'Colicky abdominal pain',
    route: 'oral',
    fixedDose: '10 mg three times daily from 6 years',
    perDoses: 3,
    ageBand: { fromDays: 2190, label: '6 years and over' },
    reference: bnfc('hyoscine butylbromide'),
    note: 'Abdominal pain in a child needs a cause before it needs an antispasmodic.',
  }),
  draft({
    generic: 'Lactulose',
    indication: 'Constipation',
    route: 'oral',
    fixedDose: '2.5 ml twice daily under 1 year, 5 ml twice daily from 1 to 5 years, 10 ml twice daily from 5 years',
    perDoses: 2,
    reference: bnfc('lactulose'),
    note:
      'Titrate to a soft stool rather than to the bottle. It takes 48 hours to ' +
      'work, which families need telling or they stop it on day one. Disimpaction ' +
      'is a different, higher regimen.',
  }),
  draft({
    generic: 'Docusate sodium',
    indication: 'Constipation, stool softener',
    route: 'oral',
    fixedDose: '12.5 mg three times daily from 6 months to 2 years, 12.5–25 mg three times daily from 2 to 12 years',
    perDoses: 3,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: bnfc('docusate sodium'),
  }),
  draft({
    generic: 'Diosmectite',
    indication: 'Acute diarrhoea, adjunct',
    route: 'oral',
    fixedDose: '1 sachet (3 g) up to twice daily under 1 year, up to three times daily over 1 year, for up to 3 days',
    reference: bnfc('diarrhoea, adsorbents'),
    note:
      'An adjunct, never a substitute: oral rehydration salts and zinc are ' +
      'the treatment for acute diarrhoea and this is not. Give it at least two ' +
      'hours apart from other medicines, which it adsorbs.',
  }),
  draft({
    generic: 'Bacillus clausii spores',
    indication: 'Acute diarrhoea, adjunct',
    route: 'oral',
    fixedDose: '1 vial (2 billion spores) two or three times daily for up to 5 days',
    reference: bnfc('probiotics'),
    note:
      'Evidence for probiotics in acute childhood gastroenteritis is weak and ' +
      'two large trials found no benefit. Rehydration and zinc are what change ' +
      'the outcome. Not for an immunocompromised child or one with a central line.',
  }),
  draft({
    generic: 'Probiotic (multi-strain)',
    indication: 'Acute diarrhoea, adjunct',
    route: 'oral',
    fixedDose: '1 sachet once or twice daily for up to 5 days',
    reference: bnfc('probiotics'),
    note: 'Same caveat as the single-strain preparations — an adjunct at best, and not for the immunocompromised.',
  }),
  draft({
    generic: 'Simethicone + Dill oil',
    indication: 'Infantile colic',
    route: 'oral',
    fixedDose: '0.5–1 ml with feeds, up to six times daily',
    reference: bnfc('simeticone'),
    note:
      'Harmless and not shown to work. Worth saying out loud to a family ' +
      'rather than letting them pay for it in hope: colic settles by 4 months ' +
      'whatever is given, and what helps most is the reassurance and the ' +
      'red-flag list.',
  }),
];
