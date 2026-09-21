/**
 * WHO 2023 wasting criteria, as an addon.
 *
 * THIS FILE IS THE PROOF THE ENVELOPE WORKS.
 *
 * The shipped paediatric pack follows Pakistan's national programme, which
 * admits on MUAC or bilateral pitting oedema alone. A clinic working to the
 * global guideline instead -- an NGO programme, a teaching hospital, a
 * research site -- needs weight-for-height in the case definition too.
 *
 * Under the old arrangement that was a code change and a release. Here it is a
 * file: it names a module the build already has tested code for, replaces one
 * `moduleConfig` block, and changes who gets classified. Nothing executable
 * crosses the boundary, and `installAddon` warns that it is replacing a
 * protocol rather than doing it quietly.
 *
 * Shipped unsigned on purpose. Signing it here would mean putting a private
 * key in the repository, which would teach exactly the wrong lesson about what
 * a signature is worth. A clinic's own society signs the copy it distributes.
 */
import type { Addon } from '@domain/addon.ts';

export const whoWasting2023: Addon = {
  schema: 1,
  manifest: {
    id: 'who-wasting-2023',
    title: 'WHO 2023 wasting criteria',
    version: '1.0.0',
    author: {
      name: 'Nabz',
      credential: 'transcribed from the published guideline, not clinically reviewed',
      updated: '2026-09-20',
    },
    summary:
      'Classify acute malnutrition on weight-for-height as well as MUAC and oedema, following the WHO 2023 guideline instead of the national MUAC-only protocol.',
    appliesTo: ['paediatrics'],
  },
  contributes: {
    modules: ['malnutrition'],
    moduleConfig: {
      malnutrition: {
        // The difference that matters: 'whz' is in the list.
        criteria: ['oedema', 'whz', 'muac'],
        muacSevereMm: 115,
        muacModerateMm: 125,
        whzSevere: -3,
        whzModerate: -2,
        reference:
          'WHO guideline on the prevention and management of wasting and nutritional oedema (acute malnutrition) in infants and children under 5 years, 2023',
      },
    },
  },
};
