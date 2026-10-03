/**
 * The paediatrics content pack -- v1 ships exactly this one (PRODUCT.md 4a).
 *
 * Everything specialty-specific the app shows comes from here. If you find
 * yourself adding an exam system, a findings chip or an advice id to a
 * component, stop: it belongs in a pack file. That is the whole seam, and it is
 * cheap now and brutal to retrofit.
 *
 * DO NOT author packs for other specialties. The schema is open; the content is
 * not ours to write. An ENT or derm pack is authored by a clinician OF that
 * specialty, against this schema, cited the same way doses are.
 */
import type { ContentPack } from '@domain/pack.ts';
import { formularySeed } from '@data/formulary/seed.ts';
import { dosingSeed } from '@data/dosing/seed.ts';

export const paediatrics: ContentPack = {
  id: 'paediatrics',
  specialty: 'Paediatrics',
  author: {
    name: 'Pack author',
    credential: 'Paediatrics',
    updated: '2026-08-21',
  },
  verified: true,

  /**
   * Order is tap order at OPD speed: the systems examined in almost every
   * child come first, so the common case needs no scrolling.
   */
  examSystems: [
    { id: 'general', label: 'General', order: 1 },
    { id: 'respiratory', label: 'Respiratory', order: 2 },
    { id: 'cvs', label: 'Cardiovascular', order: 3 },
    { id: 'abdomen', label: 'Abdomen', order: 4 },
    { id: 'ent', label: 'ENT / Throat', order: 5 },
    { id: 'cns', label: 'CNS', order: 6 },
    { id: 'skin', label: 'Skin', order: 7 },
    { id: 'msk', label: 'Musculoskeletal', order: 8 },
  ],

  findingsPalette: {
    general: [
      { id: 'well', label: 'well-looking' },
      { id: 'ill', label: 'ill-looking' },
      { id: 'alert', label: 'alert' },
      { id: 'lethargic', label: 'lethargic' },
      { id: 'irritable', label: 'irritable' },
      { id: 'pallor', label: 'pallor' },
      { id: 'jaundice', label: 'jaundice' },
      { id: 'cyanosis', label: 'cyanosis' },
      { id: 'dehydration', label: 'dehydration', takesValue: true, valueHint: 'some / severe' },
      { id: 'oedema', label: 'oedema', takesValue: true, valueHint: 'site' },
      { id: 'lymphadenopathy', label: 'lymphadenopathy', takesValue: true, valueHint: 'site, size' },
      { id: 'febrile', label: 'febrile', takesValue: true, valueHint: 'temp' },
      { id: 'capillary_refill', label: 'delayed capillary refill', takesValue: true, valueHint: 'sec' },
      { id: 'nutrition', label: 'poor nutritional status' },
    ],
    respiratory: [
      { id: 'tachypnoea', label: 'tachypnoea', takesValue: true, valueHint: 'rate' },
      { id: 'indrawing', label: 'chest indrawing' },
      { id: 'nasal_flaring', label: 'nasal flaring' },
      { id: 'grunting', label: 'grunting' },
      { id: 'wheeze', label: 'wheeze' },
      { id: 'crepitations', label: 'crepitations', takesValue: true, valueHint: 'zone' },
      { id: 'bronchial_breathing', label: 'bronchial breathing' },
      { id: 'reduced_air_entry', label: 'reduced air entry', takesValue: true, valueHint: 'side' },
      { id: 'stridor', label: 'stridor' },
      { id: 'clear_chest', label: 'chest clear' },
      { id: 'spo2', label: 'oxygen saturation', takesValue: true, valueHint: '%' },
    ],
    cvs: [
      { id: 'normal_s1s2', label: 'S1 S2 normal' },
      { id: 'murmur', label: 'murmur', takesValue: true, valueHint: 'grade, site' },
      { id: 'gallop', label: 'gallop rhythm' },
      { id: 'tachycardia', label: 'tachycardia', takesValue: true, valueHint: 'rate' },
      { id: 'bradycardia', label: 'bradycardia', takesValue: true, valueHint: 'rate' },
      { id: 'weak_pulses', label: 'weak peripheral pulses' },
      { id: 'raised_jvp', label: 'raised JVP' },
    ],
    abdomen: [
      { id: 'soft_nontender', label: 'soft, non-tender' },
      { id: 'tenderness', label: 'tenderness', takesValue: true, valueHint: 'site' },
      { id: 'guarding', label: 'guarding' },
      { id: 'distension', label: 'distension' },
      { id: 'hepatomegaly', label: 'hepatomegaly', takesValue: true, valueHint: 'cm' },
      { id: 'splenomegaly', label: 'splenomegaly', takesValue: true, valueHint: 'cm' },
      { id: 'mass', label: 'palpable mass', takesValue: true, valueHint: 'site' },
      { id: 'bowel_sounds', label: 'bowel sounds present' },
      { id: 'umbilical_hernia', label: 'umbilical hernia' },
    ],
    ent: [
      { id: 'throat_congested', label: 'congested throat' },
      { id: 'tonsils_enlarged', label: 'enlarged tonsils', takesValue: true, valueHint: 'grade' },
      { id: 'exudate', label: 'tonsillar exudate' },
      { id: 'red_tm', label: 'red tympanic membrane', takesValue: true, valueHint: 'side' },
      { id: 'bulging_tm', label: 'bulging tympanic membrane', takesValue: true, valueHint: 'side' },
      { id: 'ear_discharge', label: 'ear discharge', takesValue: true, valueHint: 'side' },
      { id: 'nasal_discharge', label: 'nasal discharge' },
      { id: 'oral_thrush', label: 'oral thrush' },
      { id: 'normal_ent', label: 'ENT examination normal' },
    ],
    cns: [
      { id: 'conscious', label: 'fully conscious' },
      { id: 'neck_stiffness', label: 'neck stiffness' },
      { id: 'bulging_fontanelle', label: 'bulging fontanelle' },
      { id: 'sunken_fontanelle', label: 'sunken fontanelle' },
      { id: 'tone_abnormal', label: 'abnormal tone', takesValue: true, valueHint: 'hyper / hypo' },
      { id: 'reflexes', label: 'abnormal reflexes', takesValue: true, valueHint: 'detail' },
      { id: 'focal_deficit', label: 'focal neurological deficit', takesValue: true, valueHint: 'detail' },
      { id: 'kernig', label: "Kernig's sign" },
      { id: 'development', label: 'developmental delay', takesValue: true, valueHint: 'domain' },
    ],
    skin: [
      { id: 'rash', label: 'rash', takesValue: true, valueHint: 'type, site' },
      { id: 'blanching', label: 'blanching rash' },
      { id: 'non_blanching', label: 'non-blanching rash' },
      { id: 'vesicles', label: 'vesicles', takesValue: true, valueHint: 'site' },
      { id: 'pustules', label: 'pustules', takesValue: true, valueHint: 'site' },
      { id: 'dry_skin', label: 'dry skin' },
      { id: 'scabies', label: 'burrows / excoriations' },
      { id: 'skin_normal', label: 'skin normal' },
    ],
    msk: [
      { id: 'joint_swelling', label: 'joint swelling', takesValue: true, valueHint: 'joint' },
      { id: 'joint_tenderness', label: 'joint tenderness', takesValue: true, valueHint: 'joint' },
      { id: 'limp', label: 'limp' },
      { id: 'reduced_rom', label: 'reduced range of movement', takesValue: true, valueHint: 'joint' },
      { id: 'deformity', label: 'deformity', takesValue: true, valueHint: 'site' },
      { id: 'msk_normal', label: 'musculoskeletal examination normal' },
    ],
  },

  advicePacks: {
    tier1: [
      'advice.complete_course',
      'advice.increase_fluids',
      'advice.continue_feeding',
      'advice.ors_after_each_stool',
      'advice.sponge_for_fever',
      'advice.return_if_fever_persists',
      'advice.follow_up_in',
      'advice.rest_at_home',
      'advice.no_other_medicine',
      'advice.avoid_smoke',
      'advice.hand_washing',
      'advice.zinc_days',
      'advice.next_vaccine',
      'advice.bring_for_weighing',
    ],
    tier2: [
      'redflag.not_feeding',
      'redflag.drowsy',
      'redflag.breathing',
      'redflag.convulsion',
      'redflag.vomits_everything',
      'redflag.blood_in_stool',
      'redflag.dehydration',
      'redflag.fever_not_settling',
      'redflag.non_blanching_rash',
      'redflag.cold_hands',
    ],
  },

  /**
   * Investigations a Pakistani paediatric OPD actually orders.
   *
   * CLINICAL CONTENT AWAITING REVIEW, exactly like the formulary and the red
   * flags: the schema is ours, the list is Ali's to correct. A test offered
   * here is only a chip -- ordering one is always the doctor's tap, and nothing
   * suggests a test from a diagnosis (that would be decision support, which
   * rule 3.3 forbids).
   *
   * Grouped so the palette stays scannable at 390px; `fasting` is a property of
   * the test, used to OFFER the matching advice line, never to add one.
   */
  labCategories: [
    { id: 'haem', label: 'Haematology', order: 1 },
    { id: 'biochem', label: 'Biochemistry', order: 2 },
    { id: 'micro', label: 'Microbiology & serology', order: 3 },
    { id: 'imaging', label: 'Imaging', order: 4 },
  ],

  labsPalette: {
    haem: [
      { id: 'cbc', label: 'CBC' },
      { id: 'cbc_esr', label: 'CBC with ESR' },
      { id: 'esr', label: 'ESR' },
      { id: 'crp', label: 'CRP' },
      { id: 'retics', label: 'Reticulocyte count' },
      { id: 'pbf', label: 'Peripheral blood film' },
      { id: 'pt_aptt', label: 'PT / APTT' },
      { id: 'blood_group', label: 'Blood group & Rh' },
      { id: 'ferritin', label: 'Serum ferritin' },
    ],
    biochem: [
      { id: 'rbs', label: 'Random blood sugar' },
      { id: 'fbs', label: 'Fasting blood sugar', fasting: true },
      { id: 'lfts', label: 'LFTs' },
      { id: 'rfts', label: 'RFTs' },
      { id: 'electrolytes', label: 'Serum electrolytes' },
      { id: 'calcium', label: 'Serum calcium' },
      { id: 'vit_d', label: 'Vitamin D (25-OH)' },
      { id: 'tsh', label: 'TSH' },
      { id: 'lipids', label: 'Lipid profile', fasting: true },
      { id: 'serum_albumin', label: 'Serum albumin' },
    ],
    micro: [
      { id: 'urine_re', label: 'Urine R/E' },
      { id: 'urine_cs', label: 'Urine C/S' },
      { id: 'stool_re', label: 'Stool R/E' },
      { id: 'blood_cs', label: 'Blood C/S' },
      { id: 'throat_swab', label: 'Throat swab C/S' },
      { id: 'mp_ict', label: 'Malarial parasite / ICT' },
      { id: 'dengue_ns1', label: 'Dengue NS1 antigen' },
      { id: 'typhidot', label: 'Typhidot (IgM)' },
      { id: 'widal', label: 'Widal test' },
      { id: 'mantoux', label: 'Mantoux test' },
      { id: 'covid_pcr', label: 'COVID-19 PCR' },
    ],
    imaging: [
      {
        id: 'xray_chest',
        label: 'Chest X-ray',
        takesValue: true,
        valueHint: 'PA view',
      },
      {
        id: 'xray_other',
        label: 'X-ray',
        takesValue: true,
        valueHint: 'left knee AP + lateral',
      },
      {
        id: 'usg_abdomen',
        label: 'Ultrasound abdomen',
        takesValue: true,
        valueHint: 'full bladder',
      },
      { id: 'usg_kub', label: 'Ultrasound KUB' },
      { id: 'echo', label: 'Echocardiography' },
      { id: 'ct', label: 'CT', takesValue: true, valueHint: 'brain, plain' },
    ],
  },

  sigTemplates: [
    'sig.oral.liquid',
    'sig.oral.solid',
    'sig.oral.sachet',
    'sig.prn',
    'sig.stat',
    'sig.topical',
    'sig.drops.eye',
    'sig.drops.ear',
    'sig.drops.nasal',
    'sig.inhaled',
  ],

  formularySeed,
  dosing: dosingSeed,

  /*
    THE BACKGROUND HISTORY.

    Pure data: the engine that renders it (`domain/history.ts` and
    `HistoryEditor.tsx`) has never heard of antenatal care or weaning, exactly
    as `ExamSection.tsx` has never heard of chest indrawing. A different
    specialty is a different list in a different pack, not a code change.

    Every field is optional, and the common answers are taps where the answers
    can be enumerated. The age bands matter: asking about weaning at twelve
    years is noise, and a questionnaire that asks everything of everyone is one
    nobody fills in. A section the child has aged out of still appears if it
    already holds content -- see `resolveSections`.

    NOTHING HERE IS A SCORE. There is no "risk" field, no total, nothing that
    adds up. It is what the mother said, written down.
  */
  historySections: [
    {
      id: 'antenatal',
      label: 'Antenatal',
      order: 1,
      note: 'The pregnancy, as the mother remembers it.',
      // Offered up to about five. Beyond that it is a question nobody can
      // answer any better than it was answered the first time.
      appliesTo: { toDays: 1826 },
      fields: [
        {
          id: 'booking',
          label: 'Antenatal care',
          kind: 'choice',
          options: ['Booked', 'Unbooked', 'Partial'],
        },
        { id: 'maternal_illness', label: 'Illness in pregnancy', hint: 'diabetes, hypertension, fever…' },
        { id: 'medications', label: 'Medicines taken', hint: 'including herbal and over-the-counter' },
        { id: 'scans', label: 'Scans', hint: 'anomalies, growth concerns' },
      ],
    },
    {
      id: 'birth',
      label: 'Birth',
      order: 2,
      fields: [
        { id: 'place', label: 'Place', kind: 'choice', options: ['Hospital', 'Home', 'Clinic'] },
        {
          id: 'delivery',
          label: 'Delivery',
          kind: 'choice',
          options: ['SVD', 'LSCS', 'Instrumental'],
        },
        { id: 'term', label: 'Term', kind: 'choice', options: ['Term', 'Preterm', 'Post-term'] },
        { id: 'gestation', label: 'Gestation', kind: 'number', unit: 'weeks' },
        { id: 'birth_weight', label: 'Birth weight', kind: 'number', unit: 'kg' },
        { id: 'cried', label: 'Cried at birth', kind: 'choice', options: ['Yes', 'Delayed', 'No'] },
        {
          id: 'nicu',
          label: 'Nursery or NICU stay',
          kind: 'chips',
          options: ['Jaundice', 'Sepsis', 'Respiratory distress', 'Feeding', 'Phototherapy', 'Ventilated'],
        },
        { id: 'birth_note', label: 'Anything else about the birth' },
      ],
    },
    {
      id: 'feeding',
      label: 'Feeding',
      order: 3,
      // Under five. A teenager's diet belongs under Nutrition, not under the
      // weaning history.
      appliesTo: { toDays: 1826 },
      fields: [
        {
          id: 'infant_feeding',
          label: 'First six months',
          kind: 'choice',
          options: ['Exclusive breast', 'Mixed', 'Formula only'],
        },
        { id: 'breastfed_until', label: 'Breastfed until', hint: 'age, or “still”' },
        { id: 'weaning_age', label: 'Weaning started', kind: 'number', unit: 'months' },
        { id: 'current_diet', label: 'Diet now', hint: 'family food, milk, fussy eating…' },
      ],
    },
    {
      id: 'development',
      label: 'Development & schooling',
      order: 5,
      fields: [
        { id: 'concerns', label: 'Any concerns', hint: 'raised by the family or by school' },
        { id: 'school', label: 'School', hint: 'class, how they are doing' },
        { id: 'vision_hearing', label: 'Vision and hearing', hint: 'tested? any worry?' },
      ],
    },
    {
      id: 'past',
      label: 'Past illnesses & admissions',
      order: 6,
      fields: [
        { id: 'admissions', label: 'Admissions', hint: 'when, where, what for' },
        { id: 'surgery', label: 'Operations' },
        { id: 'illnesses', label: 'Significant illnesses' },
        { id: 'tb_contact', label: 'TB contact', kind: 'choice', options: ['None known', 'Household', 'Other'] },
      ],
    },
    {
      id: 'family',
      label: 'Family & home',
      order: 7,
      fields: [
        {
          id: 'consanguinity',
          label: 'Parents related',
          kind: 'choice',
          options: ['No', 'First cousins', 'Second cousins', 'Other'],
        },
        { id: 'siblings', label: 'Siblings', hint: 'how many, any unwell' },
        { id: 'deaths', label: 'Deaths in childhood in the family' },
        { id: 'family_illness', label: 'Illness that runs in the family' },
        { id: 'home', label: 'Home', hint: 'water, crowding, smoke exposure' },
      ],
    },
  ],

  /*
    THE EPI SCHEDULE, AS DATA.

    Here rather than in code so a different country's schedule is a different
    pack, and with a reference for the same reason a dosing row needs one: a
    schedule with no published source is a list of opinions.

    `atDays` is when the visit is DUE per the schedule. Nothing in the app
    compares it to today and concludes anything -- see `ImmunisationPanel`.
    Recording what was given is a record; deciding what to give now is a
    clinical judgement and this app does not make those (PRODUCT.md 3.3).
  */
  immunisationSchedule: {
    reference:
      'Expanded Programme on Immunization (EPI) Pakistan, routine childhood schedule',
    visits: [
      { id: 'birth', label: 'At birth', atDays: 0, doses: ['BCG', 'OPV-0', 'Hep B-0'] },
      { id: 'w6', label: '6 weeks', atDays: 42, doses: ['Penta-1', 'OPV-1', 'PCV-1', 'Rota-1'] },
      { id: 'w10', label: '10 weeks', atDays: 70, doses: ['Penta-2', 'OPV-2', 'PCV-2', 'Rota-2'] },
      { id: 'w14', label: '14 weeks', atDays: 98, doses: ['Penta-3', 'OPV-3', 'PCV-3', 'IPV'] },
      { id: 'm9', label: '9 months', atDays: 274, doses: ['Measles-1', 'Typhoid conjugate'] },
      { id: 'm15', label: '15 months', atDays: 457, doses: ['Measles-2'] },
    ],
  },

  /*
    DEVELOPMENTAL MILESTONES.

    `typicalByDays` is a REFERENCE AGE and is displayed the way a growth chart
    displays a centile band: the published norm beside what was recorded.
    Nothing turns a blank into "delayed". domain/patient.ts already names that
    failure in this codebase's own words -- a merged weight series "reads as
    growth faltering, which is a diagnosis the data invented".
  */
  milestones: {
    reference: 'WHO Multicentre Growth Reference Study motor milestones; standard paediatric texts',
    items: [
      { id: 'social_smile', label: 'Social smile', domain: 'social', typicalByDays: 56 },
      { id: 'head_control', label: 'Head control', domain: 'gross', typicalByDays: 91 },
      { id: 'rolls_over', label: 'Rolls over', domain: 'gross', typicalByDays: 152 },
      { id: 'reaches', label: 'Reaches for objects', domain: 'fine', typicalByDays: 152 },
      { id: 'sits_unsupported', label: 'Sits without support', domain: 'gross', typicalByDays: 274 },
      { id: 'babbles', label: 'Babbles', domain: 'speech', typicalByDays: 274 },
      { id: 'pincer', label: 'Pincer grip', domain: 'fine', typicalByDays: 305 },
      { id: 'stands_alone', label: 'Stands alone', domain: 'gross', typicalByDays: 365 },
      { id: 'first_words', label: 'First words', domain: 'speech', typicalByDays: 365 },
      { id: 'walks_alone', label: 'Walks alone', domain: 'gross', typicalByDays: 457 },
      { id: 'two_words', label: 'Two-word phrases', domain: 'speech', typicalByDays: 730 },
      { id: 'stranger_anxiety', label: 'Stranger anxiety', domain: 'social', typicalByDays: 274 },
    ],
  },

  modules: ['growth', 'malnutrition'],
  moduleConfig: {
    growth: {
      // MUAC is offered alongside the rest: it is an ordinary age-keyed chart,
      // and a child being followed through a feeding programme is one whose
      // arm circumference is worth plotting over time rather than only
      // classifying once.
      measures: ['weight', 'length', 'height', 'hc', 'bmi', 'muac'],
      // WHO is the default: openly licensed, standard in Pakistan and global
      // health, and it covers 0-19. CDC stays available because the two
      // genuinely disagree under age 2 and some practices follow CDC.
      defaultReference: 'WHO',
    },
    /**
     * Pakistan's national programme, not WHO 2023, because this pack is for a
     * Pakistani paediatric clinic and the two differ in a way that changes who
     * gets treated: the national protocol admits on MUAC or bilateral pitting
     * oedema alone, while WHO 2023 also admits on weight-for-height.
     *
     * That is a real, deliberate divergence and not an omission. A clinic
     * following the global guideline changes `criteria` to include `'whz'` in
     * the pack builder; nothing in the app changes.
     */
    malnutrition: {
      criteria: ['oedema', 'muac'],
      muacSevereMm: 115,
      muacModerateMm: 125,
      whzSevere: -3,
      whzModerate: -2,
      reference:
        'National Guideline for the Management of Acute Malnutrition, Ministry of National Health Services, Pakistan, May 2019',
    },
  },

  /**
   * Paediatric instructions address the caregiver, so the sig verb defaults to
   * "give" / "دیں" rather than "take" / "لیں". An adult-medicine pack would
   * default to 'take' -- and that is a one-line data change here, not a code
   * change anywhere.
   */
  sigDefaults: { slots: { administer: 'give' } },
};

export default paediatrics;
