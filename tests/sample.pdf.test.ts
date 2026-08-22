/**
 * Writes a real sample PDF to the scratchpad so a human can open it and look at
 * the Nastaliq on an actual printer. Skipped unless NABZ_SAMPLE_PDF is set --
 * the spec's last acceptance check ("test on a real cheap mono laser") is a
 * human step, and this is how you get the paper to do it with.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { packs } from '@data/phrases/index.ts';
import { paediatrics } from '@data/packs/index.ts';
import { appDefaults } from '@config/appDefaults.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import { loadFonts } from '@render/text/engine.ts';
import { buildDocument } from '@render/pdf/layout.ts';
import { renderPdf } from '@render/pdf/renderPdf.ts';
import type { Prescription } from '@domain/prescription.ts';

const out = process.env.NABZ_SAMPLE_PDF;

describe.runIf(out)('sample document', () => {
  beforeAll(async () => {
    await loadFonts(async (file) => readFile(join(process.cwd(), 'public', 'fonts', file)));
  });

  it('writes a printable sample', async () => {
    const rx: Prescription = {
      id: 'sample',
      createdAt: '2026-08-21T09:00:00.000Z',
      date: '2026-08-21',
      patient: {
        name: 'Ayesha Khan',
        age: '3 y 2 m',
        sex: 'F',
        weightKg: 13.5,
        allergies: 'Penicillin — rash as an infant',
      },
      problems: ['Fever for 3 days', 'Cough, worse at night', 'Poor feeding since yesterday'],
      examination: [
        {
          system: 'general',
          findings: [
            { id: 'ill', label: 'ill-looking', state: 'present' },
            { id: 'febrile', label: 'febrile', state: 'present', value: '39.2 °C' },
            { id: 'dehydration', label: 'dehydration', state: 'absent' },
          ],
        },
        {
          system: 'respiratory',
          findings: [
            { id: 'tachypnoea', label: 'tachypnoea', state: 'present', value: '46/min' },
            { id: 'crepitations', label: 'crepitations', state: 'present', value: 'right base' },
            { id: 'indrawing', label: 'chest indrawing', state: 'absent' },
            { id: 'wheeze', label: 'wheeze', state: 'absent' },
          ],
          freeText: 'SpO2 96% on room air',
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
        {
          id: 'm3',
          drug: { brand: 'Ventolin Syrup', generic: 'Salbutamol', strength: '2mg/5ml', form: 'syrup' },
          sig: {
            templateId: 'sig.oral.liquid',
            dose: { value: 2.5, unit: 'ml' },
            frequency: 'TID',
            duration: { value: 5, unit: 'day' },
            slots: { administer: 'give' },
          },
        },
      ],
      advice: [
        { kind: 1, id: 'a1', templateId: 'advice.complete_course', slots: {} },
        { kind: 1, id: 'a2', templateId: 'advice.increase_fluids', slots: {} },
        { kind: 1, id: 'a3', templateId: 'advice.return_if_fever_persists', slots: { n: 2 } },
        { kind: 3, id: 'a4', lang: 'ur-PK', text: 'کمرے میں دھواں نہ ہونے دیں۔' },
        { kind: 2, id: 'a5', redFlagId: 'redflag.breathing' },
        { kind: 2, id: 'a6', redFlagId: 'redflag.not_feeding' },
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
          phone: '042-000 0000',
        },
      },
      pack: paediatrics,
      packs,
      defaults: appDefaults,
    });

    const bytes = await renderPdf(model);
    await writeFile(out!, bytes);
    expect(bytes.length).toBeGreaterThan(20000);
    console.log(`\nwrote ${out} — ${model.pages.length} page(s), ${(bytes.length / 1024).toFixed(0)} KB`);
  });
});
