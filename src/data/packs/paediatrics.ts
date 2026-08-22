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

  modules: ['growth'],
  moduleConfig: {
    growth: {
      measures: ['weight', 'length', 'height', 'hc', 'bmi'],
      // WHO is the default: openly licensed, standard in Pakistan and global
      // health, and it covers 0-19. CDC stays available because the two
      // genuinely disagree under age 2 and some practices follow CDC.
      defaultReference: 'WHO',
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
