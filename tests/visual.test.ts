/**
 * Rasterise the preview to PNG so the Nastaliq can actually be LOOKED at.
 *
 * Skipped unless NABZ_VISUAL_DIR is set. It exists because "the Urdu is
 * correct" is not something a string assertion can establish -- letters must
 * join, marks must sit on the right teeth, and the dose must land where the
 * sentence says it does. Everything else in the suite checks the pipeline; this
 * is how a human checks the result.
 *
 * Uses the SAME page model the PDF backend consumes, so what this renders is
 * what prints.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { packs } from '@data/phrases/index.ts';
import { paediatrics } from '@data/packs/index.ts';
import { appDefaults } from '@config/appDefaults.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import { loadFonts } from '@render/text/engine.ts';
import { buildDocument } from '@render/pdf/layout.ts';
import { pageToSvg } from '@render/pdf/svg.ts';
import type { Prescription } from '@domain/prescription.ts';

const outDir = process.env.NABZ_VISUAL_DIR;

describe.runIf(outDir)('visual check', () => {
  beforeAll(async () => {
    await loadFonts(async (file) => readFile(join(process.cwd(), 'public', 'fonts', file)));
  });

  it('renders the sheet to PNG', async () => {
    const { Resvg } = (await import('@resvg/resvg-js')) as typeof import('@resvg/resvg-js');
    await mkdir(outDir!, { recursive: true });

    const rx: Prescription = {
      id: 'visual',
      createdAt: '2026-08-21T09:00:00.000Z',
      date: '2026-08-21',
      patient: {
        name: 'Ayesha Khan',
        age: '3 y 2 m',
        sex: 'F',
        weightKg: 13.5,
        allergies: 'Penicillin — rash as an infant',
      },
      problems: ['Fever for 3 days', 'Cough, worse at night'],
      examination: [
        {
          system: 'respiratory',
          findings: [
            { id: 'tachypnoea', label: 'tachypnoea', state: 'present', value: '46/min' },
            { id: 'crepitations', label: 'crepitations', state: 'present', value: 'right base' },
            { id: 'wheeze', label: 'wheeze', state: 'absent' },
          ],
        },
      ],
      diagnosis: ['Community-acquired pneumonia, right lower lobe'],
      medications: [
        {
          id: 'm1',
          drug: { brand: 'Klaricid', generic: 'Clarithromycin', strength: '125mg/5ml', form: 'syrup' },
          sig: {
            templateId: 'sig.oral.liquid',
            dose: { value: 5, unit: 'ml' },
            frequency: 'BID',
            timing: 'after_food',
            duration: { value: 7, unit: 'day' },
            slots: { administer: 'give' },
          },
        },
        {
          id: 'm2',
          drug: { brand: 'Calpol', generic: 'Paracetamol', strength: '120mg/5ml', form: 'syrup' },
          sig: {
            templateId: 'sig.prn',
            dose: { value: 7.5, unit: 'ml' },
            frequency: 'Q6H',
            max: { value: 4, unit: 'dose' },
            slots: { administer: 'give' },
          },
          citedSuggestion: {
            text: '10-15 mg/kg per dose, 6-hourly',
            reference: 'WHO Pocket Book of Hospital Care for Children, 2nd ed., Annex 2',
          },
        },
      ],
      advice: [
        { kind: 1, id: 'a1', templateId: 'advice.complete_course', slots: {} },
        { kind: 1, id: 'a2', templateId: 'advice.return_if_fever_persists', slots: { n: 2 } },
        { kind: 3, id: 'a3', lang: 'ur-PK', text: 'کمرے میں دھواں نہ ہونے دیں۔' },
        { kind: 2, id: 'a4', redFlagId: 'redflag.breathing' },
      ],
      followUp: { in: { value: 3, unit: 'day' } },
      packId: 'paediatrics',
      schema: 1,
    };

    const model = buildDocument({
      rx,
      profile: {
        ...defaultDoctorProfile,
        doctor: {
          name: 'Dr Ali Tahir',
          qualifications: 'MBBS, FCPS (Paediatrics)',
          registration: { authority: 'PMDC', number: '12345-P' },
          clinicName: 'Nabz Children Clinic',
          clinicAddress: 'Model Town, Lahore',
        },
      },
      pack: paediatrics,
      packs,
      defaults: appDefaults,
    });

    for (const [i, page] of model.pages.entries()) {
      const svg = pageToSvg(page, { includePreviewOnly: false });
      const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1240 } })
        .render()
        .asPng();
      await writeFile(join(outDir!, `page-${i + 1}.png`), png);
    }
    expect(model.pages.length).toBeGreaterThan(0);
    console.log(`\nwrote ${model.pages.length} PNG(s) to ${outDir}`);
  });
});
