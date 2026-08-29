/**
 * Content-pack registry.
 *
 * Two packs ship: paediatrics (verified) and medicine (an unverified draft --
 * see medicine.ts's own header). The registry exists so a THIRD pack is a
 * file plus one line here, never a refactor -- and, since Stage A, so is
 * SWITCHING between the two: `data/provider.ts` resolves whichever one the
 * doctor's profile names, from a library seeded with the entries below.
 */
import type { ContentPack } from '@domain/pack.ts';
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
  return { systemLabel, findingLabel, dosingByGeneric };
}

export { paediatrics, medicine };
