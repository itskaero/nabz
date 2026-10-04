/**
 * Antibacterials, antifungals, antimalarials and antihelminthics.
 *
 * Every row here is `drafted` — see `draft.ts` for exactly what that claims and
 * what it does not. The numbers are ordinary paediatric practice, written to be
 * checked; the pack author signs each one against the monograph it names, and
 * nothing is offered as verified until they have.
 *
 * TWO THINGS THAT DECIDED THE SHAPE OF THESE ROWS.
 *
 * `mgPerKg` is PER DOSE, not per day. Most references quote a daily total and
 * then divide it; this schema stores what the prescriber writes on the script.
 * Where a source is usually remembered as a daily figure, the note says so, so
 * that a reviewer comparing the two is not comparing different things.
 *
 * A row is written for the ROUTE the pack's formulary actually stocks. A
 * beautiful intravenous row for a drug this clinic only has as a syrup is a row
 * that will be read in a hurry and acted on wrongly.
 */
import type { DosingEntry } from '@domain/pack.ts';
import { bnfc, draft, whoFormulary } from './draft.ts';

export const antimicrobialDosing: DosingEntry[] = [
  // --- penicillins ---------------------------------------------------------
  draft({
    generic: 'Amoxicillin + Clavulanic acid',
    indication: 'Otitis media, sinusitis, lower respiratory infection',
    route: 'oral',
    mgPerKg: 15,
    mgPerKgHigh: 22.5,
    perDoses: 2,
    maxMgPerDose: 875,
    maxPerDay: '1750 mg of the amoxicillin component in 24 hours',
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('co-amoxiclav'),
    note:
      'Doses are of the AMOXICILLIN component — 30–45 mg/kg/day in two doses. ' +
      'High-dose regimens (90 mg/kg/day) use the 7:1 or 14:1 syrups so the ' +
      'clavulanate stays under about 10 mg/kg/day; check which ratio the ' +
      'bottle is before doubling anything.',
  }),
  draft({
    generic: 'Ampicillin',
    indication: 'Susceptible bacterial infection',
    route: 'oral',
    mgPerKg: 12.5,
    mgPerKgHigh: 25,
    perDoses: 4,
    maxMgPerDose: 500,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('ampicillin'),
    note: 'Absorbed poorly with food — give an hour before or two hours after a feed.',
  }),
  draft({
    generic: 'Benzylpenicillin',
    indication: 'Severe bacterial infection',
    route: 'IV or IM',
    fixedDose: '50 000 units/kg per dose, 6-hourly',
    perDoses: 4,
    maxPerDay: '2.4 g (4 mega units) per dose in meningitis',
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('benzylpenicillin'),
    note:
      'Dosed in UNITS, which is why there is no mg/kg figure here: 1 mega unit ' +
      'is about 600 mg, and converting in your head is how a tenfold error ' +
      'happens. Neonates are dosed differently — see the neonatal section.',
  }),

  // --- cephalosporins ------------------------------------------------------
  draft({
    generic: 'Cefaclor',
    indication: 'Otitis media, pharyngitis, urinary infection',
    route: 'oral',
    mgPerKg: 10,
    perDoses: 3,
    maxMgPerDose: 500,
    maxMgPerDay: 1000,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('cefaclor'),
  }),
  draft({
    generic: 'Cefixime',
    indication: 'Urinary infection, otitis media, typhoid',
    route: 'oral',
    mgPerKg: 4,
    perDoses: 2,
    maxMgPerDay: 400,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: bnfc('cefixime'),
    note: '8 mg/kg/day. Typhoid courses usually run 7–14 days; check the local resistance pattern.',
  }),
  draft({
    generic: 'Ceftazidime',
    indication: 'Pseudomonas and other Gram-negative infection',
    route: 'IV',
    mgPerKg: 25,
    mgPerKgHigh: 50,
    perDoses: 3,
    maxMgPerDay: 6000,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('ceftazidime'),
    note: 'The top of the band is for severe infection and cystic fibrosis.',
  }),
  draft({
    generic: 'Ceftriaxone',
    indication: 'Severe bacterial infection',
    route: 'IV or IM',
    mgPerKg: 50,
    mgPerKgHigh: 80,
    perDoses: 1,
    maxMgPerDay: 4000,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('ceftriaxone'),
    note:
      'Once daily. Do NOT give with calcium-containing fluids in a neonate, ' +
      'and avoid it altogether in a jaundiced neonate.',
  }),
  draft({
    generic: 'Ceftriaxone',
    indication: 'Meningitis',
    route: 'IV',
    mgPerKg: 50,
    perDoses: 2,
    maxMgPerDay: 4000,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('ceftriaxone'),
    note: '100 mg/kg/day split 12-hourly. A separate row from the standard dose on purpose — the two are not interchangeable.',
  }),
  draft({
    generic: 'Cefuroxime',
    indication: 'Respiratory and urinary infection',
    route: 'oral',
    mgPerKg: 10,
    mgPerKgHigh: 15,
    perDoses: 2,
    maxMgPerDose: 500,
    ageBand: { fromDays: 90, label: 'over 3 months' },
    reference: bnfc('cefuroxime axetil'),
    note: 'Give with food — absorption is markedly better and the taste is easier.',
  }),
  draft({
    generic: 'Cephalexin',
    indication: 'Skin, soft-tissue and urinary infection',
    route: 'oral',
    mgPerKg: 12.5,
    mgPerKgHigh: 25,
    perDoses: 4,
    maxMgPerDay: 4000,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('cefalexin'),
    note: '25–100 mg/kg/day. Twice-daily dosing is acceptable for mild skin infection.',
  }),
  draft({
    generic: 'Cephradine',
    indication: 'Skin, soft-tissue and respiratory infection',
    route: 'oral',
    mgPerKg: 12.5,
    mgPerKgHigh: 25,
    perDoses: 4,
    maxMgPerDay: 4000,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('cefradine'),
  }),

  // --- macrolides ----------------------------------------------------------
  draft({
    generic: 'Azithromycin',
    indication: 'Respiratory infection, pertussis, typhoid',
    route: 'oral',
    mgPerKg: 10,
    perDoses: 1,
    maxMgPerDay: 500,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: bnfc('azithromycin'),
    note:
      'Once daily for 3 days, or 10 mg/kg on day 1 then 5 mg/kg on days 2–5. ' +
      'For pertussis it is first-line at any age, including under 6 months.',
  }),
  draft({
    generic: 'Clarithromycin',
    indication: 'Respiratory infection, penicillin allergy',
    route: 'oral',
    mgPerKg: 7.5,
    perDoses: 2,
    maxMgPerDose: 500,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('clarithromycin'),
    note: 'Interacts with a long list — check before adding it to a child already on something.',
  }),
  draft({
    generic: 'Erythromycin',
    indication: 'Respiratory infection, pertussis, penicillin allergy',
    route: 'oral',
    mgPerKg: 10,
    mgPerKgHigh: 12.5,
    perDoses: 4,
    maxMgPerDay: 2000,
    reference: bnfc('erythromycin'),
    note:
      'In the first six weeks of life it is associated with infantile ' +
      'hypertrophic pyloric stenosis — use it there only when the indication ' +
      'is strong, and warn the family what to watch for.',
  }),

  // --- aminoglycosides -----------------------------------------------------
  draft({
    generic: 'Gentamicin',
    indication: 'Severe Gram-negative infection',
    route: 'IV or IM',
    mgPerKg: 7.5,
    perDoses: 1,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('gentamicin'),
    note:
      'Once daily. Levels and renal function are not optional on anything ' +
      'beyond a short course, and neonatal dosing is by gestational age — do ' +
      'not read this row for a newborn.',
  }),
  draft({
    generic: 'Amikacin',
    indication: 'Gram-negative infection resistant to gentamicin',
    route: 'IV or IM',
    mgPerKg: 15,
    perDoses: 1,
    maxMgPerDay: 1500,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('amikacin'),
    note: 'Once daily, with levels. Same renal and auditory monitoring as gentamicin.',
  }),

  // --- quinolones ----------------------------------------------------------
  draft({
    generic: 'Ciprofloxacin',
    indication: 'Typhoid, complicated urinary infection, shigellosis',
    route: 'oral',
    mgPerKg: 10,
    mgPerKgHigh: 15,
    perDoses: 2,
    maxMgPerDose: 750,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('ciprofloxacin'),
    note:
      'Resistance in enteric fever is now widespread across South Asia — ' +
      'check the local pattern rather than reaching for this first. Avoid ' +
      'with dairy, antacids and iron, which block absorption.',
  }),
  draft({
    generic: 'Levofloxacin',
    indication: 'Resistant respiratory infection',
    route: 'oral',
    mgPerKg: 10,
    perDoses: 2,
    maxMgPerDay: 750,
    ageBand: { fromDays: 180, toDays: 1825, label: '6 months to under 5 years' },
    reference: bnfc('levofloxacin'),
    note: 'Younger children clear it faster, which is why this band is twice daily and the older one is once.',
  }),
  draft({
    generic: 'Levofloxacin',
    indication: 'Resistant respiratory infection',
    route: 'oral',
    mgPerKg: 10,
    perDoses: 1,
    maxMgPerDay: 750,
    ageBand: { fromDays: 1826, label: '5 years and over' },
    reference: bnfc('levofloxacin'),
  }),

  // --- tetracyclines -------------------------------------------------------
  draft({
    generic: 'Doxycycline',
    indication: 'Rickettsial infection, scrub typhus, atypical pneumonia',
    route: 'oral',
    mgPerKg: 2.2,
    perDoses: 2,
    maxMgPerDose: 100,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('doxycycline'),
    note:
      'The old blanket rule against doxycycline under 8 years does not apply ' +
      'to short courses: a course of 5–10 days does not stain teeth, and in ' +
      'suspected rickettsial disease it is the treatment that works. Longer ' +
      'or repeated courses are a different question.',
  }),

  // --- others --------------------------------------------------------------
  draft({
    generic: 'Metronidazole',
    indication: 'Anaerobic infection, giardiasis, amoebiasis',
    route: 'oral',
    mgPerKg: 7.5,
    perDoses: 3,
    maxMgPerDose: 400,
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: bnfc('metronidazole'),
    note:
      'Amoebic liver abscess and severe amoebic dysentery use a higher dose ' +
      'for a shorter course — look it up rather than scaling this one.',
  }),
  draft({
    generic: 'Sulfamethoxazole + Trimethoprim',
    indication: 'Urinary and respiratory infection',
    route: 'oral',
    mgPerKg: 4,
    perDoses: 2,
    maxMgPerDose: 160,
    ageBand: { fromDays: 42, label: 'over 6 weeks' },
    reference: bnfc('co-trimoxazole'),
    note:
      'The mg/kg figure is of the TRIMETHOPRIM component, which is how every ' +
      'reference quotes it and not how the bottle is labelled — 240 mg/5 ml ' +
      'syrup is 40 mg of trimethoprim in 5 ml. Pneumocystis treatment and ' +
      'HIV prophylaxis use different regimens entirely.',
  }),
  draft({
    generic: 'Nystatin',
    indication: 'Oral candidiasis',
    route: 'oral',
    fixedDose: '100 000 units (1 ml) four times a day, after feeds',
    perDoses: 4,
    reference: whoFormulary('nystatin'),
    note:
      'Dosed in units rather than milligrams. Paint it onto the lesions rather ' +
      'than swallowing it straight down, and carry on for 48 hours after the ' +
      'white patches clear.',
  }),

  // --- antimalarials -------------------------------------------------------
  draft({
    generic: 'Artemether + Lumefantrine',
    indication: 'Uncomplicated falciparum malaria',
    route: 'oral',
    fixedDose: '1 tablet (20/120 mg) twice daily for 3 days',
    perDoses: 2,
    weightBand: { fromKg: 5, toKg: 14.9 },
    reference: whoFormulary('artemether with lumefantrine'),
    note: 'Give with a fatty feed or milk — absorption of lumefantrine roughly doubles with it.',
  }),
  draft({
    generic: 'Artemether + Lumefantrine',
    indication: 'Uncomplicated falciparum malaria (15–24 kg)',
    route: 'oral',
    fixedDose: '2 tablets (40/240 mg) twice daily for 3 days',
    perDoses: 2,
    weightBand: { fromKg: 15, toKg: 24.9 },
    reference: whoFormulary('artemether with lumefantrine'),
  }),
  draft({
    generic: 'Artemether + Lumefantrine',
    indication: 'Uncomplicated falciparum malaria (25–34 kg)',
    route: 'oral',
    fixedDose: '3 tablets (60/360 mg) twice daily for 3 days',
    perDoses: 2,
    weightBand: { fromKg: 25, toKg: 34.9 },
    reference: whoFormulary('artemether with lumefantrine'),
  }),
  draft({
    generic: 'Artemether + Lumefantrine',
    indication: 'Uncomplicated falciparum malaria (35 kg and over)',
    route: 'oral',
    fixedDose: '4 tablets (80/480 mg) twice daily for 3 days',
    perDoses: 2,
    weightBand: { fromKg: 35 },
    reference: whoFormulary('artemether with lumefantrine'),
  }),
  draft({
    generic: 'Chloroquine',
    indication: 'Vivax malaria',
    route: 'oral',
    fixedDose: '10 mg/kg base on day 1 and day 2, then 5 mg/kg on day 3',
    maxPerDay: '620 mg base in a single dose',
    reference: whoFormulary('chloroquine'),
    note:
      'Written as a three-day course rather than a per-dose figure because the ' +
      'dose changes between days, and a single mg/kg number would be wrong on ' +
      'two of them. Not for falciparum: resistance makes it unreliable.',
  }),

  // --- antihelminthics and scabies ------------------------------------------
  draft({
    generic: 'Pyrantel pamoate',
    indication: 'Roundworm, pinworm, hookworm',
    route: 'oral',
    mgPerKg: 10,
    perDoses: 1,
    maxMgPerDose: 1000,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: whoFormulary('pyrantel'),
    note: 'Single dose. For pinworm, repeat in two weeks and treat the household together.',
  }),
  draft({
    generic: 'Permethrin',
    indication: 'Scabies',
    route: 'topical',
    fixedDose:
      'Apply 5% cream to the whole body from the neck down, wash off after 8–12 hours, repeat in 7 days',
    ageBand: { fromDays: 60, label: 'over 2 months' },
    reference: whoFormulary('permethrin'),
    note:
      'In infants and the elderly include the scalp, face and ears. Treat ' +
      'everyone in the house on the same day, or it comes straight back. Itch ' +
      'persisting for two weeks after treatment is normal and is not failure.',
  }),
];
