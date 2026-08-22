/**
 * Content-pack registry.
 *
 * v1 ships one pack. The registry exists anyway, because the point of the seam
 * is that a second pack is a file, not a refactor.
 */
import type { ContentPack } from '@domain/pack.ts';
import paediatrics from './paediatrics.ts';

export const contentPacks: Record<string, ContentPack> = {
  [paediatrics.id]: paediatrics,
};

export const DEFAULT_PACK_ID = paediatrics.id;

export function packById(id: string): ContentPack {
  return contentPacks[id] ?? paediatrics;
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

export { paediatrics };
