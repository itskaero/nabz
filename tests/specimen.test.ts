/**
 * The builder's sentence preview.
 *
 * This is the screen where a clinician is asked to vouch for wording, and
 * until now it showed them a template with holes in it rather than the
 * sentence. What these assert is that the preview is the REAL composition --
 * the same `composeSig` and `composeAdvice` the printed script uses, not a
 * second renderer that could drift from it.
 */
import { describe, expect, it } from 'vitest';
import { packs } from '@data/phrases/index.ts';
import { paediatrics } from '@data/packs/index.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { packErrors, redFlagWording, unreviewedAdvice } from '@domain/pack.ts';
import { parsePackFile, serialisePack } from '@render/screen/builder/packFile.ts';
import {
  renderAdviceTemplate,
  renderRedFlag,
  renderSigTemplate,
  specimenSig,
} from '@render/screen/builder/specimen.ts';

const byLocale = (rs: ReturnType<typeof renderSigTemplate>) =>
  Object.fromEntries(rs.map((r) => [r.locale, r]));

describe('a sig template, previewed', () => {
  it('renders every template the shipped pack offers, in both locales', () => {
    for (const id of paediatrics.sigTemplates) {
      const out = byLocale(renderSigTemplate(id, packs));
      expect(out['en']?.complete, `${id} en`).toBe(true);
      expect(out['ur-PK']?.complete, `${id} ur-PK`).toBe(true);
      expect(out['en']?.plain.trim().length, `${id} en`).toBeGreaterThan(0);
      expect(out['ur-PK']?.plain.trim().length, `${id} ur-PK`).toBeGreaterThan(0);
    }
  });

  it('writes the Urdu in Urdu script, not the English with the words swapped', () => {
    const out = byLocale(renderSigTemplate('sig.oral.liquid', packs));
    // Arabic-script range. A preview that quietly fell back to the English
    // would be worse than no preview, because it would look finished.
    expect(out['ur-PK']?.plain).toMatch(/[؀-ۿ]/);
    expect(out['en']?.plain).not.toMatch(/[؀-ۿ]/);
  });

  it('fills slots from the pack’s own vocabulary', () => {
    // The author reads their own words, not a hardcoded specimen vocabulary.
    const en = packs.en;
    const firstFrequency = Object.keys(en.vocab['frequency'] ?? {})[0]!;
    const sig = specimenSig('sig.oral.liquid', en.templates['sig.oral.liquid']!, en);
    expect(sig.frequency).toBe(firstFrequency);
  });

  it('only fills the slots the template actually declares', () => {
    // `sig.stat` is a single dose: giving it a duration would render a
    // sentence the template cannot produce.
    const en = packs.en;
    const stat = specimenSig('sig.stat', en.templates['sig.stat']!, en);
    expect(stat.duration).toBeUndefined();
    const liquid = specimenSig('sig.oral.liquid', en.templates['sig.oral.liquid']!, en);
    expect(liquid.duration).toBeDefined();
  });

  it('picks a dose unit that suits the template', () => {
    const en = packs.en;
    expect(specimenSig('sig.oral.solid', en.templates['sig.oral.solid']!, en).dose.unit).toBe(
      'tablet',
    );
    expect(specimenSig('sig.oral.liquid', en.templates['sig.oral.liquid']!, en).dose.unit).toBe(
      'ml',
    );
  });

  it('carries the pluralisation through, so "1 tablet" is not "1 tablets"', () => {
    const out = byLocale(renderSigTemplate('sig.oral.solid', packs));
    expect(out['en']?.plain).toContain('1 tablet');
    expect(out['en']?.plain).not.toContain('1 tablets');
  });

  it('shows a hole rather than hiding one', () => {
    // A template asking for a slot the pack does not define must render
    // visibly incomplete -- that is the failure the preview exists to surface.
    const broken: PackRegistry = structuredClone(packs);
    broken.en.templates['sig.broken'] = 'Give {dose} {nonsense}';
    broken['ur-PK'].templates['sig.broken'] = 'دیں {dose} {nonsense}';
    const out = byLocale(renderSigTemplate('sig.broken', broken));
    expect(out['en']?.complete).toBe(false);
    expect(out['en']?.missing).toContain('nonsense');
  });

  it('reports a locale that was never written, rather than borrowing the other', () => {
    const half: PackRegistry = structuredClone(packs);
    delete half['ur-PK'].templates['sig.oral.liquid'];
    const out = byLocale(renderSigTemplate('sig.oral.liquid', half));
    expect(out['ur-PK']?.complete).toBe(false);
    expect(out['ur-PK']?.plain).toBe('');
    // The English is unaffected: one missing locale is not a reason to hide
    // the one that IS written.
    expect(out['en']?.complete).toBe(true);
  });
});

describe('advice, previewed', () => {
  it('renders every tier-1 line the pack offers, in both locales', () => {
    for (const id of paediatrics.advicePacks.tier1) {
      const out = byLocale(renderAdviceTemplate(id, packs));
      expect(out['en']?.plain.trim().length, `${id} en`).toBeGreaterThan(0);
      expect(out['ur-PK']?.plain.trim().length, `${id} ur-PK`).toBeGreaterThan(0);
    }
  });

  it('renders every red flag the pack offers, in both locales', () => {
    for (const id of paediatrics.advicePacks.tier2) {
      const out = byLocale(renderRedFlag(id, packs));
      expect(out['en']?.plain.trim().length, `${id} en`).toBeGreaterThan(0);
      expect(out['ur-PK']?.plain.trim().length, `${id} ur-PK`).toBeGreaterThan(0);
      expect(out['ur-PK']?.plain, `${id} ur-PK`).toMatch(/[؀-ۿ]/);
    }
  });

  it('fills a tier-1 numeric slot so the sentence reads as a sentence', () => {
    // `advice.return_if_fever_persists` takes {n} days. Unfilled it would
    // render with a gap where the number goes.
    const out = byLocale(renderAdviceTemplate('advice.return_if_fever_persists', packs));
    expect(out['en']?.plain).toMatch(/\d/);
    expect(out['en']?.plain).not.toContain('{');
  });

  it('says so when a red flag is missing in a locale', () => {
    const half: PackRegistry = structuredClone(packs);
    const id = paediatrics.advicePacks.tier2[0]!;
    delete half['ur-PK'].advice.tier2[id];
    const out = byLocale(renderRedFlag(id, half));
    expect(out['ur-PK']?.complete).toBe(false);
  });
});

describe('signing off tier-1 wording', () => {
  const wordingOf = (pack: PackRegistry) => (id: string) =>
    redFlagWording(['en', 'ur-PK'].map((l) => pack[l as 'en'].advice.tier1[id] ?? ''));

  it('reports a line nobody has read', () => {
    // The shipped pack's Urdu is a first draft awaiting review, so every line
    // is unreviewed -- which is what this reports, rather than pretending.
    const out = unreviewedAdvice(paediatrics, wordingOf(packs));
    expect(out.length).toBe(paediatrics.advicePacks.tier1.length);
    expect(out.every((o) => o.reason === 'never-reviewed')).toBe(true);
  });

  it('accepts a signed line, and notices when the wording moves under it', () => {
    const id = paediatrics.advicePacks.tier1[0]!;
    const signed = {
      ...paediatrics,
      adviceReview: {
        [id]: { reviewedBy: 'Dr A', date: '2026-01-01', wording: wordingOf(packs)(id) },
      },
    };
    expect(unreviewedAdvice(signed, wordingOf(packs)).some((o) => o.id === id)).toBe(false);

    // A sign-off is on a SENTENCE, not on an id. Editing the wording after it
    // was read has to invalidate it, or the signature means nothing.
    const edited: PackRegistry = structuredClone(packs);
    edited['ur-PK'].advice.tier1[id] = 'something else entirely';
    const stale = unreviewedAdvice(signed, wordingOf(edited));
    expect(stale.find((o) => o.id === id)?.reason).toBe('wording-changed');
  });

  it('never blocks export, unlike a red flag', () => {
    // Deliberate: tier-1 prose deserves a name on it, but making every
    // existing pack un-exportable would turn this into something authors
    // route around rather than use.
    const errors = packErrors(paediatrics).filter((i) => i.where.startsWith('advicePacks.tier1'));
    expect(errors).toEqual([]);
  });

  it('survives a round trip through the pack file', () => {
    // packFile handles the review maps explicitly; a new one that is not
    // listed there is silently discarded on a sectional import.
    const id = paediatrics.advicePacks.tier1[0]!;
    const review = { reviewedBy: 'Dr A', date: '2026-01-01', wording: 'abc' };
    const withReview = { ...paediatrics, adviceReview: { [id]: review } };
    const parsed = parsePackFile(serialisePack(withReview, packs, false, 'advice'));
    expect(parsed.pack.adviceReview?.[id]).toEqual(review);
    // And the section export drops it when the section is not advice, rather
    // than leaking a review into a formulary-only file.
    const formularyOnly = parsePackFile(serialisePack(withReview, packs, false, 'formulary'));
    expect(formularyOnly.pack.adviceReview).toBeUndefined();
  });
});
