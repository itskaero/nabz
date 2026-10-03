/**
 * The background history.
 *
 * The rule worth testing is the one that is easy to get wrong in the direction
 * that loses data: an age band hides a QUESTION and must never hide an ANSWER.
 * A child crossing a birthday and finding their birth history gone from the
 * chart -- still on disk, invisible -- is worse than deleting it, because
 * nobody finds out.
 */
import { describe, expect, it } from 'vitest';
import type { HistorySectionDefinition } from '@domain/pack.ts';
import {
  answerKey,
  historyProgress,
  inBand,
  resolveSections,
  setAnswer,
  summarise,
  toggleChip,
} from '@domain/history.ts';
import { paediatrics } from '@data/packs/index.ts';
import { validateContentPack } from '@domain/pack.ts';

const NOW = '2026-09-20T10:00:00.000Z';

const BIRTH: HistorySectionDefinition = {
  id: 'birth',
  label: 'Birth',
  order: 1,
  appliesTo: { toDays: 365 },
  fields: [
    { id: 'place', label: 'Place', kind: 'choice', options: ['Hospital', 'Home'] },
    { id: 'weight', label: 'Birth weight', kind: 'number', unit: 'kg' },
  ],
};

const FAMILY: HistorySectionDefinition = {
  id: 'family',
  label: 'Family',
  order: 2,
  fields: [{ id: 'consang', label: 'Parents related' }],
};

describe('age bands', () => {
  it('does not ask about birth at five years old', () => {
    const out = resolveSections([BIRTH, FAMILY], {}, 1826);
    expect(out.map((r) => r.section.id)).toEqual(['family']);
  });

  it('still shows it when it already holds an answer', () => {
    const answers = setAnswer({}, 'birth', 'place', 'Hospital', NOW);
    const out = resolveSections([BIRTH, FAMILY], answers, 1826);
    expect(out.map((r) => r.section.id)).toEqual(['birth', 'family']);
    expect(out[0]?.outsideBand).toBe(true);
  });

  it('asks anyway when the age is unknown', () => {
    // A walk-in whose mother does not know the date of birth still has a birth
    // history. Not knowing a birthday is not a reason to stop asking.
    expect(inBand({ toDays: 365 }, undefined)).toBe(true);
    expect(resolveSections([BIRTH], {}, undefined)).toHaveLength(1);
  });

  it('sorts by the order the pack declared', () => {
    expect(resolveSections([FAMILY, BIRTH], {}, 10).map((r) => r.section.id)).toEqual([
      'birth',
      'family',
    ]);
  });
});

describe('answers', () => {
  it('counts what is filled, per section and overall', () => {
    const answers = setAnswer({}, 'birth', 'place', 'Hospital', NOW);
    const out = resolveSections([BIRTH, FAMILY], answers, 10);
    expect(out[0]).toMatchObject({ filled: 1, total: 2 });
    expect(historyProgress(out)).toEqual({ filled: 1, total: 3 });
  });

  it('removes the key when an answer is cleared, rather than storing ""', () => {
    // "Has anyone answered this" has to stay a question about whether the key
    // exists. A blanked field must not read as a recorded negative.
    const one = setAnswer({}, 'birth', 'place', 'Hospital', NOW);
    expect(Object.keys(one)).toEqual([answerKey('birth', 'place')]);
    expect(Object.keys(setAnswer(one, 'birth', 'place', '  ', NOW))).toEqual([]);
  });

  it('dates every answer', () => {
    const a = setAnswer({}, 'birth', 'place', 'Hospital', NOW);
    expect(a['birth.place']?.notedOn).toBe('2026-09-20');
  });

  it('toggles a chip on and off', () => {
    let a = toggleChip({}, 'birth', 'nicu', 'Jaundice', NOW);
    a = toggleChip(a, 'birth', 'nicu', 'Sepsis', NOW);
    expect(a['birth.nicu']?.value).toEqual(['Jaundice', 'Sepsis']);
    a = toggleChip(a, 'birth', 'nicu', 'Jaundice', NOW);
    expect(a['birth.nicu']?.value).toEqual(['Sepsis']);
    // Emptying the last chip removes the key, same as clearing a text field.
    a = toggleChip(a, 'birth', 'nicu', 'Sepsis', NOW);
    expect(a['birth.nicu']).toBeUndefined();
  });

  it('summarises only what was answered, with its unit', () => {
    const a = setAnswer({}, 'birth', 'weight', '2.4', NOW);
    expect(summarise(BIRTH, a)).toEqual([
      { field: BIRTH.fields[1], text: '2.4 kg', notedOn: '2026-09-20' },
    ]);
  });
});

describe('a pack with no history', () => {
  it('resolves to nothing rather than throwing', () => {
    expect(resolveSections(undefined, {}, 100)).toEqual([]);
    expect(historyProgress([])).toEqual({ filled: 0, total: 0 });
  });
});

describe('the validator', () => {
  const base = { ...paediatrics };

  it('accepts the paediatric history as shipped', () => {
    const errors = validateContentPack(base).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('rejects a duplicate field id', () => {
    const broken = {
      ...base,
      historySections: [
        { id: 's', label: 'S', fields: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] },
      ],
    };
    expect(
      validateContentPack(broken).some((i) => i.message === 'duplicate history field id'),
    ).toBe(true);
  });

  it('rejects a choice with nothing to choose', () => {
    const broken = {
      ...base,
      historySections: [
        { id: 's', label: 'S', fields: [{ id: 'a', label: 'A', kind: 'choice' as const }] },
      ],
    };
    expect(validateContentPack(broken).some((i) => /no options/.test(i.message))).toBe(true);
  });

  it('rejects an age band that matches nobody', () => {
    const broken = {
      ...base,
      historySections: [
        { id: 's', label: 'S', appliesTo: { fromDays: 365, toDays: 30 }, fields: [] },
      ],
    };
    expect(validateContentPack(broken).some((i) => /inside out/.test(i.message))).toBe(true);
  });
});

describe('the paediatric questionnaire as shipped', () => {
  it('asks about the things a paediatric history is made of', () => {
    const ids = (paediatrics.historySections ?? []).map((s) => s.id);
    expect(ids).toContain('antenatal');
    expect(ids).toContain('birth');
    expect(ids).toContain('feeding');
    expect(ids).toContain('family');
  });

  it('has no required field anywhere, because a history is never a gate', () => {
    // There is no `required` in the type and this is the test that keeps it
    // out: a questionnaire standing between a doctor and a prescription is one
    // that gets abandoned halfway (PRODUCT.md 16).
    for (const section of paediatrics.historySections ?? []) {
      for (const field of section.fields) {
        expect(field).not.toHaveProperty('required');
      }
    }
  });

  it('stops asking about weaning at twelve years', () => {
    const atTwelve = resolveSections(paediatrics.historySections, {}, 4383).map((r) => r.section.id);
    expect(atTwelve).not.toContain('feeding');
    expect(atTwelve).toContain('family');
  });
});

describe('a pack round-trip through the builder', () => {
  it('carries the history, rather than silently dropping it', async () => {
    // packFile's own comment says a field added to ContentPack later is
    // excluded from a slice by default. That is the safe direction, and it is
    // also why this test exists: without a 'history' case the slice would
    // export a pack whose questionnaire had quietly vanished.
    const { sliceForExport, mergeSection } = await import(
      '@render/screen/builder/packFile.ts'
    );
    const { packs } = await import('@data/phrases/index.ts');

    const whole = sliceForExport(paediatrics, packs, 'all');
    expect(whole.pack.historySections?.length).toBe(paediatrics.historySections?.length);

    const slice = sliceForExport(paediatrics, packs, 'history');
    expect(slice.pack.historySections?.length).toBe(paediatrics.historySections?.length);
    // The slice carries ONLY its own section.
    expect(slice.pack.examSystems).toEqual([]);
    expect(slice.pack.formularySeed).toEqual([]);

    const examSlice = sliceForExport(paediatrics, packs, 'exam');
    expect(examSlice.pack.historySections).toBeUndefined();

    // And importing it back lands the questionnaire where it came from.
    const blank = { ...paediatrics };
    delete (blank as { historySections?: unknown }).historySections;
    const merged = mergeSection(
      { pack: blank, phrases: packs },
      { pack: paediatrics, phrases: packs },
      'history',
    );
    expect(merged.pack.historySections?.map((s) => s.id)).toEqual(
      (paediatrics.historySections ?? []).map((s) => s.id),
    );
  });
});
