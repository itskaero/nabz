/**
 * Allergies as facts, not as a string retyped every visit.
 *
 * The rules worth testing are all about not being clever: nothing is promoted
 * to a durable clinical fact on its own, nothing is overwritten, and an empty
 * list is never reported as "none known" -- someone has to have asked.
 */
import { describe, expect, it } from 'vitest';
import {
  activeProblems,
  adoptTypedAllergies,
  allergyLine,
  emptyClinical,
  hasSevereAllergy,
  isBlank,
} from '@domain/patientClinical.ts';

const NOW = '2026-09-20T10:00:00.000Z';

describe('allergyLine', () => {
  it('says nothing at all when nothing is recorded', () => {
    // NOT "none known". That is a clinical claim, and this function has no
    // way of knowing whether anyone ever asked the question.
    expect(allergyLine(emptyClinical('p1', NOW))).toBe('');
    expect(allergyLine(undefined)).toBe('');
  });

  it('puts the severe one first, because the banner truncates', () => {
    const line = allergyLine({
      ...emptyClinical('p1', NOW),
      allergies: [
        { substance: 'dust', severity: 'mild', notedOn: '2026-01-01' },
        { substance: 'penicillin', reaction: 'anaphylaxis', severity: 'severe', notedOn: '2026-01-02' },
      ],
    });
    expect(line.startsWith('penicillin')).toBe(true);
    expect(line).toBe('penicillin (anaphylaxis), dust');
  });
});

describe('adoptTypedAllergies', () => {
  const base = {
    ...emptyClinical('p1', NOW),
    allergies: [{ substance: 'Penicillin', severity: 'severe' as const, notedOn: '2026-01-02' }],
  };

  it('splits what was typed and keeps what was already known', () => {
    const next = adoptTypedAllergies(base, 'sulfa, dust mite', NOW);
    expect(next.allergies.map((a) => a.substance)).toEqual(['Penicillin', 'sulfa', 'dust mite']);
  });

  it('does not record the same substance twice over spelling', () => {
    const next = adoptTypedAllergies(base, '  penicillin ', NOW);
    expect(next.allergies).toHaveLength(1);
    expect(next).toBe(base); // nothing changed, so nothing was written
  });

  it('records everything new as mild, never guessing severe', () => {
    // A banner that cries wolf is a banner that gets ignored, and nothing in
    // the word "sulfa" says whether this child stopped breathing.
    const next = adoptTypedAllergies(emptyClinical('p1', NOW), 'sulfa', NOW);
    expect(next.allergies[0]?.severity).toBe('mild');
    expect(hasSevereAllergy(next)).toBe(false);
  });

  it('dates what it records', () => {
    const next = adoptTypedAllergies(emptyClinical('p1', NOW), 'sulfa', NOW);
    expect(next.allergies[0]?.notedOn).toBe('2026-09-20');
  });

  it('ignores empty fragments from trailing punctuation', () => {
    const next = adoptTypedAllergies(emptyClinical('p1', NOW), 'sulfa, , ;', NOW);
    expect(next.allergies).toHaveLength(1);
  });
});

describe('problems', () => {
  it('separates what is still going on from what is over', () => {
    const c = {
      ...emptyClinical('p1', NOW),
      problems: [
        { label: 'asthma', status: 'active' as const },
        { label: 'bronchiolitis', status: 'resolved' as const, resolvedOn: '2025-02-01' },
      ],
    };
    expect(activeProblems(c).map((p) => p.label)).toEqual(['asthma']);
  });
});

describe('isBlank', () => {
  it('is the difference between "nobody asked" and "asked, and none"', () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(emptyClinical('p1', NOW))).toBe(true);
    expect(isBlank({ ...emptyClinical('p1', NOW), bloodGroup: 'O+' })).toBe(false);
  });
});
