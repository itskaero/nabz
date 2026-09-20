/**
 * The publish diff.
 *
 * The builder autosaved a draft and then published it on one button, and
 * nothing anywhere said what was about to become live. After an afternoon of
 * editing — or after a sectional import that replaced a whole formulary —
 * that is a lot to take on trust.
 *
 * What matters most here is the `patientFacing` count. An edited formulary row
 * is recoverable; a quietly altered red flag is the thing this app exists not
 * to do quietly, and the two must not be presented as the same kind of change.
 */
import { describe, expect, it } from 'vitest';
import { packs } from '@data/phrases/index.ts';
import { paediatrics } from '@data/packs/index.ts';
import type { ContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { diffPack } from '@render/screen/builder/diff.ts';

const live = () => ({ pack: paediatrics, phrases: packs });
const fork = () => ({
  pack: structuredClone(paediatrics) as ContentPack,
  phrases: structuredClone(packs) as PackRegistry,
});

const find = (d: ReturnType<typeof diffPack>, section: string) =>
  d.sections.find((s) => s.section === section);

describe('nothing changed', () => {
  it('reports nothing', () => {
    const d = diffPack(live(), live());
    expect(d.total).toBe(0);
    expect(d.patientFacing).toBe(0);
    expect(d.sections).toEqual([]);
  });

  it('is not fooled by a deep copy', () => {
    // A structuredClone of the whole pack is a different object graph with
    // identical content; a diff comparing by reference would report everything.
    expect(diffPack(live(), fork()).total).toBe(0);
  });
});

describe('the formulary', () => {
  it('notices a medicine added', () => {
    const after = fork();
    after.pack.formularySeed.push({
      brand: 'Newthing', generic: 'newgeneric', provenance: 'manual',
    });
    const section = find(diffPack(live(), after), 'Medicines');
    expect(section?.changes).toEqual([{ kind: 'added', label: 'Newthing' }]);
  });

  it('notices a medicine removed', () => {
    const after = fork();
    const gone = after.pack.formularySeed[0]!.brand;
    after.pack.formularySeed.splice(0, 1);
    const section = find(diffPack(live(), after), 'Medicines');
    expect(section?.changes).toEqual([{ kind: 'removed', label: gone }]);
  });

  it('notices a medicine edited', () => {
    const after = fork();
    after.pack.formularySeed[0]!.strength = '999mg';
    const section = find(diffPack(live(), after), 'Medicines');
    expect(section?.changes[0]?.kind).toBe('changed');
  });

  it('does not count a formulary edit as patient-facing', () => {
    // The doctor reads the formulary while prescribing; the patient never
    // sees it. Only what prints in the patient block counts.
    const after = fork();
    after.pack.formularySeed[0]!.strength = '999mg';
    const d = diffPack(live(), after);
    expect(d.total).toBe(1);
    expect(d.patientFacing).toBe(0);
  });
});

describe('what a patient reads', () => {
  it('counts an edited red flag as patient-facing', () => {
    const after = fork();
    const id = paediatrics.advicePacks.tier2[0]!;
    after.phrases['ur-PK'].advice.tier2[id] = 'different wording';
    const d = diffPack(live(), after);
    expect(d.patientFacing).toBe(1);
    expect(find(d, 'Red flags (ur-PK)')?.changes[0]).toEqual({
      kind: 'changed',
      label: id,
      detail: 'ur-PK',
    });
  });

  it('counts an edited instruction sentence', () => {
    const after = fork();
    after.phrases.en.templates['sig.oral.liquid'] = 'Take {dose}';
    expect(diffPack(live(), after).patientFacing).toBe(1);
  });

  it('counts a slot word, which is a sentence fragment a patient reads', () => {
    const after = fork();
    const slot = Object.keys(after.phrases['ur-PK'].vocab)[0]!;
    const entry = Object.keys(after.phrases['ur-PK'].vocab[slot]!)[0]!;
    after.phrases['ur-PK'].vocab[slot]![entry] = 'changed';
    const d = diffPack(live(), after);
    expect(d.patientFacing).toBe(1);
    expect(find(d, 'Slot words (ur-PK)')?.changes[0]?.detail).toContain(slot);
  });

  it('separates the two locales rather than lumping them', () => {
    // Editing the English and not the Urdu is the commonest way a pack drifts
    // out of step, and a diff that said "advice: 1 changed" would hide it.
    const after = fork();
    const id = paediatrics.advicePacks.tier1[0]!;
    after.phrases.en.advice.tier1[id] = 'only the English moved';
    const d = diffPack(live(), after);
    expect(find(d, 'Advice (en)')?.changes).toHaveLength(1);
    expect(find(d, 'Advice (ur-PK)')).toBeUndefined();
  });
});

describe('sign-offs', () => {
  it('reports a cleared sign-off as its own change', () => {
    // Not a change to any wording -- the wording's REVIEW falling away, which
    // is easy to do by accident and invisible in a list of edited phrases.
    const id = paediatrics.advicePacks.tier2[0]!;
    const before = {
      pack: {
        ...paediatrics,
        redFlagReview: { [id]: { reviewedBy: 'Dr A', date: '2026-01-01', wording: 'x' } },
      },
      phrases: packs,
    };
    const d = diffPack(before, live());
    const section = find(d, 'Sign-offs');
    expect(section?.changes).toEqual([
      { kind: 'removed', label: id, detail: 'red flag sign-off cleared' },
    ]);
    expect(d.patientFacing).toBe(1);
  });

  it('says nothing when a sign-off is simply added', () => {
    const id = paediatrics.advicePacks.tier1[0]!;
    const after = {
      pack: {
        ...paediatrics,
        adviceReview: { [id]: { reviewedBy: 'Dr A', date: '2026-01-01', wording: 'x' } },
      },
      phrases: packs,
    };
    expect(find(diffPack(live(), after), 'Sign-offs')).toBeUndefined();
  });
});

describe('the rest of the pack', () => {
  it('notices an exam chip, and says which system it belongs to', () => {
    const after = fork();
    const systemId = Object.keys(after.pack.findingsPalette)[0]!;
    after.pack.findingsPalette[systemId]!.push({ id: 'newchip', label: 'New chip' });
    const section = find(diffPack(live(), after), 'Examination chips');
    expect(section?.changes).toEqual([
      { kind: 'added', label: 'New chip', detail: systemId },
    ]);
  });

  it('notices an investigation, and says which category', () => {
    const after = fork();
    const categoryId = Object.keys(after.pack.labsPalette)[0]!;
    after.pack.labsPalette[categoryId]!.push({ id: 'newlab', label: 'New test' });
    expect(find(diffPack(live(), after), 'Investigations')?.changes[0]).toEqual({
      kind: 'added',
      label: 'New test',
      detail: categoryId,
    });
  });

  it('notices a dosing row, keyed so two bands of one generic stay distinct', () => {
    // `dosing` is keyed by generic + indication + age band: two rows for one
    // generic are two rows, and an edit to one must not read as a removal.
    const after = fork();
    const row = structuredClone(after.pack.dosing[0]!);
    row.ageBand = { label: 'a band that did not exist' };
    after.pack.dosing.push(row);
    const section = find(diffPack(live(), after), 'Cited doses');
    expect(section?.changes).toEqual([{ kind: 'added', label: row.generic }]);
  });

  it('adds up everything it found', () => {
    const after = fork();
    after.pack.formularySeed.push({ brand: 'A', generic: 'a', provenance: 'manual' });
    after.phrases.en.templates['sig.oral.liquid'] = 'changed';
    const d = diffPack(live(), after);
    expect(d.total).toBe(2);
    expect(d.patientFacing).toBe(1);
  });
});
