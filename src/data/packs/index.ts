/**
 * Content-pack registry.
 *
 * Two packs ship: paediatrics (verified) and medicine (an unverified draft --
 * see medicine.ts's own header). The registry exists so a THIRD pack is a
 * file plus one line here, never a refactor -- and, since Stage A, so is
 * SWITCHING between the two: `data/provider.ts` resolves whichever one the
 * doctor's profile names, from a library seeded with the entries below.
 */
import type { ContentPack, FormularyEntry } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { packs as shippedPhrases } from '../phrases/index.ts';
import { medicinePhrases } from '../phrases/medicine.ts';
import paediatrics from './paediatrics.ts';
import medicine from './medicine.ts';

export const contentPacks: Record<string, ContentPack> = {
  [paediatrics.id]: paediatrics,
  [medicine.id]: medicine,
};

/** Every shipped pack's own phrase registry -- what a pack pairs with. */
export const shippedPackPhrases: Record<string, PackRegistry> = {
  [paediatrics.id]: shippedPhrases,
  [medicine.id]: medicinePhrases,
};

export const DEFAULT_PACK_ID = paediatrics.id;

export function packById(id: string): ContentPack {
  return contentPacks[id] ?? paediatrics;
}

export function phrasesForShippedPack(id: string): PackRegistry {
  return shippedPackPhrases[id] ?? shippedPhrases;
}

/** True when `id` names a pack this build ships, rather than an imported one. */
export function isShippedPack(id: string): boolean {
  return id in contentPacks;
}

/** Look-ups the UI needs constantly; built once per pack rather than per render. */
export function packIndex(pack: ContentPack) {
  const systemLabel = new Map(pack.examSystems.map((s) => [s.id, s.label]));
  const findingLabel = new Map<string, string>();
  for (const [systemId, findings] of Object.entries(pack.findingsPalette)) {
    for (const f of findings) findingLabel.set(`${systemId}/${f.id}`, f.label);
  }
  const dosingByGeneric = new Map<string, typeof pack.dosing>();
  for (const row of pack.dosing) {
    const key = row.generic.toLowerCase();
    dosingByGeneric.set(key, [...(dosingByGeneric.get(key) ?? []), row]);
  }
  /*
    Every strength a generic is dispensed in, deduplicated.

    This is what makes the millilitre figure switchable rather than fixed:
    paracetamol ships as 100, 120, 200 and 250 mg per 5 ml in this catalogue,
    and 150 mg is 7 ml of the first and 3 ml of the third. Keyed by generic
    rather than by brand because the question a prescriber is answering is
    "which bottle did they bring", not "which brand did I type".

    `concentration` may be absent -- a tablet, a cream, a sachet -- and the
    entry is kept anyway so the strength can still be chosen and printed. What
    it cannot do is produce a volume, which `domain/dose.ts` refuses by itself.
  */
  const strengthsByGeneric = new Map<string, FormularyEntry[]>();
  for (const row of pack.formularySeed) {
    if (!row.strength) continue;
    const key = row.generic.toLowerCase();
    const list = strengthsByGeneric.get(key) ?? [];
    if (!list.some((e) => e.strength === row.strength)) list.push(row);
    strengthsByGeneric.set(key, list);
  }
  return { systemLabel, findingLabel, dosingByGeneric, strengthsByGeneric };
}

export { paediatrics, medicine };
