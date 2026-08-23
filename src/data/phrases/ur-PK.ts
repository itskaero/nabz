/**
 * Urdu (Pakistan) locale pack.
 *
 * READ THIS BEFORE EDITING.
 *
 * 1. These sentences are AUTHORED, not derived. Nothing here was produced by
 *    reordering the English. Look at the templates: the duration leads, the
 *    timing and frequency follow, the dose sits next to the verb, and the verb
 *    ends the sentence. That is Urdu word order, not English word order run
 *    backwards. If a future edit makes an Urdu template look like a mirror of
 *    its English twin, the edit is wrong (PRODUCT.md 7, CLAUDE.md 4).
 *
 * 2. Numerals stay Latin (`numerals: 'latn'`). Pakistani medicine boxes, syrup
 *    caps and pharmacy labels print 0-9, and the dose is the last place to
 *    introduce a glyph set the parent has to translate in their head. A doctor
 *    who wants Eastern Arabic-Indic digits flips this one field.
 *
 * 3. THE REGISTER STILL NEEDS A NATIVE CLINICAL REVIEW. These strings are
 *    plain patient-register Urdu, but PRODUCT.md 15 is explicit that the wedge
 *    dies on stilted Urdu, and that the validators are real patients and
 *    pharmacists rather than the person who wrote the code. Treat everything
 *    below as a first draft awaiting that pass.
 */
import type { LocalePack } from '@domain/phrases.ts';

export const urPK: LocalePack = {
  locale: 'ur-PK',
  dir: 'rtl',
  numerals: 'latn',

  templates: {
    // duration -> timing -> frequency -> dose -> verb
    'sig.oral.liquid': '[{duration} تک ][{timing} ]{frequency} {dose} {administer}',
    'sig.oral.solid': '[{duration} تک ][{timing} ]{frequency} {dose} {administer}',
    'sig.oral.sachet':
      '[{duration} تک ][{timing} ]{frequency} {dose} پانی میں حل کر کے {administer}',
    'sig.topical': '[{duration} تک ]{frequency} متاثرہ جگہ پر پتلی تہہ {administer}',
    'sig.drops.eye': '[{duration} تک ]{frequency} ہر آنکھ میں {dose} {administer}',
    'sig.drops.ear': '[{duration} تک ]{frequency} متاثرہ کان میں {dose} {administer}',
    'sig.drops.nasal': '[{duration} تک ]{frequency} ہر نتھنے میں {dose} {administer}',
    'sig.inhaled': '[{duration} تک ]{frequency} انہیلر سے {dose} {administer}',
    'sig.prn':
      'ضرورت کے وقت {dose} {administer}[، {frequency}][، چوبیس گھنٹوں میں زیادہ سے زیادہ {max}]',
    'sig.stat': 'ابھی ایک بار {dose} {administer}',
  },

  vocab: {
    administer: {
      give: 'دیں',
      take: 'لیں',
      apply: 'لگائیں',
      instil: 'ڈالیں',
      inhale: 'سانس کے ذریعے لیں',
    },
    frequency: {
      OD: 'دن میں ایک بار',
      BID: 'دن میں دو بار',
      TID: 'دن میں تین بار',
      QID: 'دن میں چار بار',
      Q4H: 'ہر چار گھنٹے بعد',
      Q6H: 'ہر چھ گھنٹے بعد',
      Q8H: 'ہر آٹھ گھنٹے بعد',
      Q12H: 'ہر بارہ گھنٹے بعد',
      HS: 'رات کو سونے سے پہلے',
      PRN: 'ضرورت کے وقت',
      ALT: 'ایک دن چھوڑ کر',
      WEEKLY: 'ہفتے میں ایک بار',
    },
    timing: {
      after_food: 'کھانے کے بعد',
      before_food: 'کھانے سے پہلے',
      with_food: 'کھانے کے ساتھ',
      empty_stomach: 'خالی پیٹ',
      with_milk: 'دودھ کے ساتھ',
      morning: 'صبح',
      evening: 'شام',
      at_bedtime: 'سوتے وقت',
    },
    route: {
      oral: 'منہ کے ذریعے',
      topical: 'جلد پر',
      eye: 'آنکھ میں',
      ear: 'کان میں',
      nasal: 'ناک میں',
      inhaled: 'سانس کے ذریعے',
      rectal: 'مقعد کے ذریعے',
    },
    form: {
      syrup: 'شربت',
      suspension: 'شربت',
      tablet: 'گولی',
      capsule: 'کیپسول',
      drops: 'قطرے',
      cream: 'کریم',
      ointment: 'مرہم',
      injection: 'ٹیکہ',
      sachet: 'ساشہ',
      inhaler: 'انہیلر',
      suppository: 'سپوزٹری',
      solution: 'محلول',
    },
  },

  /**
   * Urdu selects the same plural CATEGORIES as English, but the strings are not
   * the same shape: دن (day) does not inflect, گولی -> گولیاں does. That is why
   * the category rule is code and the forms are data.
   */
  units: {
    ml: { one: 'ملی لیٹر', other: 'ملی لیٹر' },
    tsp: { one: 'چائے کا چمچ', other: 'چائے کے چمچ' },
    mg: { one: 'ملی گرام', other: 'ملی گرام' },
    g: { one: 'گرام', other: 'گرام' },
    tablet: { one: 'گولی', other: 'گولیاں' },
    capsule: { one: 'کیپسول', other: 'کیپسول' },
    drop: { one: 'قطرہ', other: 'قطرے' },
    puff: { one: 'پف', other: 'پف' },
    sachet: { one: 'ساشہ', other: 'ساشے' },
    dose: { one: 'خوراک', other: 'خوراکیں' },
    application: { one: 'بار', other: 'بار' },
    day: { one: 'دن', other: 'دن' },
    week: { one: 'ہفتہ', other: 'ہفتے' },
    month: { one: 'مہینہ', other: 'مہینے' },
  },

  advice: {
    tier1: {
      'advice.complete_course':
        'دوا کا پورا کورس مکمل کریں، چاہے بچہ بہتر لگنے لگے',
      'advice.return_if_fever_persists': 'اگر بخار {n} دن سے زیادہ رہے تو دوبارہ دکھائیں',
      'advice.follow_up_in': '{n} دن بعد دوبارہ دکھائیں',
      'advice.increase_fluids': 'زیادہ مقدار میں پانی، دودھ یا او آر ایس دیں',
      'advice.ors_after_each_stool': 'ہر پتلے پاخانے کے بعد او آر ایس دیں',
      'advice.continue_feeding': 'معمول کی خوراک اور ماں کا دودھ جاری رکھیں',
      'advice.rest_at_home': 'بچے کو {n} دن گھر پر آرام کرائیں',
      'advice.sponge_for_fever': 'بخار تیز ہو تو نیم گرم پانی سے جسم پونچھیں',
      'advice.no_other_medicine': 'ڈاکٹر سے پوچھے بغیر کوئی اور دوا نہ دیں',
      'advice.avoid_smoke': 'بچے کو دھوئیں اور گرد سے دور رکھیں',
      'advice.hand_washing': 'بچے کو کھانا دینے سے پہلے ہاتھ دھوئیں',
      'advice.next_vaccine': 'اگلا ٹیکہ {n} دن بعد لگوائیں',
      'advice.bring_for_weighing': 'اگلی بار بچے کا وزن کروانے کے لیے ضرور لائیں',
      'advice.zinc_days': '{n} دن تک روزانہ ایک بار زنک دیں',
    },
    tier2: {
      'redflag.not_feeding': 'اگر بچہ دودھ یا پانی پینا چھوڑ دے تو فوراً واپس لائیں',
      'redflag.drowsy': 'اگر بچہ سست ہو جائے یا مشکل سے جاگے تو فوراً واپس لائیں',
      'redflag.breathing': 'اگر سانس تیز یا مشکل ہو جائے تو فوراً واپس لائیں',
      'redflag.convulsion': 'اگر بچے کو دورہ پڑے تو فوراً واپس لائیں',
      'redflag.vomits_everything': 'اگر بچہ ہر چیز الٹی کر دے تو فوراً واپس لائیں',
      'redflag.blood_in_stool': 'اگر پاخانے میں خون آئے تو فوراً واپس لائیں',
      'redflag.dehydration':
        'اگر آنکھیں اندر دھنس جائیں یا پیشاب بہت کم آئے تو فوراً واپس لائیں',
      'redflag.fever_not_settling': 'اگر دوا سے بخار نہ اترے تو فوراً واپس لائیں',
      'redflag.non_blanching_rash':
        'اگر ایسے دانے نکلیں جو دبانے سے ہلکے نہ ہوں تو فوراً واپس لائیں',
      'redflag.cold_hands': 'اگر ہاتھ پاؤں ٹھنڈے اور پیلے پڑ جائیں تو فوراً واپس لائیں',
    },
  },

  strings: {
    'patient.line': '{name}: {instruction}',
    'section.problems': 'شکایات',
    'section.examination': 'معائنہ',
    'section.diagnosis': 'تشخیص',
    'section.labs': 'تجویز کردہ ٹیسٹ',
    'section.medications': 'ادویات',
    'section.advice': 'ہدایات',
    'section.patientInstructions': 'مریض کے لیے ہدایات',
    'label.patient': 'مریض',
    'label.age': 'عمر',
    'label.sex': 'جنس',
    'label.weight': 'وزن',
    'label.height': 'قد',
    'label.date': 'تاریخ',
    'label.allergies': 'الرجی',
    'label.noAllergies': 'کوئی معلوم الرجی نہیں',
    'label.signature': 'دستخط',
    'label.followUp': 'دوبارہ ملاقات',
    'label.redFlag': 'فوراً واپس لائیں اگر',
    'label.page': 'صفحہ {n} از {total}',
    'label.registration': 'رجسٹریشن نمبر',
    'notice.notVetted': 'ڈاکٹر کے اپنے الفاظ — جیسے لکھے گئے ویسے ہی',
    'notice.notPrescription': 'یہ نسخہ نیچے دستخط کے ساتھ ہی معتبر ہے۔',
  },
};

export default urPK;
