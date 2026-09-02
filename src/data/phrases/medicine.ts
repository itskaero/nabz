/**
 * The medicine pack's own, SELF-CONTAINED locale registry.
 *
 * `MEDICINE_PACK_NOTES.md` described the actual defect this file fixes:
 * installing the medicine pack meant hand-merging 52 ids across two locales
 * into `en.ts` and `ur-PK.ts` -- editing the SHARED files every other pack
 * also reads from. This composes a full `PackRegistry` for the medicine pack
 * instead, once, here: base `en`/`ur-PK` overlaid with the medicine-specific
 * advice, red flags and sig templates authored in `medicine.strings.ts`.
 * `en.ts` and `ur-PK.ts` are never touched.
 *
 * This is what "a pack is self-contained" means structurally: `medicine`
 * pairs with `medicinePhrases` the same way `paediatrics` pairs with the
 * shipped `packs` registry, and switching which one is active is choosing
 * which whole `{pack, phrases}` pair drives the app -- nothing is merged into
 * a shared object that a later switch would need to unwind.
 */
import type { LocalePack, PackRegistry } from '@domain/phrases.ts';
import { en } from './en.ts';
import { urPK } from './ur-PK.ts';
import {
  medicineAdviceStrings,
  medicineRedFlagStrings,
  proposedSigTemplateStrings,
  sigTemplateLabels,
} from './medicine.strings.ts';
import type { BilingualString } from './medicine.strings.ts';

function overlay(
  base: LocalePack,
  key: 'en' | 'ur',
  advice: Record<string, BilingualString>,
  redFlags: Record<string, BilingualString>,
  sigTemplates: Record<string, BilingualString>,
): LocalePack {
  const tier1: Record<string, string> = { ...base.advice.tier1 };
  for (const [id, s] of Object.entries(advice)) tier1[id] = s[key];

  const tier2: Record<string, string> = { ...base.advice.tier2 };
  const strings: Record<string, string> = { ...base.strings };
  for (const [id, s] of Object.entries(redFlags)) {
    // 'redflag.heading' is not a tier-2 item id (medicine.ts's advicePacks
    // never lists it) -- it is a section heading, so it belongs in `strings`.
    if (id === 'redflag.heading') strings[id] = s[key];
    else tier2[id] = s[key];
  }

  const templates: Record<string, string> = { ...base.templates };
  for (const [id, s] of Object.entries(sigTemplates)) templates[id] = s[key];

  // The picker labels for those same templates -- EN-only UI text, so they
  // merge just once (on the 'en' pass) rather than per-locale like everything
  // above. See sigTemplateLabels' own doc comment in medicine.strings.ts.
  if (key === 'en') {
    for (const [id, label] of Object.entries(sigTemplateLabels)) strings[id] = label;
  }

  return { ...base, templates, advice: { tier1, tier2 }, strings };
}

export const medicinePhrases: PackRegistry = {
  en: overlay(en, 'en', medicineAdviceStrings, medicineRedFlagStrings, proposedSigTemplateStrings),
  'ur-PK': overlay(
    urPK,
    'ur',
    medicineAdviceStrings,
    medicineRedFlagStrings,
    proposedSigTemplateStrings,
  ),
};

export default medicinePhrases;
