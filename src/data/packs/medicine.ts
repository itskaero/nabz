/**
 * The adult internal medicine content pack.
 *
 * ------------------------------------------------------------------------
 * WHY THIS EXISTS DESPITE THE WARNING IN paediatrics.ts
 *
 * paediatrics.ts says: "DO NOT author packs for other specialties... An ENT or
 * derm pack is authored by a clinician OF that specialty." That rule stands and
 * it is a good one. This pack is not an exception to it -- it is the same rule
 * applied one step earlier: this is a DRAFT SKELETON for a general/internal
 * medicine clinician to correct, not a shipped pack. It stays out of the pack
 * registry until a physician signs it off.
 *
 * Concretely, before this pack is registered:
 *   1. Every dosing row is reviewed and `verified` flipped by that physician.
 *   2. Every formulary row is reconciled to DRAP (see the seed file header).
 *   3. The findings palettes are cut down to what that physician actually taps.
 *      A palette nobody uses is worse than a missing one: it costs a scroll on
 *      every patient.
 * ------------------------------------------------------------------------
 *
 * This file proves the seam works. Everything that differs between paediatrics
 * and adult medicine below is DATA -- exam systems, findings, labs, advice ids,
 * the sig verb -- and not one line of component code should need to change to
 * render it. If something here cannot be expressed as pack data, that is a
 * schema bug worth fixing now rather than a reason to special-case in a
 * component.
 */
import type { ContentPack } from '@domain/pack.ts';
import { medicineFormularySeed } from '@data/formulary/medicine.seed.ts';
import { medicineDosingSeed } from '@data/dosing/medicine.seed.ts';
import { medicineScores } from './medicine.scores.ts';

export const medicine: ContentPack = {
  id: 'medicine',
  specialty: 'Internal Medicine',
  author: {
    name: 'Pack author',
    credential: 'Internal Medicine',
    updated: '2026-08-28',
  },
  // See the file header: this pack stays badged as an unverified draft in
  // every surface that lists it until a physician of this specialty signs it
  // off, the same way an individual dosing row does.
  verified: false,

  /**
   * Tap order at OPD speed. The adult medicine OPD in Pakistan is dominated by
   * diabetes, hypertension and their consequences, so CVS sits second and the
   * foot check gets its own system rather than hiding inside MSK -- a diabetic
   * foot exam is a different act from a joint exam and it is the one most often
   * skipped.
   */
  examSystems: [
    { id: 'general', label: 'General', order: 1 },
    { id: 'cvs', label: 'Cardiovascular', order: 2 },
    { id: 'respiratory', label: 'Respiratory', order: 3 },
    { id: 'abdomen', label: 'Abdomen', order: 4 },
    { id: 'cns', label: 'CNS', order: 5 },
    { id: 'msk', label: 'Musculoskeletal', order: 6 },
    { id: 'feet', label: 'Feet / Diabetic foot', order: 7 },
    { id: 'skin', label: 'Skin', order: 8 },
    { id: 'endocrine', label: 'Neck / Thyroid', order: 9 },
  ],

  findingsPalette: {
    general: [
      { id: 'well', label: 'well-looking' },
      { id: 'ill', label: 'ill-looking' },
      { id: 'alert_oriented', label: 'alert and oriented' },
      { id: 'drowsy', label: 'drowsy' },
      { id: 'confused', label: 'confused' },
      { id: 'pallor', label: 'pallor' },
      { id: 'jaundice', label: 'jaundice' },
      { id: 'cyanosis', label: 'cyanosis' },
      { id: 'clubbing', label: 'clubbing' },
      { id: 'koilonychia', label: 'koilonychia' },
      { id: 'dehydration', label: 'dehydration', takesValue: true, valueHint: 'mild / moderate / severe' },
      { id: 'oedema', label: 'oedema', takesValue: true, valueHint: 'site, pitting?' },
      { id: 'lymphadenopathy', label: 'lymphadenopathy', takesValue: true, valueHint: 'site, size' },
      { id: 'febrile', label: 'febrile', takesValue: true, valueHint: 'temp' },
      { id: 'bp', label: 'blood pressure', takesValue: true, valueHint: 'mmHg, arm, position' },
      { id: 'postural_drop', label: 'postural drop in BP', takesValue: true, valueHint: 'mmHg' },
      { id: 'pulse', label: 'pulse', takesValue: true, valueHint: 'rate, rhythm' },
      { id: 'spo2', label: 'oxygen saturation', takesValue: true, valueHint: '% on air' },
      { id: 'weight', label: 'weight', takesValue: true, valueHint: 'kg' },
      { id: 'bmi', label: 'BMI', takesValue: true, valueHint: 'kg/m2' },
      { id: 'waist', label: 'waist circumference', takesValue: true, valueHint: 'cm' },
      { id: 'cachexia', label: 'cachexia / wasting' },
    ],
    cvs: [
      { id: 'normal_s1s2', label: 'S1 S2 normal, no murmur' },
      { id: 'murmur', label: 'murmur', takesValue: true, valueHint: 'grade, site, radiation' },
      { id: 'added_sound', label: 'added heart sound', takesValue: true, valueHint: 'S3 / S4' },
      { id: 'irregular', label: 'irregularly irregular pulse' },
      { id: 'tachycardia', label: 'tachycardia', takesValue: true, valueHint: 'rate' },
      { id: 'bradycardia', label: 'bradycardia', takesValue: true, valueHint: 'rate' },
      { id: 'raised_jvp', label: 'raised JVP', takesValue: true, valueHint: 'cm' },
      { id: 'apex_displaced', label: 'displaced apex beat', takesValue: true, valueHint: 'position' },
      { id: 'peripheral_pulses', label: 'peripheral pulses', takesValue: true, valueHint: 'which, present / absent' },
      { id: 'carotid_bruit', label: 'carotid bruit', takesValue: true, valueHint: 'side' },
      { id: 'pedal_oedema', label: 'pedal oedema', takesValue: true, valueHint: 'grade, level' },
      { id: 'calf_tenderness', label: 'calf tenderness / swelling', takesValue: true, valueHint: 'side' },
    ],
    respiratory: [
      { id: 'clear_chest', label: 'chest clear, equal air entry' },
      { id: 'tachypnoea', label: 'tachypnoea', takesValue: true, valueHint: 'rate' },
      { id: 'accessory_muscles', label: 'accessory muscle use' },
      { id: 'wheeze', label: 'wheeze', takesValue: true, valueHint: 'zone' },
      { id: 'crepitations', label: 'crepitations', takesValue: true, valueHint: 'zone, fine / coarse' },
      { id: 'bronchial_breathing', label: 'bronchial breathing', takesValue: true, valueHint: 'zone' },
      { id: 'reduced_air_entry', label: 'reduced air entry', takesValue: true, valueHint: 'side, zone' },
      { id: 'dullness', label: 'dullness to percussion', takesValue: true, valueHint: 'side, level' },
      { id: 'hyperresonant', label: 'hyper-resonant percussion', takesValue: true, valueHint: 'side' },
      { id: 'pleural_rub', label: 'pleural rub', takesValue: true, valueHint: 'site' },
      { id: 'barrel_chest', label: 'barrel-shaped chest' },
      { id: 'trachea_shifted', label: 'tracheal shift', takesValue: true, valueHint: 'side' },
      { id: 'pefr', label: 'peak flow', takesValue: true, valueHint: 'L/min' },
    ],
    abdomen: [
      { id: 'soft_nontender', label: 'soft, non-tender' },
      { id: 'tenderness', label: 'tenderness', takesValue: true, valueHint: 'site' },
      { id: 'guarding', label: 'guarding / rigidity', takesValue: true, valueHint: 'site' },
      { id: 'rebound', label: 'rebound tenderness', takesValue: true, valueHint: 'site' },
      { id: 'distension', label: 'distension' },
      { id: 'ascites', label: 'ascites (shifting dullness)' },
      { id: 'hepatomegaly', label: 'hepatomegaly', takesValue: true, valueHint: 'cm below costal margin' },
      { id: 'splenomegaly', label: 'splenomegaly', takesValue: true, valueHint: 'cm' },
      { id: 'mass', label: 'palpable mass', takesValue: true, valueHint: 'site, size' },
      { id: 'renal_angle', label: 'renal angle tenderness', takesValue: true, valueHint: 'side' },
      { id: 'murphy', label: "Murphy's sign positive" },
      { id: 'bowel_sounds', label: 'bowel sounds', takesValue: true, valueHint: 'normal / absent / exaggerated' },
      { id: 'hernia', label: 'hernia', takesValue: true, valueHint: 'site' },
      { id: 'caput', label: 'dilated abdominal veins' },
      { id: 'per_rectal', label: 'per rectal examination', takesValue: true, valueHint: 'findings' },
    ],
    cns: [
      { id: 'gcs', label: 'GCS', takesValue: true, valueHint: 'E_V_M_ = /15' },
      { id: 'oriented', label: 'oriented in time, place and person' },
      { id: 'neck_stiffness', label: 'neck stiffness' },
      { id: 'cranial_nerves_intact', label: 'cranial nerves intact' },
      { id: 'cranial_nerve_palsy', label: 'cranial nerve palsy', takesValue: true, valueHint: 'which, side' },
      { id: 'power', label: 'power', takesValue: true, valueHint: 'limb, MRC grade' },
      { id: 'tone_abnormal', label: 'abnormal tone', takesValue: true, valueHint: 'increased / decreased, limb' },
      { id: 'reflexes', label: 'reflexes', takesValue: true, valueHint: 'brisk / absent, which' },
      { id: 'plantars', label: 'plantar response', takesValue: true, valueHint: 'flexor / extensor, side' },
      { id: 'sensory_loss', label: 'sensory loss', takesValue: true, valueHint: 'modality, distribution' },
      { id: 'glove_stocking', label: 'glove-and-stocking sensory loss' },
      { id: 'coordination', label: 'impaired coordination', takesValue: true, valueHint: 'detail' },
      { id: 'gait', label: 'abnormal gait', takesValue: true, valueHint: 'type' },
      { id: 'tremor', label: 'tremor', takesValue: true, valueHint: 'rest / postural / intention' },
      { id: 'fundoscopy', label: 'fundoscopy', takesValue: true, valueHint: 'findings' },
      { id: 'speech', label: 'speech disturbance', takesValue: true, valueHint: 'dysarthria / dysphasia' },
    ],
    msk: [
      { id: 'msk_normal', label: 'musculoskeletal examination normal' },
      { id: 'joint_swelling', label: 'joint swelling', takesValue: true, valueHint: 'joint(s)' },
      { id: 'joint_tenderness', label: 'joint tenderness', takesValue: true, valueHint: 'joint(s)' },
      { id: 'joint_warmth', label: 'joint warm and red', takesValue: true, valueHint: 'joint' },
      { id: 'reduced_rom', label: 'reduced range of movement', takesValue: true, valueHint: 'joint' },
      { id: 'deformity', label: 'deformity', takesValue: true, valueHint: 'site' },
      { id: 'spinal_tenderness', label: 'spinal tenderness', takesValue: true, valueHint: 'level' },
      { id: 'slr', label: 'straight leg raise limited', takesValue: true, valueHint: 'degrees, side' },
      { id: 'muscle_wasting', label: 'muscle wasting', takesValue: true, valueHint: 'site' },
      { id: 'tophi', label: 'gouty tophi', takesValue: true, valueHint: 'site' },
    ],
    feet: [
      { id: 'feet_normal', label: 'feet normal, no ulcer or deformity' },
      { id: 'ulcer', label: 'foot ulcer', takesValue: true, valueHint: 'site, size, depth' },
      { id: 'callus', label: 'callus', takesValue: true, valueHint: 'site' },
      { id: 'monofilament', label: 'monofilament sensation lost', takesValue: true, valueHint: 'sites missed' },
      { id: 'vibration_lost', label: 'vibration sense reduced' },
      { id: 'absent_pulses', label: 'absent foot pulses', takesValue: true, valueHint: 'which, side' },
      { id: 'cold_foot', label: 'cold, poorly perfused foot', takesValue: true, valueHint: 'side' },
      { id: 'fungal_nails', label: 'fungal nail / interdigital infection' },
      { id: 'charcot', label: 'deformed (Charcot-type) foot', takesValue: true, valueHint: 'side' },
      { id: 'footwear', label: 'unsuitable footwear' },
    ],
    skin: [
      { id: 'skin_normal', label: 'skin normal' },
      { id: 'rash', label: 'rash', takesValue: true, valueHint: 'type, distribution' },
      { id: 'non_blanching', label: 'non-blanching rash / purpura' },
      { id: 'bruising', label: 'bruising', takesValue: true, valueHint: 'site' },
      { id: 'cellulitis', label: 'cellulitis', takesValue: true, valueHint: 'site' },
      { id: 'ulceration', label: 'skin ulceration', takesValue: true, valueHint: 'site' },
      { id: 'vesicles', label: 'vesicles', takesValue: true, valueHint: 'dermatome / site' },
      { id: 'fungal', label: 'fungal / tinea lesion', takesValue: true, valueHint: 'site' },
      { id: 'acanthosis', label: 'acanthosis nigricans' },
      { id: 'pigmentation', label: 'abnormal pigmentation', takesValue: true, valueHint: 'site' },
      { id: 'injection_sites', label: 'lipohypertrophy at injection sites' },
      { id: 'pruritus', label: 'excoriation from itching' },
    ],
    endocrine: [
      { id: 'neck_normal', label: 'no goitre, no neck swelling' },
      { id: 'goitre', label: 'goitre', takesValue: true, valueHint: 'diffuse / nodular, grade' },
      { id: 'thyroid_nodule', label: 'thyroid nodule', takesValue: true, valueHint: 'side, size' },
      { id: 'thyroid_bruit', label: 'thyroid bruit' },
      { id: 'tremor_fine', label: 'fine tremor of outstretched hands' },
      { id: 'eye_signs', label: 'thyroid eye signs', takesValue: true, valueHint: 'lid lag / proptosis' },
      { id: 'dry_skin_hair', label: 'dry skin and coarse hair' },
      { id: 'slow_relaxing', label: 'slow-relaxing ankle reflexes' },
      { id: 'gynaecomastia', label: 'gynaecomastia' },
      { id: 'cushingoid', label: 'cushingoid appearance' },
    ],
  },

  /**
   * Advice ids. Every id here MUST exist in the bilingual string catalogue --
   * see i18n/medicine.strings.ts, which ships the English and Urdu for all of
   * them. Adding an id here without the string is how a prescription ends up
   * printing a dotted key at a patient.
   *
   * Tier 1 is routine advice the doctor taps. Tier 2 is "come back at once"
   * -- red flags, which the app prints in a distinct block.
   */
  advicePacks: {
    tier1: [
      'advice.complete_course',
      'advice.take_with_food',
      'advice.take_before_food',
      'advice.take_at_night',
      'advice.do_not_stop_medicine',
      'advice.bring_all_medicines',
      'advice.no_self_medication',
      'advice.avoid_unprescribed_remedies',
      'advice.avoid_nsaids',
      'advice.increase_fluids',
      'advice.limit_fluid',
      'advice.low_salt_diet',
      'advice.diabetic_diet',
      'advice.weight_reduction',
      'advice.daily_walk',
      'advice.stop_smoking',
      'advice.stop_smokeless_tobacco',
      'advice.check_bp_log',
      'advice.check_sugar_log',
      'advice.daily_weight',
      'advice.foot_care',
      'advice.hypo_treatment',
      'advice.inhaler_technique',
      'advice.tb_adherence',
      'advice.family_screening_tb',
      'advice.fasting_before_test',
      'advice.avoid_driving',
      'advice.contraception_warning',
      'advice.rest_at_home',
      'advice.follow_up_in',
    ],
    tier2: [
      'redflag.chest_pain',
      'redflag.breathless_at_rest',
      'redflag.stroke_symptoms',
      'redflag.fainting',
      'redflag.severe_headache',
      'redflag.confusion',
      'redflag.persistent_vomiting',
      'redflag.vomiting_blood',
      'redflag.black_stools',
      'redflag.haemoptysis',
      'redflag.severe_abdominal_pain',
      'redflag.reduced_urine',
      'redflag.swelling_worsening',
      'redflag.calf_pain',
      'redflag.hypoglycaemia',
      'redflag.hyperglycaemia',
      'redflag.foot_ulcer',
      'redflag.visual_change',
      'redflag.fever_not_settling',
      'redflag.rash_after_medicine',
      'redflag.bleeding_on_blood_thinner',
      'redflag.sore_throat_on_carbimazole',
    ],
  },

  labCategories: [
    { id: 'haem', label: 'Haematology', order: 1 },
    { id: 'biochem', label: 'Biochemistry', order: 2 },
    { id: 'micro', label: 'Microbiology, serology & immunology', order: 3 },
    { id: 'imaging', label: 'Imaging', order: 4 },
    { id: 'cardio', label: 'Cardiac & physiological', order: 5 },
  ],

  /**
   * Same rule as the paediatric pack: a test offered here is only a chip.
   * Ordering one is always the doctor's tap, and nothing suggests a test from a
   * diagnosis -- that would be decision support, which rule 3.3 forbids.
   *
   * `fasting` is a property of the test, used to OFFER the matching advice line,
   * never to add one.
   */
  labsPalette: {
    haem: [
      { id: 'cbc', label: 'CBC' },
      { id: 'cbc_esr', label: 'CBC with ESR' },
      { id: 'esr', label: 'ESR' },
      { id: 'crp', label: 'CRP' },
      { id: 'pbf', label: 'Peripheral blood film' },
      { id: 'retics', label: 'Reticulocyte count' },
      { id: 'pt_inr', label: 'PT / INR' },
      { id: 'aptt', label: 'APTT' },
      { id: 'd_dimer', label: 'D-dimer' },
      { id: 'ferritin', label: 'Serum ferritin' },
      { id: 'iron_studies', label: 'Iron studies (Fe, TIBC, saturation)' },
      { id: 'b12_folate', label: 'Vitamin B12 and folate' },
      { id: 'blood_group', label: 'Blood group & Rh' },
      { id: 'coombs', label: "Coombs test (direct)" },
      { id: 'hb_electrophoresis', label: 'Haemoglobin electrophoresis' },
      { id: 'g6pd', label: 'G6PD screen' },
    ],
    biochem: [
      { id: 'rbs', label: 'Random blood sugar' },
      { id: 'fbs', label: 'Fasting blood sugar', fasting: true },
      { id: 'bsf_bsr', label: 'Fasting and 2-hour post-prandial sugar', fasting: true },
      { id: 'hba1c', label: 'HbA1c' },
      { id: 'ogtt', label: 'OGTT (75 g)', fasting: true },
      { id: 'lipids', label: 'Lipid profile', fasting: true },
      { id: 'rfts', label: 'RFTs (urea, creatinine)' },
      { id: 'egfr', label: 'eGFR' },
      { id: 'electrolytes', label: 'Serum electrolytes' },
      { id: 'lfts', label: 'LFTs' },
      { id: 'serum_albumin', label: 'Serum albumin' },
      { id: 'calcium', label: 'Serum calcium' },
      { id: 'phosphate', label: 'Serum phosphate' },
      { id: 'magnesium', label: 'Serum magnesium' },
      { id: 'uric_acid', label: 'Serum uric acid' },
      { id: 'tsh', label: 'TSH' },
      { id: 'ft4', label: 'Free T4' },
      { id: 'ft3', label: 'Free T3' },
      { id: 'vit_d', label: 'Vitamin D (25-OH)' },
      { id: 'amylase_lipase', label: 'Serum amylase / lipase' },
      { id: 'cpk', label: 'CPK' },
      { id: 'ldh', label: 'LDH' },
      { id: 'troponin', label: 'Troponin I / T' },
      { id: 'bnp', label: 'NT-proBNP' },
      { id: 'abg', label: 'Arterial blood gases' },
      { id: 'acr', label: 'Urinary albumin:creatinine ratio' },
      { id: 'urine_protein_24h', label: '24-hour urinary protein' },
      { id: 'psa', label: 'PSA' },
    ],
    micro: [
      { id: 'urine_re', label: 'Urine R/E' },
      { id: 'urine_cs', label: 'Urine C/S' },
      { id: 'blood_cs', label: 'Blood C/S' },
      { id: 'sputum_cs', label: 'Sputum C/S' },
      { id: 'sputum_afb', label: 'Sputum for AFB (2 samples)' },
      { id: 'genexpert', label: 'GeneXpert MTB/RIF' },
      { id: 'stool_re', label: 'Stool R/E' },
      { id: 'pus_cs', label: 'Pus / wound swab C/S' },
      { id: 'mp_ict', label: 'Malarial parasite / ICT' },
      { id: 'dengue_ns1', label: 'Dengue NS1 antigen' },
      { id: 'typhidot', label: 'Typhidot (IgM)' },
      { id: 'hbsag', label: 'HBsAg' },
      { id: 'anti_hcv', label: 'Anti-HCV' },
      { id: 'hiv', label: 'HIV screening' },
      { id: 'vdrl', label: 'VDRL / RPR' },
      { id: 'h_pylori', label: 'H. pylori stool antigen' },
      { id: 'ana', label: 'ANA' },
      { id: 'anti_dsdna', label: 'Anti-dsDNA' },
      { id: 'rf', label: 'Rheumatoid factor' },
      { id: 'anti_ccp', label: 'Anti-CCP' },
      { id: 'complement', label: 'C3 / C4' },
      { id: 'ascitic_tap', label: 'Ascitic fluid R/E, C/S and albumin' },
      { id: 'pleural_tap', label: 'Pleural fluid R/E, C/S and biochemistry' },
      { id: 'csf', label: 'CSF R/E, C/S and biochemistry' },
    ],
    imaging: [
      { id: 'xray_chest', label: 'Chest X-ray', takesValue: true, valueHint: 'PA view' },
      { id: 'xray_other', label: 'X-ray', takesValue: true, valueHint: 'lumbar spine AP + lateral' },
      { id: 'usg_abdomen', label: 'Ultrasound abdomen', takesValue: true, valueHint: 'fasting, full bladder' },
      { id: 'usg_kub', label: 'Ultrasound KUB' },
      { id: 'usg_neck', label: 'Ultrasound neck / thyroid' },
      { id: 'doppler', label: 'Doppler ultrasound', takesValue: true, valueHint: 'left lower limb venous' },
      { id: 'ct', label: 'CT', takesValue: true, valueHint: 'brain, plain' },
      { id: 'ct_contrast', label: 'CT with contrast', takesValue: true, valueHint: 'chest; check creatinine first' },
      { id: 'mri', label: 'MRI', takesValue: true, valueHint: 'lumbar spine' },
      { id: 'dexa', label: 'DEXA bone density scan' },
      { id: 'barium', label: 'Barium study', takesValue: true, valueHint: 'swallow / meal / enema' },
      { id: 'mammogram', label: 'Mammography' },
    ],
    cardio: [
      { id: 'ecg', label: 'ECG (12-lead)' },
      { id: 'echo', label: 'Echocardiography' },
      { id: 'ett', label: 'Exercise tolerance test' },
      { id: 'holter', label: 'Holter monitoring', takesValue: true, valueHint: '24 hours' },
      { id: 'abpm', label: 'Ambulatory BP monitoring' },
      { id: 'spirometry', label: 'Spirometry with reversibility' },
      { id: 'pefr_chart', label: 'Peak flow diary' },
      { id: 'ugi_endoscopy', label: 'Upper GI endoscopy' },
      { id: 'colonoscopy', label: 'Colonoscopy' },
      { id: 'eeg', label: 'EEG' },
      { id: 'ncs_emg', label: 'Nerve conduction studies / EMG' },
      { id: 'fundus_screen', label: 'Retinal screening (fundus photography)' },
      { id: 'abi', label: 'Ankle-brachial pressure index' },
    ],
  },

  /**
   * The eight adult-specific templates this pack needs, over the ones shared
   * with paediatrics. Their English + Urdu live alongside the rest of this
   * pack's words in `data/phrases/medicine.ts`, not in the shared locale
   * files -- see that file's header for why. `sig.weekly` is the once-weekly
   * methotrexate template; the frequency-mismatch case it exists to prevent
   * is caught separately, at composition time, by `weeklyOnlyViolation` in
   * `domain/sig.ts`, because a template alone cannot see which drug it is
   * attached to.
   */
  sigTemplates: [
    'sig.oral.solid',
    'sig.oral.liquid',
    'sig.oral.sachet',
    'sig.prn',
    'sig.stat',
    'sig.topical',
    'sig.drops.eye',
    'sig.drops.ear',
    'sig.drops.nasal',
    'sig.inhaled',
    'sig.sublingual',
    'sig.injection.sc',
    'sig.injection.im',
    'sig.nebulised',
    'sig.tapering',
    'sig.weekly',
    'sig.alternate_days',
    'sig.titrated',
  ],

  formularySeed: medicineFormularySeed,
  dosing: medicineDosingSeed,
  scores: medicineScores,

  /**
   * eGFR: the module this pack's own notes called for -- "GFR is to medicine
   * what the growth chart is to paediatrics". It needs no `moduleConfig`
   * entry; unlike growth it offers no per-pack measure selection, so there is
   * nothing to configure.
   */
  modules: ['gfr', 'bmi'],
  moduleConfig: {},

  /**
   * The line the paediatric pack predicted: adult instructions address the
   * patient, so the sig verb is "take" / "لیں" rather than "give" / "دیں".
   * One line of data. No code changed.
   */
  sigDefaults: { slots: { administer: 'take' } },
};

export default medicine;
