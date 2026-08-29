/**
 * English locale pack.
 *
 * This file is DATA. Adding a language means adding a sibling of this file, not
 * touching a .ts under domain/ or a .tsx under render/ (CLAUDE.md 4).
 *
 * The English sentences are the safety net: PRODUCT.md rule 3.5 forbids
 * printing a patient instruction in Urdu alone, precisely so a doctor or
 * pharmacist can catch a bad translation. So these are not "the source" that
 * Urdu is derived from -- both are authored -- but they are the version that
 * gets checked.
 */
import type { LocalePack } from '@domain/phrases.ts';

export const en: LocalePack = {
  locale: 'en',
  dir: 'ltr',
  numerals: 'latn',

  templates: {
    'sig.oral.liquid': '{administer} {dose} {frequency}[ {timing}][ for {duration}]',
    'sig.oral.solid': '{administer} {dose} {frequency}[ {timing}][ for {duration}]',
    'sig.oral.sachet':
      'Dissolve {dose} in water and {administer} {frequency}[ {timing}][ for {duration}]',
    'sig.topical':
      '{administer} a thin layer to the affected area {frequency}[ for {duration}]',
    'sig.drops.eye': '{administer} {dose} into each eye {frequency}[ for {duration}]',
    'sig.drops.ear':
      '{administer} {dose} into the affected ear {frequency}[ for {duration}]',
    'sig.drops.nasal':
      '{administer} {dose} into each nostril {frequency}[ for {duration}]',
    'sig.inhaled': '{administer} {dose} by inhaler {frequency}[ for {duration}]',
    'sig.prn':
      '{administer} {dose} when needed[, {frequency}][ - no more than {max} in 24 hours]',
    'sig.stat': '{administer} {dose} now, as a single dose',
  },

  vocab: {
    /** the verb. Paediatric packs address a caregiver, adult packs the patient. */
    administer: {
      give: 'Give',
      take: 'Take',
      apply: 'Apply',
      instil: 'Put',
      inhale: 'Inhale',
    },
    frequency: {
      OD: 'once a day',
      BID: 'twice a day',
      TID: 'three times a day',
      QID: 'four times a day',
      Q4H: 'every 4 hours',
      Q6H: 'every 6 hours',
      Q8H: 'every 8 hours',
      Q12H: 'every 12 hours',
      HS: 'at night before sleep',
      PRN: 'when needed',
      ALT: 'every other day',
      WEEKLY: 'once a week',
    },
    timing: {
      after_food: 'after food',
      before_food: 'before food',
      with_food: 'with food',
      empty_stomach: 'on an empty stomach',
      with_milk: 'with milk',
      morning: 'in the morning',
      evening: 'in the evening',
      at_bedtime: 'at bedtime',
    },
    route: {
      oral: 'by mouth',
      topical: 'on the skin',
      eye: 'into the eye',
      ear: 'into the ear',
      nasal: 'into the nose',
      inhaled: 'by inhaler',
      rectal: 'rectally',
    },
    form: {
      syrup: 'syrup',
      suspension: 'suspension',
      tablet: 'tablet',
      capsule: 'capsule',
      drops: 'drops',
      cream: 'cream',
      ointment: 'ointment',
      injection: 'injection',
      sachet: 'sachet',
      inhaler: 'inhaler',
      suppository: 'suppository',
      solution: 'solution',
    },
  },

  units: {
    ml: { one: 'ml', other: 'ml' },
    tsp: { one: 'teaspoon', other: 'teaspoons' },
    mg: { one: 'mg', other: 'mg' },
    g: { one: 'g', other: 'g' },
    tablet: { one: 'tablet', other: 'tablets' },
    capsule: { one: 'capsule', other: 'capsules' },
    drop: { one: 'drop', other: 'drops' },
    puff: { one: 'puff', other: 'puffs' },
    sachet: { one: 'sachet', other: 'sachets' },
    dose: { one: 'dose', other: 'doses' },
    application: { one: 'application', other: 'applications' },
    day: { one: 'day', other: 'days' },
    week: { one: 'week', other: 'weeks' },
    month: { one: 'month', other: 'months' },
  },

  advice: {
    tier1: {
      'advice.complete_course':
        'Complete the full course of medicine even if the child seems better',
      'advice.return_if_fever_persists':
        'Come back if the fever continues beyond {n} days',
      'advice.follow_up_in': 'Come for a check-up in {n} days',
      'advice.increase_fluids': 'Give extra fluids - water, milk or ORS',
      'advice.ors_after_each_stool': 'Give ORS after every loose stool',
      'advice.continue_feeding': 'Continue normal feeding and breastfeeding',
      'advice.rest_at_home': 'Keep the child at home to rest for {n} days',
      'advice.sponge_for_fever':
        'If the fever is high, sponge the body with lukewarm water',
      'advice.no_other_medicine':
        'Do not give any other medicine without asking the doctor',
      'advice.avoid_smoke': 'Keep the child away from smoke and dust',
      'advice.hand_washing': 'Wash hands before feeding the child',
      'advice.next_vaccine': 'The next vaccination is due in {n} days',
      'advice.bring_for_weighing':
        'Bring the child for weighing at the next visit',
      'advice.zinc_days': 'Give zinc once a day for {n} days',
    },
    tier2: {
      'redflag.not_feeding':
        'Come back IMMEDIATELY if the child stops feeding or drinking',
      'redflag.drowsy':
        'Come back IMMEDIATELY if the child becomes drowsy or is hard to wake',
      'redflag.breathing':
        'Come back IMMEDIATELY if breathing becomes fast or difficult',
      'redflag.convulsion': 'Come back IMMEDIATELY if the child has a fit',
      'redflag.vomits_everything':
        'Come back IMMEDIATELY if the child vomits everything',
      'redflag.blood_in_stool':
        'Come back IMMEDIATELY if there is blood in the stool',
      'redflag.dehydration':
        'Come back IMMEDIATELY if the eyes look sunken or the child passes very little urine',
      'redflag.fever_not_settling':
        'Come back IMMEDIATELY if the fever does not settle with medicine',
      'redflag.non_blanching_rash':
        'Come back IMMEDIATELY if a rash appears that does not fade when pressed',
      'redflag.cold_hands':
        'Come back IMMEDIATELY if the hands and feet turn cold and pale',
    },
  },

  strings: {
    'patient.line': '{name}: {instruction}',
    'section.problems': 'Presenting complaints',
    'section.examination': 'Examination',
    'section.diagnosis': 'Diagnosis',
    'section.labs': 'Investigations advised',
    'section.calculations': 'Calculations',
    'section.medications': 'Medications',
    'section.advice': 'Advice',
    'section.patientInstructions': 'For the patient',
    'label.patient': 'Patient',
    'label.age': 'Age',
    'label.sex': 'Sex',
    'label.weight': 'Weight',
    'label.height': 'Height',
    'label.date': 'Date',
    'label.allergies': 'ALLERGIES',
    'label.noAllergies': 'No known allergies',
    'label.signature': 'Signature',
    'label.followUp': 'Follow-up',
    'label.redFlag': 'Come back immediately if',
    'label.page': 'Page {n} of {total}',
    'label.registration': 'Reg. No.',
    'notice.notVetted': "Doctor's own words - printed as typed",
    'notice.notPrescription':
      'This is a prescribing aid. It is valid only with the signature below.',
  },
};

export default en;
