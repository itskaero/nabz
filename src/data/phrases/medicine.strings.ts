/**
 * English + Urdu strings for every id the medicine pack references.
 *
 * ============================ READ BEFORE USE ============================
 * URDU AWAITING NATIVE REVIEW. The Urdu below is clinic register -- the way a
 * Pakistani doctor talks to a patient, not textbook Urdu and not a literal
 * translation of the English. It still needs a native clinician to read every
 * line aloud as if handing the slip over. Two specific things to check:
 *
 *   1. The imperative form. These use the respectful plural (لیں / کریں /
 *      آئیں), which is right for an adult patient. The paediatric pack uses
 *      دیں because it addresses a caregiver about a child. Do not mix them.
 *
 *   2. `{n}` placeholders. Urdu word order puts the number in a different
 *      position from English. If a renderer assumes the placeholder sits at the
 *      same index in both strings, it will produce nonsense. Check the two
 *      strings that carry {n}: advice.follow_up_in and advice.limit_fluid.
 *
 * A patient-facing string that reads badly is not a cosmetic bug. It is the
 * part of the prescription the patient actually acts on.
 * ========================================================================
 */

export interface BilingualString {
  en: string;
  ur: string;
}

/** Routine advice (tier 1). Addressed to the adult patient. */
export const medicineAdviceStrings: Record<string, BilingualString> = {
  'advice.complete_course': {
    en: 'Complete the full course of medicine even if you feel better.',
    ur: 'دوا کا پورا کورس مکمل کریں، طبیعت بہتر ہونے پر بھی درمیان میں نہ چھوڑیں۔',
  },
  'advice.take_with_food': {
    en: 'Take this medicine with food.',
    ur: 'یہ دوا کھانے کے ساتھ لیں۔',
  },
  'advice.take_before_food': {
    en: 'Take this medicine 30 minutes before food.',
    ur: 'یہ دوا کھانے سے آدھا گھنٹہ پہلے لیں۔',
  },
  'advice.take_at_night': {
    en: 'Take this medicine at night, before sleeping.',
    ur: 'یہ دوا رات کو سونے سے پہلے لیں۔',
  },
  'advice.do_not_stop_medicine': {
    en: 'Do not stop this medicine on your own, even if you feel well.',
    ur: 'یہ دوا اپنی مرضی سے بند نہ کریں، چاہے طبیعت بالکل ٹھیک ہو۔',
  },
  'advice.bring_all_medicines': {
    en: 'Bring all your medicines with you at the next visit.',
    ur: 'اگلی بار اپنی تمام دوائیں ساتھ لے کر آئیں۔',
  },
  'advice.no_self_medication': {
    en: 'Do not add any other medicine without asking.',
    ur: 'اپنی مرضی سے کوئی اور دوا شامل نہ کریں۔',
  },
  'advice.avoid_unprescribed_remedies': {
    en: 'Do not take herbal or unprescribed remedies alongside this treatment.',
    ur: 'اس علاج کے ساتھ غیر تجویز کردہ دیسی یا ہربل دوائیں استعمال نہ کریں۔',
  },
  'advice.avoid_nsaids': {
    en: 'Avoid painkillers unless prescribed; they can harm the kidneys and stomach.',
    ur: 'بغیر مشورے کے درد کی دوائیں (پین کلر) استعمال نہ کریں، ان سے گردوں اور معدے کو نقصان ہوتا ہے۔',
  },
  'advice.increase_fluids': {
    en: 'Drink plenty of water.',
    ur: 'پانی زیادہ پئیں۔',
  },
  'advice.limit_fluid': {
    en: 'Limit all fluids to about {n} litres per day.',
    ur: 'دن بھر میں تمام مشروبات اور پانی تقریباً {n} لیٹر تک محدود رکھیں۔',
  },
  'advice.low_salt_diet': {
    en: 'Reduce salt in your food. Avoid pickles, papad and packaged snacks.',
    ur: 'کھانے میں نمک کم کریں۔ اچار، پاپڑ اور بازاری نمکین اشیاء سے پرہیز کریں۔',
  },
  'advice.diabetic_diet': {
    en: 'Follow a diabetic diet: reduce sugar, sweets, rice, bakery items and cold drinks.',
    ur: 'ذیابیطس والی خوراک لیں: چینی، مٹھائی، چاول، بیکری کی اشیاء اور کولڈ ڈرنکس کم کریں۔',
  },
  'advice.weight_reduction': {
    en: 'Work on reducing your weight.',
    ur: 'اپنا وزن کم کرنے کی کوشش کریں۔',
  },
  'advice.daily_walk': {
    en: 'Walk for at least 30 minutes daily, most days of the week.',
    ur: 'ہفتے میں زیادہ تر دن، روزانہ کم از کم تیس منٹ چہل قدمی کریں۔',
  },
  'advice.stop_smoking': {
    en: 'Stop smoking completely.',
    ur: 'سگریٹ نوشی مکمل طور پر ترک کر دیں۔',
  },
  'advice.stop_smokeless_tobacco': {
    en: 'Stop paan, chhalia, gutka and naswar.',
    ur: 'پان، چھالیہ، گٹکا اور نسوار مکمل طور پر چھوڑ دیں۔',
  },
  'advice.check_bp_log': {
    en: 'Check your blood pressure regularly, write the readings down and bring them.',
    ur: 'بلڈ پریشر باقاعدگی سے چیک کریں، ریڈنگ لکھتے جائیں اور ساتھ لے کر آئیں۔',
  },
  'advice.check_sugar_log': {
    en: 'Check your blood sugar as advised, write the readings down and bring them.',
    ur: 'شوگر بتائے گئے طریقے سے چیک کریں، ریڈنگ لکھتے جائیں اور ساتھ لے کر آئیں۔',
  },
  'advice.daily_weight': {
    en: 'Weigh yourself daily at the same time and write it down.',
    ur: 'روزانہ ایک ہی وقت پر وزن کریں اور لکھ لیں۔',
  },
  'advice.foot_care': {
    en: 'Check your feet every day. Do not walk barefoot and wear soft, well-fitting shoes.',
    ur: 'روزانہ اپنے پاؤں دیکھیں۔ ننگے پاؤں نہ چلیں اور نرم، آرام دہ جوتا پہنیں۔',
  },
  'advice.hypo_treatment': {
    en: 'If your sugar drops, take sugar, juice or glucose at once and then eat something.',
    ur: 'شوگر کم ہو جائے تو فوراً چینی، جوس یا گلوکوز لیں اور اس کے بعد کچھ کھا لیں۔',
  },
  'advice.inhaler_technique': {
    en: 'Use the inhaler as shown and rinse your mouth afterwards.',
    ur: 'انہیلر بتائے گئے طریقے سے استعمال کریں اور بعد میں منہ کی کلی کریں۔',
  },
  'advice.tb_adherence': {
    en: 'Take the TB medicines every single day, without a break, for the full duration.',
    ur: 'ٹی بی کی دوائیں روزانہ، بلا ناغہ، مکمل مدت تک لیں۔',
  },
  'advice.family_screening_tb': {
    en: 'All household members, especially children, should be checked.',
    ur: 'گھر کے تمام افراد، خاص طور پر بچوں کا معائنہ کروائیں۔',
  },
  'advice.fasting_before_test': {
    en: 'Fast for 8 to 10 hours before the test. You may drink plain water.',
    ur: 'ٹیسٹ سے پہلے آٹھ سے دس گھنٹے نہار منہ رہیں۔ سادہ پانی پی سکتے ہیں۔',
  },
  'advice.avoid_driving': {
    en: 'This medicine can cause drowsiness. Do not drive or operate machinery.',
    ur: 'اس دوا سے نیند یا غنودگی آ سکتی ہے۔ گاڑی یا مشین نہ چلائیں۔',
  },
  'advice.contraception_warning': {
    en: 'This medicine can harm an unborn baby. Use reliable contraception and tell the doctor if you may be pregnant.',
    ur: 'یہ دوا حمل میں بچے کے لیے نقصان دہ ہے۔ حمل سے بچاؤ کا مؤثر طریقہ اختیار کریں اور حمل کا شبہ ہو تو ڈاکٹر کو بتائیں۔',
  },
  'advice.rest_at_home': {
    en: 'Rest at home.',
    ur: 'گھر پر آرام کریں۔',
  },
  'advice.follow_up_in': {
    en: 'Come for review after {n} days.',
    ur: '{n} دن بعد دوبارہ دکھائیں۔',
  },
};

/**
 * Red flags (tier 2). These print under a single heading, so each line is
 * written as a CLAUSE that completes it, not as a standalone sentence:
 *
 *   EN heading: "Come back at once if:"
 *   UR heading: "فوراً واپس آئیں اگر:"
 */
export const medicineRedFlagStrings: Record<string, BilingualString> = {
  'redflag.heading': {
    en: 'Come back at once, or go to the nearest hospital, if:',
    ur: 'ان میں سے کوئی علامت ہو تو فوراً واپس آئیں یا قریبی ہسپتال جائیں:',
  },
  'redflag.chest_pain': {
    en: 'you get chest pain, heaviness or pain going into the arm or jaw',
    ur: 'سینے میں درد یا بھاری پن ہو، یا درد بازو یا جبڑے کی طرف جائے',
  },
  'redflag.breathless_at_rest': {
    en: 'you become short of breath at rest or cannot lie flat',
    ur: 'آرام کی حالت میں سانس پھولے یا سیدھا لیٹنے میں دشواری ہو',
  },
  'redflag.stroke_symptoms': {
    en: 'your face droops, an arm or leg becomes weak, or your speech becomes slurred',
    ur: 'چہرہ ایک طرف ڈھلک جائے، بازو یا ٹانگ میں کمزوری ہو، یا بولنے میں دشواری ہو',
  },
  'redflag.fainting': {
    en: 'you faint or lose consciousness',
    ur: 'غشی یا بے ہوشی ہو',
  },
  'redflag.severe_headache': {
    en: 'you get a sudden, very severe headache',
    ur: 'اچانک بہت شدید سر درد ہو',
  },
  'redflag.confusion': {
    en: 'you become confused or unusually drowsy',
    ur: 'الجھن ہو، بات سمجھ نہ آئے یا غیر معمولی نیند آئے',
  },
  'redflag.persistent_vomiting': {
    en: 'you keep vomiting and cannot keep anything down',
    ur: 'مسلسل الٹیاں ہوں اور کچھ بھی معدے میں نہ ٹھہرے',
  },
  'redflag.vomiting_blood': {
    en: 'you vomit blood or something like coffee grounds',
    ur: 'خون کی الٹی ہو یا الٹی کافی کے رنگ جیسی ہو',
  },
  'redflag.black_stools': {
    en: 'your stools become black or tarry, or there is blood in them',
    ur: 'پاخانہ کالا ہو جائے یا اس میں خون آئے',
  },
  'redflag.haemoptysis': {
    en: 'you cough up blood',
    ur: 'کھانسی یا بلغم کے ساتھ خون آئے',
  },
  'redflag.severe_abdominal_pain': {
    en: 'you get severe or continuous abdominal pain',
    ur: 'پیٹ میں شدید یا مسلسل درد ہو',
  },
  'redflag.reduced_urine': {
    en: 'you pass very little urine, or none for many hours',
    ur: 'پیشاب بہت کم آئے یا کئی گھنٹے بالکل نہ آئے',
  },
  'redflag.swelling_worsening': {
    en: 'swelling of the legs or abdomen increases, or your weight rises quickly',
    ur: 'ٹانگوں یا پیٹ کی سوجن بڑھ جائے، یا وزن تیزی سے بڑھے',
  },
  'redflag.calf_pain': {
    en: 'one calf becomes painful, swollen or hot',
    ur: 'ایک پنڈلی میں درد، سوجن یا گرمی محسوس ہو',
  },
  'redflag.hypoglycaemia': {
    en: 'you sweat, shake, feel faint or become confused from low sugar',
    ur: 'شوگر کم ہونے کی علامات ہوں: پسینہ، کپکپاہٹ، گھبراہٹ، چکر یا الجھن',
  },
  'redflag.hyperglycaemia': {
    en: 'you have excessive thirst, frequent urination, or become very drowsy',
    ur: 'بہت زیادہ پیاس لگے، بار بار پیشاب آئے، یا بہت زیادہ سستی ہو',
  },
  'redflag.foot_ulcer': {
    en: 'a wound, blister, swelling or colour change appears on your foot',
    ur: 'پاؤں پر زخم، چھالا، سوجن یا رنگ کی تبدیلی نظر آئے',
  },
  'redflag.visual_change': {
    en: 'your vision becomes blurred or suddenly reduces',
    ur: 'نظر دھندلی ہو جائے یا اچانک کم ہو جائے',
  },
  'redflag.fever_not_settling': {
    en: 'the fever does not settle after three days',
    ur: 'بخار تین دن کے بعد بھی نہ اترے',
  },
  'redflag.rash_after_medicine': {
    en: 'you develop a rash, itching, or swelling of the face or lips after taking the medicine',
    ur: 'دوا لینے کے بعد جسم پر دانے، خارش، یا چہرے یا ہونٹوں پر سوجن ہو',
  },
  'redflag.bleeding_on_blood_thinner': {
    en: 'you bleed from anywhere, or bruises appear without injury',
    ur: 'کہیں سے بھی خون بہے، یا بغیر چوٹ کے جسم پر نیل پڑ جائیں',
  },
  'redflag.sore_throat_on_carbimazole': {
    en: 'you develop a sore throat, mouth ulcers or fever — stop the medicine and get a blood count urgently',
    ur: 'گلا خراب ہو، منہ میں چھالے پڑیں یا بخار ہو تو دوا فوراً بند کر کے خون کا ٹیسٹ (CBC) کروائیں',
  },
};

/**
 * Sig templates adult medicine needs that the registry does not yet have.
 *
 * NOT wired up. These are here so that adding the templates is a paste, not a
 * translation project. Slot names match the existing convention:
 * {administer} {dose} {route} {frequency} {duration}. The pack sets
 * `administer` to take / لیں.
 *
 * sig.weekly deserves a specific note: the once-weekly methotrexate error kills
 * people. The template should not merely support a weekly frequency -- it
 * should refuse to render a daily one for a drug flagged weekly-only.
 */
export const proposedSigTemplateStrings: Record<string, BilingualString> = {
  'sig.sublingual': {
    en: 'Place {dose} under the tongue {frequency}. Sit down first.',
    ur: '{dose} زبان کے نیچے رکھیں، {frequency}۔ پہلے بیٹھ جائیں۔',
  },
  'sig.injection.sc': {
    en: 'Inject {dose} under the skin {frequency}. Change the injection site each time.',
    ur: '{dose} جلد کے نیچے ٹیکہ لگائیں، {frequency}۔ ہر بار جگہ بدلیں۔',
  },
  'sig.injection.im': {
    en: 'Injection {dose} into the muscle {frequency}.',
    ur: '{dose} کا ٹیکہ پٹھے میں لگوائیں، {frequency}۔',
  },
  'sig.nebulised': {
    en: 'Take {dose} by nebuliser {frequency}.',
    ur: '{dose} نیبولائزر کے ذریعے لیں، {frequency}۔',
  },
  'sig.tapering': {
    en: 'Take {dose} {frequency} for {duration}, then reduce as advised. Do not stop suddenly.',
    ur: '{dose} {frequency} {duration} تک لیں، پھر بتائے گئے طریقے سے کم کریں۔ اچانک بند نہ کریں۔',
  },
  'sig.weekly': {
    en: 'Take {dose} ONCE A WEEK on {day} only. Never take it daily.',
    ur: '{dose} ہفتے میں صرف ایک بار، {day} کے دن لیں۔ روزانہ ہرگز نہ لیں۔',
  },
  'sig.alternate_days': {
    en: 'Take {dose} every other day.',
    ur: '{dose} ایک دن چھوڑ کر ایک دن لیں۔',
  },
  'sig.titrated': {
    en: 'Take {dose} as advised, adjusted according to your readings.',
    ur: '{dose} بتائے گئے طریقے سے لیں، اپنی ریڈنگ کے مطابق کم یا زیادہ کریں۔',
  },
};

/**
 * The short button label for each sig template above -- the "Form of
 * instruction" picker in SigEditor.tsx renders one of these per id, and it
 * used to fall back to printing the raw id (`sig.injection.im`) when a pack
 * declared a template the component's own hardcoded label map didn't know
 * about. CLAUDE.md 6a: specialty content is never a hardcoded component
 * constant -- this is why these live here, pack-scoped, instead of a bigger
 * literal added to SigEditor.tsx's own TEMPLATE_LABELS.
 *
 * EN only, deliberately: this is doctor-facing picker UI, not printed
 * patient content -- it never needs a bidi/Urdu counterpart the way the
 * template SENTENCES above do.
 */
export const sigTemplateLabels: Record<string, string> = {
  'sig.sublingual': 'Sublingual',
  'sig.injection.sc': 'Injection (under the skin)',
  'sig.injection.im': 'Injection (into the muscle)',
  'sig.nebulised': 'Nebulised',
  'sig.tapering': 'Tapering course',
  'sig.weekly': 'Once weekly only',
  'sig.alternate_days': 'Alternate days',
  'sig.titrated': 'Titrated dose',
};

export const medicineStrings = {
  ...medicineAdviceStrings,
  ...medicineRedFlagStrings,
};

export default medicineStrings;
