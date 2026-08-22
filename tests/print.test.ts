/**
 * Print-target suite. Every clause of PRODUCT.md 10 / DESIGN.md 10 that can be
 * asserted without a printer is asserted here.
 *
 * What this suite CANNOT do is the last check the spec asks for: run the page
 * through a real cheap mono laser. That one stays a human step.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { packs } from '@data/phrases/index.ts';
import { paediatrics } from '@data/packs/index.ts';
import { appDefaults, PAPER } from '@config/appDefaults.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import type { DoctorProfile } from '@config/doctorProfile.ts';
import type { Prescription } from '@domain/prescription.ts';
import { loadFonts, measure, shapeRun } from '@render/text/engine.ts';
import { visualOrder } from '@render/text/line.ts';
import { buildDocument } from '@render/pdf/layout.ts';
import { renderPdf } from '@render/pdf/renderPdf.ts';
import { printableOps, MM_TO_PT } from '@render/pdf/model.ts';
import type { DocumentModel, TextOp } from '@render/pdf/model.ts';

const FONT_DIR = join(process.cwd(), 'public', 'fonts');

beforeAll(async () => {
  await loadFonts(async (file) => readFile(join(FONT_DIR, file)));
});

const profile = (over: Partial<DoctorProfile> = {}): DoctorProfile => ({
  ...defaultDoctorProfile,
  doctor: {
    name: 'Dr A. Tahir',
    qualifications: 'MBBS, FCPS (Paediatrics)',
    registration: { authority: 'PMDC', number: '12345-P' },
    clinicName: 'Nabz Children Clinic',
    clinicAddress: 'Lahore',
  },
  ...over,
});

const prescription = (over: Partial<Prescription> = {}): Prescription => ({
  id: 'rx1',
  createdAt: '2026-08-21T09:00:00.000Z',
  date: '2026-08-21',
  patient: { name: 'Ayesha Khan', age: '3 y 2 m', sex: 'F', weightKg: 13.5 },
  problems: ['Fever for 3 days', 'Cough'],
  examination: [
    {
      system: 'respiratory',
      findings: [
        { id: 'crepitations', label: 'crepitations', state: 'present', value: 'right base' },
        { id: 'wheeze', label: 'wheeze', state: 'absent' },
      ],
    },
  ],
  diagnosis: ['Community-acquired pneumonia'],
  medications: [
    {
      id: 'm1',
      drug: { brand: 'Amoxil', generic: 'Amoxicillin', strength: '250mg/5ml', form: 'syrup' },
      sig: {
        templateId: 'sig.oral.liquid',
        dose: { value: 5, unit: 'ml' },
        frequency: 'TID',
        timing: 'after_food',
        duration: { value: 5, unit: 'day' },
        slots: { administer: 'give' },
      },
      citedSuggestion: {
        text: '40 mg/kg per dose, twice daily',
        reference: 'WHO Pocket Book of Hospital Care for Children, 2nd ed., ch. 4',
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
    },
  ],
  advice: [
    { kind: 1, id: 'a1', templateId: 'advice.complete_course', slots: {} },
    { kind: 1, id: 'a2', templateId: 'advice.return_if_fever_persists', slots: { n: 2 } },
    { kind: 3, id: 'a3', lang: 'en', text: 'Nebulise at home if the wheeze returns.' },
    { kind: 2, id: 'a4', redFlagId: 'redflag.breathing' },
  ],
  packId: 'paediatrics',
  schema: 1,
  ...over,
});

function build(over: Partial<Prescription> = {}, prof = profile()): DocumentModel {
  return buildDocument({
    rx: prescription(over),
    profile: prof,
    pack: paediatrics,
    packs,
    defaults: appDefaults,
  });
}

const textOps = (model: DocumentModel, pageIndex: number): TextOp[] =>
  model.pages[pageIndex]!.ops.filter((o): o is TextOp => o.op === 'text');

/** the line's LOGICAL text, i.e. what a reader reads, not what x-order it sits in */
const plainOf = (op: TextOp) => op.line.text;

const allText = (model: DocumentModel, pageIndex?: number): string => {
  const pages = pageIndex === undefined ? model.pages : [model.pages[pageIndex]!];
  return pages
    .flatMap((p) => p.ops.filter((o): o is TextOp => o.op === 'text').map(plainOf))
    .join('\n');
};

describe('text engine', () => {
  it('shapes Nastaliq with real outlines and no missing glyphs', () => {
    const run = shapeRun('دن میں تین بار', 'urdu');
    expect(run.glyphs.length).toBeGreaterThan(10);
    expect(run.glyphs.every((g) => g.path.length > 0)).toBe(true);
    expect(run.width).toBeGreaterThan(0);
  });

  it('shapes contextually: joined Urdu is not the sum of its isolated letters', () => {
    const joined = measure('بار', 'urdu', 12);
    const isolated = ['ب', 'ا', 'ر'].reduce((w, c) => w + measure(c, 'urdu', 12), 0);
    expect(joined).toBeLessThan(isolated);
  });

  it('measures Latin and mono differently, as different faces', () => {
    expect(measure('250mg', 'mono', 10)).not.toBeCloseTo(measure('250mg', 'latin', 10), 3);
  });
});

describe('bidi reordering', () => {
  const seg = (text: string, dir: 'ltr' | 'rtl') => ({ text, dir });

  it('reverses an RTL line but keeps LTR islands internally ordered', () => {
    const segments = [seg('اردو', 'rtl'), seg('Amoxil ', 'ltr'), seg('250mg', 'ltr')];
    const out = visualOrder(segments, 'rtl').map((x) => x.text);
    // the Latin island stays in order and lands to the LEFT of the Urdu word
    expect(out.join('')).toBe('Amoxil 250mgاردو');
  });

  it('leaves an LTR line untouched', () => {
    const segments = [seg('Give ', 'ltr'), seg('5ml', 'ltr')];
    expect(visualOrder(segments, 'ltr').map((x) => x.text).join('')).toBe('Give 5ml');
  });
});

describe('page geometry', () => {
  it('is exactly A4 in points', () => {
    const model = build();
    expect(model.pages[0]!.widthPt).toBeCloseTo(PAPER.A4.widthMm * MM_TO_PT, 6);
    expect(model.pages[0]!.heightPt).toBeCloseTo(PAPER.A4.heightMm * MM_TO_PT, 6);
  });

  it('follows the paper setting', () => {
    const model = build({}, profile({ paper: 'Letter' }));
    expect(model.pages[0]!.widthPt).toBeCloseTo(PAPER.Letter.widthMm * MM_TO_PT, 6);
  });

  it('keeps every drawn op inside the page', () => {
    const model = build();
    for (const page of model.pages) {
      for (const op of page.ops) {
        if (op.op === 'text') {
          expect(op.y).toBeGreaterThan(0);
          expect(op.y).toBeLessThanOrEqual(page.heightPt);
        }
      }
    }
  });
});

describe('letterhead modes', () => {
  it('text mode draws the doctor block', () => {
    const model = build({}, profile({ letterhead: { mode: 'text', reservedTopMm: 45 } }));
    expect(allText(model, 0)).toContain('Dr A. Tahir');
    expect(allText(model, 0)).toContain('PMDC 12345-P');
  });

  it('pad mode prints NOTHING in the reserved zone, but the preview shows it', () => {
    const prof = profile({ letterhead: { mode: 'pad', reservedTopMm: 45 } });
    const model = build({}, prof);
    const page = model.pages[0]!;
    const reserved = 45 * MM_TO_PT;

    // the guide exists for the preview
    const guides = page.ops.filter((o) => o.previewOnly);
    expect(guides.length).toBeGreaterThan(0);

    // ...and nothing printable is inside the reserved zone
    for (const op of printableOps(page)) {
      if (op.op === 'text') expect(op.y).toBeGreaterThan(reserved);
      if (op.op === 'rect') expect(op.y + op.h).toBeGreaterThan(reserved);
    }
    // and the doctor block is not drawn at all in pad mode
    expect(
      printableOps(page)
        .filter((o): o is TextOp => o.op === 'text')
        .map(plainOf)
        .join('\n'),
    ).not.toContain('Nabz Children Clinic');
  });
});

describe('identity strip', () => {
  it('appears on every page with patient, date, page X of Y and registration', () => {
    // enough content to force a second page
    const many = Array.from({ length: 14 }, (_, i) => ({
      ...prescription().medications[0]!,
      id: `m${i}`,
    }));
    const model = build({ medications: many });
    expect(model.pages.length).toBeGreaterThan(1);

    model.pages.forEach((_, i) => {
      const text = allText(model, i);
      expect(text, `page ${i + 1}`).toContain('Ayesha Khan');
      expect(text, `page ${i + 1}`).toContain('2026-08-21');
      expect(text, `page ${i + 1}`).toContain(`Page ${i + 1} of ${model.pages.length}`);
      expect(text, `page ${i + 1}`).toContain('PMDC 12345-P');
    });
  });

  it('carries the allergy forward to later pages', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      ...prescription().medications[0]!,
      id: `m${i}`,
    }));
    const model = build({
      medications: many,
      patient: { ...prescription().patient, allergies: 'Penicillin — rash' },
    });
    expect(model.pages.length).toBeGreaterThan(1);
    expect(allText(model, 1)).toContain('ALLERGY: Penicillin');
  });
});

describe('signature block', () => {
  it('is pinned to the bottom of the last page, not floated after the content', () => {
    const model = build();
    const page = model.pages[model.pages.length - 1]!;
    const sigLines = page.ops.filter(
      (o) => o.op === 'line' && o.width === 0.7,
    );
    expect(sigLines.length).toBe(1);
    const y = (sigLines[0] as { y1: number }).y1;
    // within the bottom 12% of the sheet regardless of how short the script is
    expect(y).toBeGreaterThan(page.heightPt * 0.88);
  });

  it('stays pinned even for a nearly empty prescription', () => {
    const model = build({ problems: [], examination: [], diagnosis: [], medications: [], advice: [] });
    const page = model.pages[0]!;
    const sig = page.ops.find((o) => o.op === 'line' && o.width === 0.7) as { y1: number };
    expect(sig.y1).toBeGreaterThan(page.heightPt * 0.88);
  });

  it('never stamps a stored signature image', () => {
    const model = build();
    const images = model.pages.flatMap((p) => p.ops.filter((o) => o.op === 'image'));
    expect(images).toEqual([]);
    expect(allText(model)).toContain('Signature');
  });

  it('marks earlier pages as continued so no page ends in a forgeable blank', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      ...prescription().medications[0]!,
      id: `m${i}`,
    }));
    const model = build({ medications: many });
    expect(allText(model, 0)).toContain('continued on the next page');
    expect(allText(model, model.pages.length - 1)).not.toContain('continued on the next page');
  });
});

describe('the bilingual medication row', () => {
  it('prints both languages for the same drug', () => {
    const model = build();
    const text = allText(model);
    expect(text).toContain('Give 5 ml three times a day after food for 5 days');
    expect(text).toContain('دن میں تین بار');
  });

  it('row-locks the two tracks: both start at the same top edge', () => {
    const model = build();
    const ops = textOps(model, 0);
    const enOp = ops.find((o) => plainOf(o).startsWith('Give 5 ml'));
    const urOp = ops.find((o) => /دن میں تین بار/.test(plainOf(o)) && o.align === 'right');
    expect(enOp).toBeDefined();
    expect(urOp).toBeDefined();
    // Two scripts at two sizes cannot share a baseline; what must not drift is
    // the row itself, so the tracks are locked at the top of the row.
    const enTop = enOp!.y - enOp!.line.ascentPt;
    const urTop = urOp!.y - urOp!.line.ascentPt;
    expect(urTop).toBeCloseTo(enTop, 1);
  });

  it('makes the row as tall as the taller language', () => {
    const model = build();
    const ops = textOps(model, 0);
    const enOp = ops.find((o) => plainOf(o).startsWith('Give 5 ml'))!;
    const urOp = ops.find((o) => /دن میں تین بار/.test(plainOf(o)) && o.align === 'right')!;
    // the Urdu is set larger, so it is the language that drives the row height
    expect(urOp.line.heightPt).toBeGreaterThan(enOp.line.heightPt);
  });

  it('never splits a drug and its Urdu across a page break', () => {
    // squeeze the page so rows have to break somewhere
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...prescription().medications[0]!,
      id: `m${i}`,
    }));
    const model = build({ medications: many });

    for (let i = 0; i < model.pages.length; i += 1) {
      const ops = textOps(model, i);
      const enCount = ops.filter((o) => plainOf(o).startsWith('Give 5 ml')).length;
      const urCount = ops.filter((o) => /دن میں تین بار/.test(plainOf(o))).length;
      // every English sig on a page has its Urdu twin on the SAME page
      expect(urCount, `page ${i + 1}`).toBe(enCount);
    }
  });

  it('sets the Urdu at or above the legibility floor', () => {
    const model = build();
    const urduSegments = model.pages
      .flatMap((p) => p.ops)
      .filter((o): o is TextOp => o.op === 'text')
      .flatMap((o) => o.line.segments)
      .filter((s) => s.role === 'urdu' || s.role === 'urduStrong');
    expect(urduSegments.length).toBeGreaterThan(0);
    for (const segment of urduSegments) {
      expect(segment.sizePt).toBeGreaterThanOrEqual(appDefaults.urduMinPt);
    }
  });

  it('sets clinical values in mono', () => {
    const model = build();
    const monoText = model.pages
      .flatMap((p) => p.ops)
      .filter((o): o is TextOp => o.op === 'text')
      .flatMap((o) => o.line.segments)
      .filter((s) => s.role === 'mono' || s.role === 'monoBold')
      .map((s) => s.text)
      .join(' ');
    expect(monoText).toContain('250mg/5ml');
    expect(monoText).toMatch(/\b5\b/);
  });

  it('sets a DECIMAL dose in the tabular sans, not mono', () => {
    // Plex Mono centres the period in a full-width advance and prints "7 . 5",
    // which can be read as two numbers. See roleFor() in render/text/line.ts.
    const model = build();
    const segments = model.pages
      .flatMap((p) => p.ops)
      .filter((o): o is TextOp => o.op === 'text')
      .flatMap((o) => o.line.segments);

    const decimal = segments.find((s) => s.text === '7.5');
    expect(decimal, 'the 7.5 ml dose should be its own segment').toBeDefined();
    expect(decimal!.role).toBe('value');

    // integers keep mono, and both faces advance a digit identically, so a
    // decimal and an integer dose still line up in a column
    expect(segments.some((s) => s.text === '5' && s.role === 'mono')).toBe(true);
    expect(measure('8', 'value', 10)).toBeCloseTo(measure('8', 'mono', 10), 6);
    // ...and the period is genuinely tighter than a monospaced one
    expect(measure('7.5', 'value', 10)).toBeLessThan(measure('7.5', 'mono', 10));
  });

  it('keeps every digit the same width in the value face', () => {
    const widths = '0123456789'.split('').map((d) => measure(d, 'value', 10));
    for (const w of widths) expect(w).toBeCloseTo(widths[0]!, 6);
  });

  it('shows a cited dose as a suggestion to confirm, never as a filled value', () => {
    const text = allText(build());
    expect(text).toContain('WHO Pocket Book');
    expect(text).toContain('confirm before signing');
  });
});

describe('advice tiers stay distinguishable on paper', () => {
  it('prints tier-3 free text as typed, in the language typed, with no translation', () => {
    const text = allText(build());
    expect(text).toContain('Nebulise at home if the wheeze returns.');
    expect(text).toContain("Doctor's own words - printed as typed");
  });

  it('explains every mark in words, so colour is never the only channel', () => {
    const text = allText(build());
    // the legend names each mark
    expect(text).toContain('approved wording');
    expect(text).toContain('come back immediately');
    expect(text).toContain("doctor's own words, printed as typed");
    // and the red flag's own sentence says what to do, in both languages
    expect(text).toContain('Come back IMMEDIATELY if breathing becomes fast or difficult');
    expect(text).toContain('اگر سانس تیز یا مشکل ہو جائے تو فوراً واپس لائیں');
  });

  it('marks a vetted line, not just tints it', () => {
    const model = build();
    const marks = model.pages
      .flatMap((p) => p.ops)
      .filter((o): o is TextOp => o.op === 'text')
      .map((o) => o.line.text.trim());
    expect(marks).toContain('✓');
    expect(marks).toContain('!');
  });

  it('gives every advice item a non-colour channel (a left border rule)', () => {
    const model = build();
    const bars = model.pages
      .flatMap((p) => p.ops)
      .filter((o) => o.op === 'rect' && o.w <= 3 && o.fill);
    expect(bars.length).toBeGreaterThanOrEqual(4);
  });
});

describe('PDF output', () => {
  it('produces a real PDF at the right page size', { timeout: 30_000 }, async () => {
    const bytes = await renderPdf(build());
    expect(bytes.length).toBeGreaterThan(5000);
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    expect(header.startsWith('%PDF-')).toBe(true);

    const { PDFDocument } = await import('pdf-lib');
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(build().pages.length);
    const size = parsed.getPage(0).getSize();
    expect(size.width).toBeCloseTo(PAPER.A4.widthMm * MM_TO_PT, 1);
    expect(size.height).toBeCloseTo(PAPER.A4.heightMm * MM_TO_PT, 1);
  });

  it('omits preview-only marks from the printed file', { timeout: 30_000 }, async () => {
    const prof = profile({ letterhead: { mode: 'pad', reservedTopMm: 45 } });
    const model = build({}, prof);
    const printed = model.pages.flatMap(printableOps);
    expect(printed.some((o) => o.previewOnly)).toBe(false);
    const bytes = await renderPdf(model);
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
