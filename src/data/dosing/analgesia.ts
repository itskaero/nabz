/**
 * The rest of the analgesia and anti-inflammatory list.
 *
 * Paracetamol and ibuprofen live in `who.ts` — they were transcribed from open
 * WHO guidance and keep that provenance. These are `drafted`.
 */
import type { DosingEntry } from '@domain/pack.ts';
import { bnfc, draft } from './draft.ts';

export const analgesiaDosing: DosingEntry[] = [
  draft({
    generic: 'Mefenamic acid',
    indication: 'Pain, dysmenorrhoea',
    route: 'oral',
    mgPerKg: 6.5,
    perDoses: 3,
    maxMgPerDose: 500,
    ageBand: { fromDays: 180, label: '6 months and over' },
    reference: bnfc('mefenamic acid'),
    note:
      'With food. It has no advantage over ibuprofen for ordinary pain or ' +
      'fever, and overdose causes convulsions at doses that would be survivable ' +
      'with other NSAIDs — which is worth weighing before putting a bottle in ' +
      'a house with a toddler in it.',
  }),
  draft({
    generic: 'Naproxen sodium',
    indication: 'Inflammatory pain, juvenile idiopathic arthritis',
    route: 'oral',
    mgPerKg: 5,
    perDoses: 2,
    maxMgPerDay: 1000,
    ageBand: { fromDays: 730, label: '2 years and over' },
    reference: bnfc('naproxen'),
    note: 'With food. Twice-daily dosing is its advantage over ibuprofen in a long-term inflammatory condition.',
  }),
];
