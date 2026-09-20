/**
 * Document kinds: what a discharge summary is, and what it must not become.
 *
 * Three properties matter enough to be tests rather than comments:
 *
 * 1. A record written before kinds existed is still a prescription. Those
 *    records live on one device as the only copy there is, so "absent means
 *    prescription" has to be true of the code, not of a migration that ran.
 *
 * 2. The registry is exhaustive at run time as well as at compile time. A kind
 *    listing a section with no editor would be a tab leading nowhere -- the bug
 *    the module nav had before `pack.modules` drove it.
 *
 * 3. A discharge summary adds no new translation surface. Everything a family
 *    reads on it comes through the advice tiers, which the pack already
 *    vouches for in both languages.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { packs } from '@data/phrases/index.ts';
import { paediatrics } from '@data/packs/index.ts';
import { medicine } from '@data/packs/medicine.ts';
import { appDefaults } from '@config/appDefaults.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import type { Prescription } from '@domain/prescription.ts';
import { emptyPrescription, isBlank } from '@domain/prescription.ts';
import {
  DOCUMENT_META,
  documentsFor,
  kindOf,
  missingForPrint,
  printOrder,
  sectionLabelFor,
} from '@domain/documents/index.ts';
import type { DocumentKindId } from '@domain/documents/index.ts';
import { SECTION_LABEL, SECTION_PANEL } from '@render/screen/documents/registry.tsx';
import { stayLengthDays } from '@render/screen/sections/StaySection.tsx';
import { loadFonts } from '@render/text/engine.ts';
import { buildDocument } from '@render/pdf/layout.ts';
import type { DocumentModel, TextOp } from '@render/pdf/model.ts';

const KINDS = Object.keys(DOCUMENT_META) as DocumentKindId[];

describe('what kind a record is', () => {
  it('reads a record with no kind as a prescription', () => {
    // The property that lets this ship without a schema bump or a migration
    // pass over an encrypted backup.
    expect(kindOf({}).id).toBe('prescription');
    expect(kindOf({ kind: undefined }).id).toBe('prescription');
  });

  it('writes no kind at all for a new prescription', () => {
    const rx = emptyPrescription('paediatrics', 'x');
    // Byte-identical to a record saved before kinds existed, so "absent means
    // prescription" stays true of new records too, not only of old ones.
    expect('kind' in rx).toBe(false);
    expect(rx.stay).toBeUndefined();
  });

  it('gives a new discharge summary a kind and somewhere to put the dates', () => {
    const rx = emptyPrescription('medicine', 'x', new Date(), 'discharge');
    expect(rx.kind).toBe('discharge');
    expect(rx.stay).toEqual({ course: [], procedures: [] });
  });

  it('is not blank once an admission date is typed, though nothing else is', () => {
    const rx: Prescription = {
      ...emptyPrescription('medicine', 'x', new Date(), 'discharge'),
      stay: { course: [], procedures: [], admittedOn: '2026-01-04' },
    };
    expect(isBlank(rx)).toBe(false);
    // and still blank when the block exists but holds nothing
    expect(isBlank(emptyPrescription('medicine', 'y', new Date(), 'discharge'))).toBe(true);
  });
});

describe('the registry', () => {
  it('has an editor for every section every kind offers', () => {
    for (const id of KINDS) {
      for (const section of DOCUMENT_META[id].sections) {
        expect(SECTION_PANEL[section], `${id} → ${section}`).toBeTruthy();
        expect(SECTION_LABEL[section], `${id} → ${section}`).toBeTruthy();
      }
    }
  });

  it('only prints blocks the renderer knows how to draw', () => {
    // `PAINT` is a Record over the closed union, so this is really asserting
    // the union has not been widened without the painter following.
    const drawable = new Set([
      'problems',
      'stay',
      'examination',
      'diagnosis',
      'labs',
      'calculations',
      'medications',
      'advice',
      'followUp',
    ]);
    for (const id of KINDS) {
      for (const block of DOCUMENT_META[id].print) expect(drawable.has(block)).toBe(true);
    }
  });

  it('defaults a pack with no documents list to prescriptions only', () => {
    expect(documentsFor(undefined).map((k) => k.id)).toEqual(['prescription']);
    expect(documentsFor([]).map((k) => k.id)).toEqual(['prescription']);
  });

  it('lets the pack decide, with no component knowing which', () => {
    // The seam, stated as a test: one pack offers a discharge summary and one
    // does not, and the difference is data.
    expect(paediatrics.documents ?? []).not.toContain('discharge');
    expect(medicine.documents).toContain('discharge');
  });
});

describe('where investigations land', () => {
  it("follows the doctor's setting on a prescription", () => {
    const k = DOCUMENT_META.prescription;
    const after = printOrder(k, 'after-medications');
    expect(after.indexOf('labs')).toBeGreaterThan(after.indexOf('medications'));
    const before = printOrder(k, 'after-diagnosis');
    expect(before.indexOf('labs')).toBeLessThan(before.indexOf('medications'));
  });

  it('ignores it on a discharge summary, where results explain the plan', () => {
    const k = DOCUMENT_META.discharge;
    const order = printOrder(k, 'after-medications');
    expect(order).toEqual(k.print);
    expect(order.indexOf('labs')).toBeLessThan(order.indexOf('medications'));
  });

  it('never drops or duplicates a block while moving one', () => {
    for (const id of KINDS) {
      const k = DOCUMENT_META[id];
      for (const placement of ['after-diagnosis', 'after-medications'] as const) {
        const order = printOrder(k, placement);
        expect([...order].sort()).toEqual([...k.print].sort());
        expect(new Set(order).size).toBe(order.length);
      }
    }
  });
});

describe('what a document cannot be printed without', () => {
  const discharge = DOCUMENT_META.discharge;

  it('lets a prescription print with nothing but advice on it', () => {
    expect(missingForPrint(DOCUMENT_META.prescription, { diagnosis: [] })).toEqual([]);
  });

  it('refuses a discharge summary with no follow-up', () => {
    const missing = missingForPrint(discharge, {
      diagnosis: ['Pneumonia'],
      stay: { admittedOn: '2026-01-04' },
    });
    expect(missing).toEqual(['a follow-up']);
  });

  it('accepts a named person as the follow-up, not only an interval', () => {
    // The commonest failure of a discharge is nobody knowing whose clinic the
    // patient belongs to now; "in 7 days" alone does not fix that, and a named
    // clinic with no interval does.
    expect(
      missingForPrint(discharge, {
        diagnosis: ['Pneumonia'],
        stay: { admittedOn: '2026-01-04', followUpWith: 'Dr Shahid' },
      }),
    ).toEqual([]);
  });

  it('names everything that is missing, so the message can say why', () => {
    expect(missingForPrint(discharge, { diagnosis: [] })).toEqual([
      'the admission date',
      'a diagnosis',
      'a follow-up',
    ]);
  });
});

describe('section wording', () => {
  it("renames the sections a discharge summary reads differently", () => {
    const k = DOCUMENT_META.discharge;
    expect(sectionLabelFor(k, 'problems', 'Problems')).toBe('On admission');
    expect(sectionLabelFor(k, 'labs', 'Tests')).toBe('Results');
    expect(sectionLabelFor(k, 'examination', 'Exam')).toBe('On discharge');
  });

  it('leaves a prescription alone', () => {
    const k = DOCUMENT_META.prescription;
    for (const s of k.sections) {
      expect(sectionLabelFor(k, s, SECTION_LABEL[s])).toBe(SECTION_LABEL[s]);
    }
  });
});

describe('length of stay', () => {
  it('counts whole days', () => {
    expect(stayLengthDays('2026-01-04', '2026-01-09')).toBe(5);
    expect(stayLengthDays('2026-01-04', '2026-01-04')).toBe(0);
  });

  it('shows a reversed pair rather than hiding it', () => {
    // A summary saying "admitted the 4th, discharged the 2nd" is a typo that
    // should be visible while it can still be fixed.
    expect(stayLengthDays('2026-01-04', '2026-01-02')).toBe(-2);
  });

  it('says nothing when it does not know', () => {
    expect(stayLengthDays(undefined, '2026-01-09')).toBeNull();
    expect(stayLengthDays('2026-01-04', undefined)).toBeNull();
    expect(stayLengthDays('not a date', '2026-01-09')).toBeNull();
  });
});

describe('a printed discharge summary', () => {
  beforeAll(async () => {
    await loadFonts(async (file) => readFile(join(process.cwd(), 'public', 'fonts', file)));
  });

  const summary = (over: Partial<Prescription> = {}): Prescription => ({
    ...emptyPrescription('medicine', 'd1', new Date('2026-01-09T09:00:00Z'), 'discharge'),
    date: '2026-01-09',
    patient: { name: 'Imran Ali', age: '54 y', sex: 'M' },
    problems: ['Breathlessness for two days'],
    diagnosis: ['Community-acquired pneumonia'],
    stay: {
      admittedOn: '2026-01-04',
      dischargedOn: '2026-01-09',
      ward: 'Medical Ward 2',
      course: ['Settled on IV co-amoxiclav; oxygen weaned by day three.'],
      procedures: ['Chest X-ray, 4 Jan'],
      condition: 'Afebrile, saturating 96% on air',
      followUpWith: 'Dr Shahid, chest clinic',
      followUpWhere: 'OPD, Tuesday',
    },
    ...over,
  });

  const build = (rx: Prescription): DocumentModel =>
    buildDocument({ rx, profile: defaultDoctorProfile, pack: medicine, packs, defaults: appDefaults });

  const allText = (m: DocumentModel) =>
    m.pages
      .flatMap((p) => p.ops.filter((o): o is TextOp => o.op === 'text').map((o) => o.line.text))
      .join('\n');

  it('prints the admission, the course and the procedures', () => {
    const text = allText(build(summary()));
    expect(text).toContain('HOSPITAL STAY');
    expect(text).toContain('Admitted: 2026-01-04');
    expect(text).toContain('Ward: Medical Ward 2');
    expect(text).toContain('oxygen weaned by day three');
    expect(text).toContain('Chest X-ray, 4 Jan');
    expect(text).toContain('Condition on discharge: Afebrile');
  });

  it('carries the named follow-up onto the paper, not just the interval', () => {
    const text = allText(build(summary()));
    expect(text).toContain('Dr Shahid, chest clinic');
    expect(text).toContain('OPD, Tuesday');
  });

  it("titles the sections the way a discharge summary reads them", () => {
    const text = allText(build(summary()));
    // Same stored field, different moment: these are the complaints the
    // patient came IN with, and calling them "Presenting complaints" on a
    // summary written five days later would be a small lie.
    expect(text).toContain('ON ADMISSION');
    expect(text).not.toContain('PRESENTING COMPLAINTS');
  });

  it('puts the stay first and the results before the medicines', () => {
    const text = allText(
      build(
        summary({
          labs: [{ id: 'l1', labId: 'cbc', label: 'CBC' }],
          medications: [
            {
              id: 'm1',
              drug: { brand: 'Augmentin', generic: 'Co-amoxiclav', strength: '625mg', form: 'tablet' },
              sig: {
                templateId: 'sig.oral.solid',
                dose: { value: 1, unit: 'tablet' },
                frequency: 'TID',
                duration: { value: 5, unit: 'day' },
              },
            },
          ],
        }),
      ),
    );
    expect(text.indexOf('HOSPITAL STAY')).toBeLessThan(text.indexOf('ON ADMISSION'));
    // Results explain the plan, so they precede it. A prescription's
    // investigations are an instruction and may sit either side of the drugs;
    // a summary's are a finding and may not.
    expect(text.indexOf('RESULTS')).toBeGreaterThan(-1);
    expect(text.indexOf('TO CONTINUE')).toBeGreaterThan(-1);
    expect(text.indexOf('RESULTS')).toBeLessThan(text.indexOf('TO CONTINUE'));
  });

  it('prints nothing for an admission block that is empty', () => {
    // A prescription carries no `stay`, and a discharge that has one but has
    // had nothing typed into it must not print a heading for an admission
    // that has not been described.
    const bare = summary({ stay: { course: [], procedures: [] } });
    expect(allText(build(bare))).not.toContain('HOSPITAL STAY');
  });

  it('leaves a prescription untouched by any of this', () => {
    const rx: Prescription = {
      ...emptyPrescription('medicine', 'p1', new Date('2026-01-09T09:00:00Z')),
      date: '2026-01-09',
      patient: { name: 'Imran Ali' },
      problems: ['Cough'],
      diagnosis: ['Bronchitis'],
    };
    const text = allText(build(rx));
    expect(text).toContain('PRESENTING COMPLAINTS');
    expect(text).not.toContain('HOSPITAL STAY');
    expect(text).not.toContain('ON ADMISSION');
  });
});
