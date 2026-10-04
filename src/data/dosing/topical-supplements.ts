/**
 * Creams, drops, nose sprays, and the vitamins and minerals.
 *
 * All `drafted` — see `draft.ts`.
 *
 * WHY THESE ROWS LOOK DIFFERENT FROM THE REST. None of them is dosed in
 * milligrams per kilogram, and forcing them into that shape would be a lie the
 * calculator would then act on. A cream is "how thinly, how often, for how
 * long"; a drop is "how many, which eye"; a steroid cream's danger is POTENCY
 * and SITE, not milligrams. So every row here is a `fixedDose`, which the
 * schema has always allowed, and the millilitre calculator correctly offers
 * nothing for any of them.
 *
 * The topical steroids carry their potency class in the note, because that is
 * the fact that decides whether a cream is safe on a baby's face — and it is
 * the one a brand name hides.
 */
import type { DosingEntry } from '@domain/pack.ts';
import { bnfc, draft, whoFormulary } from './draft.ts';

export const topicalSupplementDosing: DosingEntry[] = [
  // --- topical steroids, weakest first -------------------------------------
  draft({
    generic: 'Betamethasone valerate',
    indication: 'Eczema flare (potent steroid)',
    route: 'topical',
    fixedDose: 'Apply thinly once or twice daily for up to 7 days, then step down',
    reference: bnfc('betamethasone valerate'),
    note:
      'POTENT. Not on the face, the eyelids, the napkin area or any flexure ' +
      'in a young child except on specialist advice. A fingertip unit covers ' +
      'two adult palms — most families use far less than prescribed and then ' +
      'blame the cream.',
  }),
  draft({
    generic: 'Mometasone furoate',
    indication: 'Eczema flare (potent steroid)',
    route: 'topical',
    fixedDose: 'Apply thinly once daily for up to 7 days, then step down',
    ageBand: { fromDays: 730, label: '2 years and over' },
    reference: bnfc('mometasone furoate'),
    note: 'POTENT, once daily. Same site restrictions as betamethasone valerate.',
  }),
  draft({
    generic: 'Clobetasol propionate',
    indication: 'Severe resistant eczema or psoriasis (very potent steroid)',
    route: 'topical',
    fixedDose: 'Apply thinly once or twice daily for up to 7 days, on specialist advice',
    reference: bnfc('clobetasol propionate'),
    note:
      'VERY POTENT — the strongest class there is. In a child it is a ' +
      'specialist decision, for a defined short course, never on the face or ' +
      'flexures, and never as a repeat prescription nobody is reviewing. ' +
      'Systemic absorption and adrenal suppression are real at this potency.',
  }),
  draft({
    generic: 'Clotrimazole + Fluocinolone',
    indication: 'Fungal skin infection',
    route: 'topical',
    fixedDose: 'No dose offered — see the note',
    reference: bnfc('antifungals, topical'),
    note:
      'A steroid-plus-antifungal combination is the wrong treatment for a ' +
      'fungal rash: the steroid suppresses the inflammation, the rash looks ' +
      'better, the fungus spreads, and "tinea incognito" is what comes back. ' +
      'Prescribe plain clotrimazole. The row is here so the reason is visible ' +
      'rather than the drug merely being absent.',
  }),

  // --- topical antimicrobials and antifungals ------------------------------
  draft({
    generic: 'Clotrimazole',
    indication: 'Tinea, candidal nappy rash',
    route: 'topical',
    fixedDose: 'Apply 1% cream two or three times daily, and for 14 days after the rash clears',
    reference: whoFormulary('clotrimazole'),
    note: 'Stopping when it looks better is the commonest reason tinea recurs.',
  }),
  draft({
    generic: 'Miconazole',
    indication: 'Tinea, candidal nappy rash',
    route: 'topical',
    fixedDose: 'Apply 2% cream twice daily, and for 10 days after the rash clears',
    reference: bnfc('miconazole'),
  }),
  draft({
    generic: 'Ketoconazole',
    indication: 'Seborrhoeic dermatitis, pityriasis versicolor',
    route: 'topical',
    fixedDose: 'Apply or lather the 2% shampoo, leave 3–5 minutes, twice weekly for 2–4 weeks',
    reference: bnfc('ketoconazole'),
  }),
  draft({
    generic: 'Fusidic acid',
    indication: 'Impetigo, localised skin infection',
    route: 'topical',
    fixedDose: 'Apply 2% cream three times daily for 5–7 days',
    reference: bnfc('fusidic acid'),
    note: 'Short courses only — resistance in Staphylococcus aureus tracks directly with how freely it is used.',
  }),
  draft({
    generic: 'Mupirocin',
    indication: 'Impetigo, nasal staphylococcal carriage',
    route: 'topical',
    fixedDose: 'Apply three times daily for 5–7 days',
    reference: bnfc('mupirocin'),
    note: 'Keep it for impetigo and MRSA decolonisation rather than using it as a general antiseptic.',
  }),
  draft({
    generic: 'Polymyxin B + Bacitracin',
    indication: 'Superficial skin infection',
    route: 'topical',
    fixedDose: 'Apply two or three times daily for up to 7 days',
    reference: bnfc('antibacterials, topical'),
    note: 'Bacitracin is a recognised cause of contact allergy and, rarely, of anaphylaxis applied to broken skin.',
  }),
  draft({
    generic: 'Calamine',
    indication: 'Itch, chickenpox, insect bites',
    route: 'topical',
    fixedDose: 'Apply to the itchy areas as often as needed',
    reference: bnfc('calamine'),
    note: 'Soothing and harmless. It does not treat anything, which is worth saying when a family expects it to.',
  }),

  // --- eye and ear drops ---------------------------------------------------
  draft({
    generic: 'Chloramphenicol',
    indication: 'Bacterial conjunctivitis',
    route: 'eye drops',
    fixedDose: '1 drop into the affected eye every 2 hours for 48 hours, then 4 times daily, for 5 days in all',
    reference: bnfc('chloramphenicol'),
    note: 'Most childhood conjunctivitis is viral and self-limiting. Any red eye with pain, photophobia or reduced vision is not this row.',
  }),
  draft({
    generic: 'Tobramycin',
    indication: 'Bacterial conjunctivitis',
    route: 'eye drops',
    fixedDose: '1 drop into the affected eye 4 times daily for up to 7 days',
    reference: bnfc('tobramycin'),
  }),
  draft({
    generic: 'Framycetin + Dexamethasone',
    indication: 'Otitis externa',
    route: 'ear drops',
    fixedDose: '2–3 drops into the affected ear three times daily for up to 7 days',
    reference: bnfc('ear, anti-infective preparations'),
    note:
      'Not with a perforated drum or grommets — aminoglycoside drops reaching ' +
      'the middle ear carry an ototoxicity risk. Look at the drum first.',
  }),
  draft({
    generic: 'Ciprofloxacin + Dexamethasone',
    indication: 'Otitis externa, acute otitis media with grommets',
    route: 'ear drops',
    fixedDose: '4 drops into the affected ear twice daily for 7 days',
    reference: bnfc('ciprofloxacin'),
    note: 'The quinolone drops are the ones that are safe with a perforation or grommets, which is their whole advantage.',
  }),
  draft({
    generic: 'Sodium chloride',
    indication: 'Nasal blockage in an infant',
    route: 'nasal drops',
    fixedDose: '1–2 drops of 0.9% into each nostril before feeds, as often as needed',
    reference: whoFormulary('sodium chloride'),
    note: 'The only nasal preparation that is safe in a baby. Saline and suction before a feed is the treatment for a blocked-nose infant, not a decongestant.',
  }),
  draft({
    generic: 'Oxymetazoline',
    indication: 'Nasal congestion',
    route: 'nasal drops',
    fixedDose: '1–2 drops of 0.025% into each nostril twice daily for up to 5 days',
    ageBand: { fromDays: 2190, label: '6 years and over' },
    reference: bnfc('oxymetazoline'),
    note:
      'Five days at the most — longer causes rebound congestion that is worse ' +
      'than the original. Not in young children, where systemic absorption has ' +
      'caused bradycardia and collapse.',
  }),
  draft({
    generic: 'Xylometazoline',
    indication: 'Nasal congestion',
    route: 'nasal drops',
    fixedDose: '1–2 drops of 0.05% into each nostril two or three times daily for up to 5 days',
    ageBand: { fromDays: 2190, label: '6 years and over' },
    reference: bnfc('xylometazoline'),
    note: 'Same five-day ceiling and the same age restriction as oxymetazoline.',
  }),

  // --- vitamins and minerals -----------------------------------------------
  draft({
    generic: 'Cholecalciferol',
    indication: 'Vitamin D deficiency prevention',
    route: 'oral',
    fixedDose: '400 IU daily from birth through the first year, and through childhood where sunlight exposure is low',
    perDoses: 1,
    reference: whoFormulary('ergocalciferol/colecalciferol'),
    note:
      'TREATMENT of rickets is a different and much larger dose over 8–12 ' +
      'weeks, with calcium — do not treat deficiency at the prevention dose.',
  }),
  draft({
    generic: 'Folic acid',
    indication: 'Folate deficiency, haemolytic anaemia',
    route: 'oral',
    fixedDose: '500 micrograms/kg once daily (maximum 5 mg) in deficiency; 5 mg once daily in chronic haemolysis',
    perDoses: 1,
    reference: bnfc('folic acid'),
    note: 'Never alone in a megaloblastic anaemia until B12 deficiency has been excluded — folate alone can precipitate subacute combined degeneration.',
  }),
  draft({
    generic: 'Ferrous sulphate + Folic acid',
    indication: 'Iron deficiency anaemia',
    route: 'oral',
    fixedDose: '3–6 mg/kg/day of ELEMENTAL iron, in one or two doses, for 3 months after the haemoglobin normalises',
    reference: whoFormulary('ferrous salt'),
    note:
      'Dosed as elemental iron, which is about one fifth of the ferrous ' +
      'sulphate figure on the label — reading the label figure as elemental is ' +
      'a fivefold overdose. Give it with vitamin C or citrus, away from milk ' +
      'and tea. Black stools are expected; constipation is the usual reason ' +
      'families stop.',
  }),
  draft({
    generic: 'Iron + Vitamin B complex',
    indication: 'Iron deficiency anaemia',
    route: 'oral',
    fixedDose: '3–6 mg/kg/day of ELEMENTAL iron, in one or two doses',
    reference: whoFormulary('ferrous salt'),
    note: 'Same elemental-iron caution as the other iron preparations — check what the label is quoting before converting.',
  }),
  draft({
    generic: 'Iron + Zinc + B vitamins',
    indication: 'Iron deficiency anaemia with supplementation',
    route: 'oral',
    fixedDose: '3–6 mg/kg/day of ELEMENTAL iron, in one or two doses',
    reference: whoFormulary('ferrous salt'),
    note: 'Zinc and iron compete for absorption; where both are genuinely needed, separating them does better than a combined syrup.',
  }),
  draft({
    generic: 'Calcium + Vitamin D3',
    indication: 'Calcium and vitamin D supplementation',
    route: 'oral',
    fixedDose: '500 mg of elemental calcium daily, with 400 IU vitamin D, adjusted to intake and age',
    reference: bnfc('calcium supplements'),
    note: 'Dietary intake first. A child drinking milk rarely needs a calcium tablet.',
  }),
  draft({
    generic: 'Calcium carbonate + Vitamin D3',
    indication: 'Calcium and vitamin D supplementation',
    route: 'oral',
    fixedDose: '500 mg of elemental calcium daily, with 400 IU vitamin D, adjusted to intake and age',
    reference: bnfc('calcium supplements'),
  }),
  draft({
    generic: 'B-complex + Zinc',
    indication: 'Supplementation',
    route: 'oral',
    fixedDose: '1 tablet daily',
    reference: bnfc('vitamin B complex'),
    note:
      'No deficiency state is being treated here unless one has been shown. ' +
      'Zinc for acute diarrhoea is a separate, cited row with a real ' +
      'evidence base — this is not that.',
  }),
  draft({
    generic: 'Multivitamin',
    indication: 'Supplementation',
    route: 'oral',
    fixedDose: '5 ml (or 0.6 ml of the drops) once daily',
    reference: bnfc('vitamins, multivitamin preparations'),
    note:
      'Of use in a child whose diet is genuinely inadequate, and of none in a ' +
      'child who eats. Vitamins A and D accumulate, so do not stack a ' +
      'multivitamin on top of separate supplements without adding up what is ' +
      'in both.',
  }),
];
