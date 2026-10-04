/**
 * The rows TRANSCRIBED from open WHO guidance.
 *
 * Kept in a file of their own because their provenance is different from
 * everything else in `src/data/dosing/`: somebody opened the cited chapter and
 * copied the number out of it. Every other file here is marked `drafted` --
 * written from ordinary practice for a clinician to check -- and mixing the
 * two in one list would make the distinction a comment rather than a fact.
 *
 * ============================ READ BEFORE USE ============================
 * WHAT THIS FILE IS: a deliberately tiny starter set drawn only from WHO's
 * OPENLY LICENSED paediatric references -- the exception PRODUCT.md 11a names.
 * Nothing here comes from BNFC, Nelson, Harriet Lane, Lexicomp or Micromedex.
 * Those are consult-and-cite: a clinician reads the reference, authors the
 * entry in their own words, and stores the citation. Bulk-copying their tables
 * is a licensing violation and this file must never become that.
 *
 * WHY EVERY ROW IS `verified: false`: PRODUCT.md 11a says each dose is
 * "authored/verified by a clinician". Nobody has done that for these rows yet.
 * They are transcribed from open WHO guidance to give the cited-suggestion UI
 * something real to show and to prove the citation pipeline end to end. The UI
 * labels them as unverified and the doctor confirms every value regardless
 * (rule 3.2), but they are NOT a substitute for the pack author working through
 * their own references and flipping `verified` to true row by row.
 *
 * WHAT THE VALIDATOR ENFORCES: `reference` must be non-empty on every row, or
 * the pack fails to build. A dose without a citation cannot ship.
 * ========================================================================
 */
import type { DosingEntry } from '@domain/pack.ts';

const WHO_POCKET_BOOK =
  'WHO Pocket Book of Hospital Care for Children, 2nd ed. (2013)';
const WHO_DIARRHOEA =
  'WHO/UNICEF Joint Statement: Clinical Management of Acute Diarrhoea (2004); WHO Pocket Book of Hospital Care for Children, 2nd ed. (2013), ch. 5';
const WHO_DEWORMING =
  'WHO Guideline: Preventive chemotherapy to control soil-transmitted helminth infections (2017)';

export const whoDosing: DosingEntry[] = [
  {
    generic: 'Paracetamol',
    indication: 'Fever or pain',
    route: 'oral',
    /*
      The band, not its top.

      This row said `mgPerKg: 15` and carried "10-15 mg/kg per dose" in the
      note, because a single number was all the schema could hold. The band is
      what the source gives and what a prescriber picks inside -- 10 kg is
      100-150 mg, which is 3 ml of 200 mg/5 ml or 7 ml of 100 mg/5 ml.
    */
    mgPerKg: 10,
    mgPerKgHigh: 15,
    perDoses: 4,
    maxPerDay: '4 doses in 24 hours',
    ageBand: { fromDays: 30, label: 'over 1 month' },
    reference: `${WHO_POCKET_BOOK}, Annex 2 (drug dosages), paracetamol`,
    verified: false,
    note: '10-15 mg/kg per dose, 6-hourly. Confirm the concentration of the syrup on the bottle before converting to ml.',
  },
  {
    generic: 'Ibuprofen',
    indication: 'Fever or pain',
    route: 'oral',
    mgPerKg: 5,
    mgPerKgHigh: 10,
    perDoses: 3,
    maxPerDay: '40 mg/kg in 24 hours',
    // The one ceiling in this file that states a number rather than a
    // frequency, so it is the one the arithmetic can apply. The rest stay
    // prose for the prescriber to read -- see `maxPerDay` in domain/pack.ts.
    maxMgPerKgPerDay: 40,
    ageBand: { fromDays: 90, label: 'over 3 months' },
    reference: `${WHO_POCKET_BOOK}, Annex 2 (drug dosages), ibuprofen`,
    verified: false,
    note: '5-10 mg/kg per dose, 6- to 8-hourly, with food. Avoid in dehydration.',
  },
  {
    generic: 'Amoxicillin',
    indication: 'Pneumonia (fast breathing / chest indrawing)',
    route: 'oral',
    mgPerKg: 40,
    perDoses: 2,
    reference: `${WHO_POCKET_BOOK}, ch. 4 (cough or difficulty in breathing), oral amoxicillin`,
    verified: false,
    note: '40 mg/kg per dose twice daily for pneumonia. Other indications use different mg/kg - check the indication before accepting this.',
  },
  {
    generic: 'Zinc sulphate',
    indication: 'Acute diarrhoea',
    route: 'oral',
    ageBand: { fromDays: 0, toDays: 182, label: 'under 6 months' },
    maxPerDay: '10 mg once daily for 10-14 days',
    reference: WHO_DIARRHOEA,
    verified: false,
  },
  {
    generic: 'Zinc sulphate',
    indication: 'Acute diarrhoea',
    route: 'oral',
    ageBand: { fromDays: 183, label: '6 months and over' },
    maxPerDay: '20 mg once daily for 10-14 days',
    reference: WHO_DIARRHOEA,
    verified: false,
  },
  {
    generic: 'Oral rehydration salts',
    indication: 'Diarrhoea, no dehydration (Plan A)',
    route: 'oral',
    ageBand: { fromDays: 0, toDays: 730, label: 'under 2 years' },
    maxPerDay: '50-100 ml after each loose stool',
    reference: `${WHO_POCKET_BOOK}, ch. 5 (diarrhoea), Plan A`,
    verified: false,
    note: 'Low-osmolarity formula. Plan B and Plan C use weight-based volumes - see the source.',
  },
  {
    generic: 'Oral rehydration salts',
    indication: 'Diarrhoea, no dehydration (Plan A)',
    route: 'oral',
    ageBand: { fromDays: 731, label: '2 years and over' },
    maxPerDay: '100-200 ml after each loose stool',
    reference: `${WHO_POCKET_BOOK}, ch. 5 (diarrhoea), Plan A`,
    verified: false,
  },
  {
    generic: 'Albendazole',
    indication: 'Soil-transmitted helminth infection',
    route: 'oral',
    ageBand: { fromDays: 365, toDays: 730, label: '12-23 months' },
    maxPerDay: '200 mg as a single dose',
    reference: WHO_DEWORMING,
    verified: false,
  },
  {
    generic: 'Albendazole',
    indication: 'Soil-transmitted helminth infection',
    route: 'oral',
    ageBand: { fromDays: 731, label: '24 months and over' },
    maxPerDay: '400 mg as a single dose',
    reference: WHO_DEWORMING,
    verified: false,
  },
  {
    generic: 'Mebendazole',
    indication: 'Soil-transmitted helminth infection',
    route: 'oral',
    ageBand: { fromDays: 365, label: '12 months and over' },
    maxPerDay: '500 mg as a single dose, or 100 mg twice daily for 3 days',
    reference: WHO_DEWORMING,
    verified: false,
  },
];
