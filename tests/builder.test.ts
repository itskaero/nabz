/**
 * The pack builder's gates.
 *
 * These do not test that the editor edits — they test that it REFUSES. Each
 * case below is a way for wrong content to reach a patient without anything on
 * the printed script looking wrong, which is the only reason this tool exists.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { paediatrics } from '@data/packs/index.ts';
import { packs as shippedPhrases, packs } from '@data/phrases/index.ts';
import type { ContentPack } from '@domain/pack.ts';
import { redFlagWording, unreviewedRedFlags, validateContentPack } from '@domain/pack.ts';
import { validatePacks } from '@domain/phrases.ts';
import { mergeSection, sectionSize } from '@render/screen/builder/packFile.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import {
  editDistance,
  genericVocabulary,
  genericsWithoutDosing,
  nearDuplicates,
  normaliseGeneric,
  orphanedDosing,
  suggestGenerics,
  unreconciledBrands,
} from '@domain/generics.ts';
import { parsePackFile, serialisePack } from '@render/screen/builder/packFile.ts';
import {
  contentErrors,
  publishContent,
  resetContentCache,
  resolveContent,
  revertToShipped,
} from '@data/provider.ts';

const clonePack = (): ContentPack => structuredClone(paediatrics);
const clonePhrases = (): PackRegistry => structuredClone(shippedPhrases);

beforeEach(async () => {
  resetContentCache();
  await revertToShipped();
  resetContentCache();
});

describe('generic-name vocabulary', () => {
  it('is derived from the pack, not sourced from anywhere', () => {
    const vocab = genericVocabulary(paediatrics);
    expect(vocab.length).toBeGreaterThan(90);
    const amox = vocab.find((g) => g.name === 'Amoxicillin');
    expect(amox?.brands).toBeGreaterThan(1);
    expect(amox?.dosing).toBe(1);
  });

  it('folds the spellings that break the formulary/dosing join', () => {
    expect(normaliseGeneric('Amoxicillin ')).toBe('amoxicillin');
    expect(normaliseGeneric('Amoxicillin + Clavulanic acid')).toBe(
      normaliseGeneric('amoxicillin  clavulanic  acid'),
    );
    expect(normaliseGeneric('Co-trimoxazole')).toBe(normaliseGeneric('Co trimoxazole'));
  });

  it('catches a near-miss spelling of an existing generic', () => {
    const vocab = genericVocabulary(paediatrics);
    const hits = nearDuplicates('Amoxycillin', vocab);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.existing.name).toBe('Amoxicillin');
    expect(hits[0]!.distance).toBeLessThanOrEqual(2);
  });

  it('flags a differently-spelled duplicate as identical, not merely similar', () => {
    const vocab = genericVocabulary(paediatrics);
    const hits = nearDuplicates('amoxicillin', vocab);
    expect(hits[0]!.identical).toBe(true);
  });

  it('does not flag a genuinely different medicine', () => {
    const vocab = genericVocabulary(paediatrics);
    expect(nearDuplicates('Ondansetron', vocab)).toEqual([]);
  });

  it('caps the distance computation rather than scanning the whole string', () => {
    expect(editDistance('a', 'a')).toBe(0);
    expect(editDistance('amoxicillin', 'amoxycillin')).toBe(1);
    expect(editDistance('paracetamol', 'ondansetron', 2)).toBeGreaterThan(2);
  });

  it('autocompletes from the pack itself', () => {
    const vocab = genericVocabulary(paediatrics);
    const hits = suggestGenerics('amox', vocab);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.name.toLowerCase().startsWith('amox')).toBe(true);
  });

  it('finds brands that can never get a dose suggestion', () => {
    const orphans = genericsWithoutDosing(paediatrics);
    // the shipped pack has 100+ generics and only 10 dosing rows, so most are
    expect(orphans.length).toBeGreaterThan(50);
    expect(orphans.every((g) => g.brands > 0 && g.dosing === 0)).toBe(true);
  });

  it('finds dosing rows whose generic matches no medicine', () => {
    expect(orphanedDosing(paediatrics)).toEqual([]);
    const pack = clonePack();
    pack.dosing.push({
      generic: 'Amoxycillin',
      route: 'oral',
      reference: 'somewhere',
      verified: false,
    });
    const orphans = orphanedDosing(pack);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]!.generic).toBe('Amoxycillin');
  });

  it('counts what still needs checking against DRAP', () => {
    // every shipped row is a manual entry with no registration number
    expect(unreconciledBrands(paediatrics)).toHaveLength(paediatrics.formularySeed.length);
  });
});

describe('export gates', () => {
  it('blocks a dosing row with no citation', () => {
    const pack = clonePack();
    pack.dosing[0]!.reference = '   ';
    const errors = contentErrors(pack, shippedPhrases);
    expect(errors.join('\n')).toMatch(/no reference/i);
  });

  it('blocks a formulary row claiming DRAP with no registration number', () => {
    const pack = clonePack();
    pack.formularySeed[0]!.provenance = 'DRAP';
    const errors = contentErrors(pack, shippedPhrases);
    expect(errors.join('\n')).toMatch(/registration number/i);
  });

  it('blocks a phrase written in one locale and not the other', () => {
    const phrases = clonePhrases();
    delete phrases['ur-PK'].advice.tier1['advice.complete_course'];
    const errors = contentErrors(paediatrics, phrases);
    expect(errors.join('\n')).toMatch(/missing in locale "ur-PK"/);
  });

  it('blocks locales whose slot sets have drifted apart', () => {
    const phrases = clonePhrases();
    // drop the duration from the Urdu sentence: the parent is told to keep
    // giving an antibiotic with no end date.
    phrases['ur-PK'].templates['sig.oral.liquid'] =
      '[{timing} ]{frequency} {dose} {administer}';
    const errors = contentErrors(paediatrics, phrases);
    expect(errors.join('\n')).toMatch(/different slot sets/);
  });

  it('blocks an advice id the pack offers but no locale defines', () => {
    const pack = clonePack();
    pack.advicePacks.tier1.push('advice.not_written_yet');
    const errors = contentErrors(pack, shippedPhrases);
    expect(errors.join('\n')).toMatch(/advice\.not_written_yet/);
  });

  it('lets the shipped pack through', () => {
    expect(contentErrors(paediatrics, shippedPhrases)).toEqual([]);
  });
});

describe('red-flag sign-off', () => {
  it('reports every shipped red flag as unreviewed', () => {
    const wordingOf = (id: string) =>
      redFlagWording([
        shippedPhrases.en.advice.tier2[id] ?? '',
        shippedPhrases['ur-PK'].advice.tier2[id] ?? '',
      ]);
    const unreviewed = unreviewedRedFlags(paediatrics, wordingOf);
    expect(unreviewed).toHaveLength(paediatrics.advicePacks.tier2.length);
    expect(unreviewed.every((f) => f.reason === 'never-reviewed')).toBe(true);
  });

  it('is a warning at load time, so the shipped pack still prints', () => {
    // The app must run on what it has; the BUILDER is where the insisting
    // happens, because that is where a human is present to do the reviewing.
    const issues = validateContentPack(paediatrics);
    const redFlag = issues.filter((i) => i.where.startsWith('advicePacks.tier2.'));
    expect(redFlag.length).toBeGreaterThan(0);
    expect(redFlag.every((i) => i.severity === 'warning')).toBe(true);
    expect(contentErrors(paediatrics, shippedPhrases)).toEqual([]);
  });

  it('clears the sign-off when the wording changes', () => {
    const pack = clonePack();
    const phrases = clonePhrases();
    const id = pack.advicePacks.tier2[0]!;
    const wordingOf = (flagId: string) =>
      redFlagWording([
        phrases.en.advice.tier2[flagId] ?? '',
        phrases['ur-PK'].advice.tier2[flagId] ?? '',
      ]);

    pack.redFlagReview = {
      [id]: { reviewedBy: 'Dr A', date: '2026-08-21', wording: wordingOf(id) },
    };
    expect(unreviewedRedFlags(pack, wordingOf).find((f) => f.id === id)).toBeUndefined();

    phrases['ur-PK'].advice.tier2[id] = 'something else entirely';
    const stale = unreviewedRedFlags(pack, wordingOf).find((f) => f.id === id);
    expect(stale?.reason).toBe('wording-changed');
  });
});

describe('pack file', () => {
  it('round-trips exactly', () => {
    const json = serialisePack(paediatrics, shippedPhrases);
    const parsed = parsePackFile(json);
    expect(parsed.pack).toEqual(paediatrics);
    expect(parsed.phrases).toEqual(shippedPhrases);
  });

  it('survives an edit through the round trip', () => {
    const pack = clonePack();
    pack.examSystems[0]!.label = 'General appearance';
    const parsed = parsePackFile(serialisePack(pack, shippedPhrases));
    expect(parsed.pack.examSystems[0]!.label).toBe('General appearance');
  });

  it('refuses a file that is not a pack', () => {
    expect(() => parsePackFile('{"hello":1}')).toThrow(/not a Nabz content pack/);
    expect(() => parsePackFile('not json')).toThrow(/not valid JSON/);
  });

  it('is plain JSON — a pack is meant to be shared, unlike a records backup', () => {
    const json = serialisePack(paediatrics, shippedPhrases);
    expect(json).toContain('"magic": "NABZ-PACK"');
    expect(json).toContain('Amoxil');
  });
});

describe('content provider', () => {
  it('falls back to the shipped packs when nothing is stored', async () => {
    const content = await resolveContent();
    expect(content.edited).toBe(false);
    expect(content.pack.id).toBe('paediatrics');
    expect(content.rejected).toEqual([]);
  });

  it('serves an edited pack once published', async () => {
    const pack = clonePack();
    pack.examSystems[0]!.label = 'General appearance';
    const result = await publishContent(pack, shippedPhrases);
    expect(result.ok).toBe(true);

    resetContentCache();
    const content = await resolveContent();
    expect(content.edited).toBe(true);
    expect(content.pack.examSystems[0]!.label).toBe('General appearance');
  });

  it('refuses to publish content with errors', async () => {
    const pack = clonePack();
    pack.dosing[0]!.reference = '';
    const result = await publishContent(pack, shippedPhrases);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(/no reference/i);

    resetContentCache();
    expect((await resolveContent()).edited).toBe(false);
  });

  it('ignores stored content that is invalid, and says so', async () => {
    // Publish something valid, then corrupt it behind the provider's back --
    // the shape a partially-written or hand-edited store would have.
    await publishContent(clonePack(), clonePhrases());
    const db = await import('@storage/db.ts');
    const stored = (await db.loadContent())!;
    delete stored.phrases['ur-PK'].templates['sig.oral.liquid'];
    await db.saveContent(stored);

    resetContentCache();
    const content = await resolveContent();
    expect(content.edited).toBe(false);
    expect(content.pack.id).toBe('paediatrics');
    expect(content.rejected.join('\n')).toMatch(/sig\.oral\.liquid/);
  });

  it('reverts to the shipped content on request', async () => {
    const pack = clonePack();
    pack.examSystems[0]!.label = 'Changed';
    await publishContent(pack, shippedPhrases);
    resetContentCache();
    expect((await resolveContent()).edited).toBe(true);

    await revertToShipped();
    resetContentCache();
    const content = await resolveContent();
    expect(content.edited).toBe(false);
    expect(content.pack.examSystems[0]!.label).not.toBe('Changed');
  });
});

describe('handing the script to the patient', () => {
  const model = {
    pages: [],
    paper: 'A4',
    meta: { patientName: 'Ayesha Khan', date: '2026-08-21' },
  } as unknown as import('@render/pdf/model.ts').DocumentModel;

  it('names the file after the patient and the date', async () => {
    const { prescriptionFilename } = await import('@render/pdf/renderPdf.ts');
    expect(prescriptionFilename(model)).toBe('rx-Ayesha-Khan-2026-08-21.pdf');
  });

  it('falls back to a filename when the patient is unnamed', async () => {
    const { prescriptionFilename } = await import('@render/pdf/renderPdf.ts');
    expect(
      prescriptionFilename({ ...model, meta: { patientName: '', date: '2026-08-21' } }),
    ).toBe('rx-patient-2026-08-21.pdf');
  });
});


describe('growing the pack', () => {
  /**
   * The builder can now ADD advice, red flags, sig templates and vocabulary,
   * not only edit what shipped. Every one of them writes the English and leaves
   * the Urdu blank on purpose -- each locale is authored, never derived
   * (PRODUCT.md 4) -- so the thing that matters is that a blank cannot escape.
   */
  it('refuses a blank translation, with or without slots', () => {
    const withSlot = structuredClone(packs);
    withSlot.en.advice.tier1['advice.new'] = 'Drink extra fluids for {n} days';
    withSlot['ur-PK'].advice.tier1['advice.new'] = '';
    expect(validatePacks(withSlot).some((p) => p.where.includes('advice.new'))).toBe(true);

    // The one that used to slip through: no slots, so the slot-mismatch check
    // had nothing to compare and the line exported with an empty Urdu. A
    // patient was handed a blank space where their instruction should be.
    const noSlot = structuredClone(packs);
    noSlot.en.advice.tier1['advice.plain'] = 'Complete the full course of medicine';
    noSlot['ur-PK'].advice.tier1['advice.plain'] = '';
    const problems = validatePacks(noSlot).filter((p) => p.where.includes('advice.plain'));
    expect(problems).toHaveLength(1);
    expect(problems[0]!.severity).toBe('error');
    expect(problems[0]!.message).toMatch(/blank/i);
  });

  it('accepts the line once both locales are written', () => {
    const reg = structuredClone(packs);
    reg.en.advice.tier1['advice.plain'] = 'Complete the full course of medicine';
    reg['ur-PK'].advice.tier1['advice.plain'] = 'دوا کا پورا کورس مکمل کریں';
    expect(validatePacks(reg).filter((p) => p.where.includes('advice.plain'))).toEqual([]);
  });

  it('treats whitespace as blank', () => {
    const reg = structuredClone(packs);
    reg.en.advice.tier1['advice.ws'] = 'Rest at home';
    reg['ur-PK'].advice.tier1['advice.ws'] = '   ';
    expect(validatePacks(reg).some((p) => p.where.includes('advice.ws'))).toBe(true);
  });
});


describe('importing one section of a pack', () => {
  /**
   * Import used to replace the whole pack and both locale packs at once, which
   * made the ordinary case impossible: taking a colleague's formulary while
   * keeping your own advice, or pulling in reviewed Urdu without losing the
   * medicines you spent months reconciling against DRAP.
   */
  const mine = () => ({
    pack: structuredClone(paediatrics),
    phrases: structuredClone(shippedPhrases),
  });

  const theirs = () => {
    const c = mine();
    c.pack.formularySeed = [{ brand: 'TheirBrand', generic: 'Paracetamol', provenance: 'manual' }];
    c.pack.dosing = [
      { generic: 'Paracetamol', route: 'oral', reference: 'Their book, 1st ed.', verified: true },
    ];
    c.pack.advicePacks = { tier1: ['advice.theirs'], tier2: [] };
    c.pack.findingsPalette = { general: [{ id: 'their_chip', label: 'Their chip' }] };
    c.pack.examSystems = [{ id: 'general', label: 'General' }];
    c.phrases.en.advice.tier1 = { 'advice.theirs': 'Their advice' };
    c.phrases['ur-PK'].advice.tier1 = { 'advice.theirs': 'ان کا مشورہ' };
    c.phrases.en.templates = { 'sig.theirs': '{administer} {dose}' };
    c.phrases['ur-PK'].templates = { 'sig.theirs': '{dose} {administer}' };
    c.pack.sigTemplates = ['sig.theirs'];
    return c;
  };

  it('takes the medicines and leaves everything else alone', () => {
    const before = mine();
    const after = mergeSection(before, theirs(), 'formulary');

    expect(after.pack.formularySeed).toHaveLength(1);
    expect(after.pack.formularySeed[0]!.brand).toBe('TheirBrand');
    // The parts nobody asked to replace are untouched.
    expect(after.pack.dosing).toEqual(before.pack.dosing);
    expect(after.pack.advicePacks).toEqual(before.pack.advicePacks);
    expect(after.pack.findingsPalette).toEqual(before.pack.findingsPalette);
    expect(after.phrases).toEqual(before.phrases);
  });

  it('takes doses without touching the catalogue', () => {
    const before = mine();
    const after = mergeSection(before, theirs(), 'dosing');
    expect(after.pack.dosing).toHaveLength(1);
    expect(after.pack.formularySeed).toEqual(before.pack.formularySeed);
  });

  it('moves advice wording and its sign-offs together', () => {
    // Splitting them would leave advice ids with no text, or reviewed wording
    // attached to lines that are no longer offered.
    const before = mine();
    const after = mergeSection(before, theirs(), 'advice');
    expect(after.pack.advicePacks.tier1).toEqual(['advice.theirs']);
    expect(after.phrases.en.advice.tier1['advice.theirs']).toBe('Their advice');
    expect(after.phrases['ur-PK'].advice.tier1['advice.theirs']).toBe('ان کا مشورہ');
    // and left the medicines alone
    expect(after.pack.formularySeed).toEqual(before.pack.formularySeed);
  });

  it('does NOT let a phrases import re-sign a red flag', () => {
    /*
      The one pairing that would be a safety hole. Advice wording carries a
      clinician's sign-off; if "phrases" swept it along, importing a phrase set
      would silently replace reviewed return precautions with someone else's
      words while the sign-off still said yours.
    */
    const before = mine();
    const after = mergeSection(before, theirs(), 'phrases');

    expect(after.phrases.en.templates).toEqual({ 'sig.theirs': '{administer} {dose}' });
    expect(after.phrases.en.advice).toEqual(before.phrases.en.advice);
    expect(after.phrases['ur-PK'].advice).toEqual(before.phrases['ur-PK'].advice);
    expect(after.pack.advicePacks).toEqual(before.pack.advicePacks);
  });

  it('takes exam chips and investigations independently', () => {
    const before = mine();
    const exam = mergeSection(before, theirs(), 'exam');
    expect(exam.pack.findingsPalette['general']).toHaveLength(1);
    expect(exam.pack.labsPalette).toEqual(before.pack.labsPalette);

    const labs = mergeSection(before, theirs(), 'labs');
    expect(labs.pack.findingsPalette).toEqual(before.pack.findingsPalette);
  });

  it('still replaces everything when that is what was asked', () => {
    const after = mergeSection(mine(), theirs(), 'all');
    expect(after.pack.formularySeed).toHaveLength(1);
    expect(after.pack.advicePacks.tier1).toEqual(['advice.theirs']);
  });

  it('never mutates what it was given', () => {
    // The draft is React state; a merge that wrote through would corrupt it.
    const before = mine();
    const snapshot = JSON.stringify(before);
    mergeSection(before, theirs(), 'formulary');
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('counts what a section would replace, for the confirm', () => {
    const before = mine();
    expect(sectionSize(before.pack, before.phrases, 'formulary')).toBe(
      before.pack.formularySeed.length,
    );
    expect(sectionSize(theirs().pack, theirs().phrases, 'formulary')).toBe(1);
  });
});
