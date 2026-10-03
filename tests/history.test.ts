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

describe('immunisation and milestones stay mute', () => {
  it('ships the EPI schedule with a published reference', () => {
    const s = paediatrics.immunisationSchedule!;
    expect(s.reference).toMatch(/EPI/i);
    expect(s.visits.map((v) => v.id)).toEqual(['birth', 'w6', 'w10', 'w14', 'm9', 'm15']);
    expect(s.visits[1]?.atDays).toBe(42);
    expect(s.visits[1]?.doses).toContain('Penta-1');
  });

  it('rejects a schedule with no source, the way a dose with no citation is rejected', () => {
    const broken = { ...paediatrics, immunisationSchedule: { reference: '  ', visits: [] } };
    expect(
      validateContentPack(broken).some((i) => i.message === 'schedule has no reference'),
    ).toBe(true);
  });

  it('counts what is recorded and never what is missing', async () => {
    const { immunisationProgress } = await import('@domain/patientClinical.ts');
    const clinical = {
      patientId: 'p1',
      allergies: [],
      problems: [],
      immunisations: [
        { visitId: 'birth', notedOn: '2026-01-01' },
        { visitId: 'w6', notedOn: '2026-02-12' },
      ],
      updatedAt: NOW,
    };
    const progress = immunisationProgress(clinical, 6);
    // Two recorded out of six. NOT "four overdue" -- a visit absent from the
    // list is a visit nobody wrote down here, and a child may well have had it
    // at a government centre. "Overdue" would be a claim about the world made
    // from the absence of data.
    expect(progress).toEqual({ recorded: 2, total: 6 });
    expect(Object.keys(progress)).toEqual(['recorded', 'total']);
  });

  it('gives milestones a reference age and no verdict', () => {
    const m = paediatrics.milestones!;
    expect(m.reference.length).toBeGreaterThan(0);
    const walks = m.items.find((i) => i.id === 'walks_alone')!;
    expect(walks.typicalByDays).toBe(457);
    // The type carries an age and a domain. There is no "concern", "redFlag"
    // or "delayed" field, and this is the test that keeps it that way.
    expect(Object.keys(walks).sort()).toEqual(['domain', 'id', 'label', 'typicalByDays']);
  });

  it('distinguishes "not yet" from nobody having asked', () => {
    // A blank milestone must never read as a negative finding. That is the
    // difference between a record and an accusation, so "not yet" is a value
    // somebody has to choose.
    const recorded = { itemId: 'walks_alone', notYet: true, notedOn: '2026-09-20' };
    expect(recorded.notYet).toBe(true);
    expect(paediatrics.milestones!.items.some((i) => 'notYet' in i)).toBe(false);
  });
});

describe('the same engine, a different specialty', () => {
  it('ships an adult questionnaire that shares no code with the paediatric one', async () => {
    const { medicine } = await import('@data/packs/index.ts');
    const ids = (medicine.historySections ?? []).map((s) => s.id);
    expect(ids).toEqual(['pmh', 'psh', 'drugs', 'social', 'family', 'obgyn']);
    // No overlap with the paediatric sections at all, which is the point: the
    // engine renders whatever the pack declares.
    const paedIds = new Set((paediatrics.historySections ?? []).map((s) => s.id));
    expect(ids.filter((id) => paedIds.has(id) && id !== 'family')).toEqual([]);
  });

  it('records naswar and paan separately from cigarettes', async () => {
    const { medicine } = await import('@data/packs/index.ts');
    const tobacco = medicine
      .historySections!.find((s) => s.id === 'social')!
      .fields.find((f) => f.id === 'tobacco')!;
    // A single "smoking: yes/no" field makes a naswar user read as having no
    // tobacco history, which is the wrong answer to the question being asked.
    expect(tobacco.options).toEqual(
      expect.arrayContaining(['Cigarettes', 'Huqqa', 'Naswar', 'Paan', 'Gutka']),
    );
    expect(tobacco.kind).toBe('chips');
  });

  it('offers no vaccine or milestone section on an adult pack', async () => {
    const { medicine } = await import('@data/packs/index.ts');
    expect(medicine.immunisationSchedule).toBeUndefined();
    expect(medicine.milestones).toBeUndefined();
  });

  it('validates clean', async () => {
    const { medicine } = await import('@data/packs/index.ts');
    expect(validateContentPack(medicine).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('has no age bands, because adult history does not expire', () => {
    // The paediatric pack bands birth and feeding; nothing in an adult history
    // stops applying, so nothing here carries a band it would never use.
    return import('@data/packs/index.ts').then(({ medicine }) => {
      for (const section of medicine.historySections ?? []) {
        expect(section.appliesTo).toBeUndefined();
      }
    });
  });
});
