/**
 * The priority suite (CLAUDE.md 4, 11).
 *
 * These tests exist because the bugs they catch are dosing errors, not display
 * glitches: a plural that reads "1 days", an Urdu sentence that is secretly the
 * English one reversed, a dose that jumps sides inside an RTL line. Everything
 * here runs without React, a DOM, or IndexedDB.
 */
import { describe, expect, it } from 'vitest';
import { packs } from '@data/phrases/index.ts';
import { composePatientLine, composeSig, weeklyOnlyViolation } from '@domain/sig.ts';
import { toPlainText } from '@domain/text.ts';
import { isolatesBalanced, LRI, PDI, stripIsolates } from '@domain/bidi.ts';
import { templateSlots, validatePacks } from '@domain/phrases.ts';
import type { MedicationLine } from '@domain/prescription.ts';
import { medicine, phrasesForShippedPack } from '@data/packs/index.ts';

const amoxil = (over: Partial<MedicationLine['sig']> = {}): MedicationLine => ({
  id: 'm1',
  drug: { brand: 'Amoxil', generic: 'Amoxicillin', strength: '250mg', form: 'syrup' },
  sig: {
    templateId: 'sig.oral.liquid',
    dose: { value: 5, unit: 'ml' },
    frequency: 'TID',
    timing: 'after_food',
    duration: { value: 5, unit: 'day' },
    slots: { administer: 'give' },
    ...over,
  },
});

describe('pack integrity', () => {
  it('has no cross-locale errors', () => {
    const problems = validatePacks(packs).filter((p) => p.severity === 'error');
    expect(problems).toEqual([]);
  });

  it('declares the same printed labels in every locale', () => {
    const enKeys = Object.keys(packs.en.strings).sort();
    const urKeys = Object.keys(packs['ur-PK'].strings).sort();
    expect(urKeys).toEqual(enKeys);
  });
});

describe('English composition', () => {
  it('composes a full liquid sig', () => {
    const out = composeSig(amoxil(), 'en', packs);
    expect(out.complete).toBe(true);
    expect(toPlainText(out)).toBe('Give 5 ml three times a day after food for 5 days');
  });

  it('drops an optional group with its own particle when the slot is empty', () => {
    const line = amoxil();
    delete line.sig.duration;
    delete line.sig.timing;
    const out = composeSig(line, 'en', packs);
    // no dangling "for", no doubled spaces
    expect(toPlainText(out)).toBe('Give 5 ml three times a day');
    expect(out.complete).toBe(true);
  });

  it('reports missing required slots instead of inventing them', () => {
    const line = amoxil({ frequency: 'NOT_A_FREQUENCY' });
    const out = composeSig(line, 'en', packs);
    expect(out.complete).toBe(false);
    expect(out.missing).toContain('frequency');
  });
});

describe('pluralisation', () => {
  it('English: 1 day vs 5 days', () => {
    const one = composeSig(amoxil({ duration: { value: 1, unit: 'day' } }), 'en', packs);
    const many = composeSig(amoxil({ duration: { value: 5, unit: 'day' } }), 'en', packs);
    expect(toPlainText(one)).toContain('for 1 day');
    expect(toPlainText(one)).not.toContain('1 days');
    expect(toPlainText(many)).toContain('for 5 days');
  });

  it('English: a non-integer count is never "one"', () => {
    const out = composeSig(amoxil({ dose: { value: 1.5, unit: 'tablet' } }), 'en', packs);
    expect(toPlainText(out)).toContain('1.5 tablets');
  });

  it('Urdu: 1 دن and 5 دن -- the day noun does not inflect', () => {
    const one = composeSig(amoxil({ duration: { value: 1, unit: 'day' } }), 'ur-PK', packs);
    const many = composeSig(amoxil({ duration: { value: 5, unit: 'day' } }), 'ur-PK', packs);
    expect(stripIsolates(one.plain)).toContain('1 دن');
    expect(stripIsolates(many.plain)).toContain('5 دن');
  });

  it('Urdu: the tablet noun DOES inflect, so the two forms differ', () => {
    const one = composeSig(
      amoxil({ templateId: 'sig.oral.solid', dose: { value: 1, unit: 'tablet' } }),
      'ur-PK',
      packs,
    );
    const many = composeSig(
      amoxil({ templateId: 'sig.oral.solid', dose: { value: 3, unit: 'tablet' } }),
      'ur-PK',
      packs,
    );
    expect(stripIsolates(one.plain)).toContain('گولی');
    expect(stripIsolates(many.plain)).toContain('گولیاں');
    // and the categories are genuinely distinguished, not accidentally equal
    expect(packs['ur-PK'].units.tablet!.one).not.toBe(packs['ur-PK'].units.tablet!.other);
  });

  it('float dust never reaches a dose', () => {
    const out = composeSig(amoxil({ dose: { value: 0.1 + 0.2, unit: 'ml' } }), 'en', packs);
    expect(toPlainText(out)).toContain('0.3 ml');
  });
});

describe('Urdu word order is authored, not derived', () => {
  it('puts duration first and the verb last', () => {
    const out = composeSig(amoxil(), 'ur-PK', packs);
    const text = stripIsolates(out.plain);
    expect(out.complete).toBe(true);
    // duration leads
    expect(text.indexOf('5 دن')).toBe(0);
    // verb trails
    expect(text.endsWith('دیں')).toBe(true);
    // and the timing phrase precedes the frequency phrase, unlike English
    expect(text.indexOf('کھانے کے بعد')).toBeLessThan(text.indexOf('دن میں تین بار'));
  });

  it('is NOT a token reversal of the English sentence', () => {
    const enText = toPlainText(composeSig(amoxil(), 'en', packs));
    const urText = stripIsolates(composeSig(amoxil(), 'ur-PK', packs).plain);

    const enSlots = ['5 ml', 'three times a day', 'after food', '5 days'];
    const urSlots = ['5 ml', 'دن میں تین بار', 'کھانے کے بعد', '5 دن'];
    const enOrder = enSlots.map((s) => enText.indexOf(s));
    const urOrder = urSlots.map((s) => urText.indexOf(s));

    const rank = (xs: number[]) =>
      xs.map((x) => xs.filter((y) => y < x).length).join('');
    // If Urdu were built by reversing English, its slot ranking would be the
    // exact mirror of English's. Assert it is not.
    expect(rank(urOrder)).not.toBe(rank(enOrder).split('').reverse().join(''));
    // ...and that the orders genuinely differ at all.
    expect(rank(urOrder)).not.toBe(rank(enOrder));
  });

  it('templates declare the same slot set in both locales', () => {
    for (const id of Object.keys(packs.en.templates)) {
      expect(templateSlots(packs.en.templates[id]!)).toEqual(
        templateSlots(packs['ur-PK'].templates[id]!),
      );
    }
  });

  it('but never the same STRING in both locales', () => {
    for (const id of Object.keys(packs.en.templates)) {
      expect(packs['ur-PK'].templates[id]).not.toBe(packs.en.templates[id]);
    }
  });
});

describe('bidi safety', () => {
  it('keeps "Amoxil 250mg" intact inside an Urdu line', () => {
    const out = composePatientLine(amoxil(), 'ur-PK', packs);
    const raw = out.plain;

    // the whole Latin name+strength travels as ONE isolated island
    expect(raw).toContain(LRI + 'Amoxil (Amoxicillin) 250mg' + PDI);
    expect(stripIsolates(raw)).toContain('Amoxil (Amoxicillin) 250mg');
    expect(isolatesBalanced(raw)).toBe(true);
  });

  it('isolates the dose number so the unit cannot be dragged off it', () => {
    const out = composeSig(amoxil(), 'ur-PK', packs);
    expect(out.plain).toContain(LRI + '5' + PDI);
    // the Urdu unit noun sits immediately after the isolated number
    expect(stripIsolates(out.plain)).toContain('5 ملی لیٹر');
    expect(isolatesBalanced(out.plain)).toBe(true);
  });

  it('does not isolate anything in an all-LTR English line', () => {
    const out = composeSig(amoxil(), 'en', packs);
    expect(out.plain).toBe(stripIsolates(out.plain));
  });

  it('marks the dose as a clinical value so print can set it in mono', () => {
    const out = composeSig(amoxil(), 'ur-PK', packs);
    const value = out.runs.find((r) => r.kind === 'value');
    expect(value?.text).toBe('5');
    expect(value?.dir).toBe('ltr');
  });
});

describe('graceful degradation', () => {
  it('an unknown drug still composes a full sig', () => {
    const line: MedicationLine = {
      id: 'm2',
      drug: { raw: 'Some Unlisted Brand 5mg' },
      sig: {
        templateId: 'sig.oral.solid',
        dose: { value: 1, unit: 'tablet' },
        frequency: 'BID',
        duration: { value: 3, unit: 'day' },
        slots: { administer: 'take' },
      },
    };
    expect(toPlainText(composeSig(line, 'en', packs))).toBe(
      'Take 1 tablet twice a day for 3 days',
    );
    expect(composeSig(line, 'ur-PK', packs).complete).toBe(true);
  });

  it('an unknown unit prints verbatim rather than vanishing', () => {
    const out = composeSig(amoxil({ dose: { value: 2, unit: 'scoops' } }), 'en', packs);
    expect(toPlainText(out)).toContain('2 scoops');
  });

  it('a PRN sig carries its 24-hour ceiling in both locales', () => {
    const line = amoxil({
      templateId: 'sig.prn',
      dose: { value: 5, unit: 'ml' },
      frequency: 'Q6H',
      max: { value: 4, unit: 'dose' },
    });
    expect(toPlainText(composeSig(line, 'en', packs))).toBe(
      'Give 5 ml when needed, every 6 hours - no more than 4 doses in 24 hours',
    );
    const ur = stripIsolates(composeSig(line, 'ur-PK', packs).plain);
    expect(ur).toContain('زیادہ سے زیادہ 4 خوراکیں');
  });
});

describe('weeklyOnlyViolation (the once-weekly-methotrexate case)', () => {
  const methotrexateLine = (frequency: string): MedicationLine => ({
    id: 'm3',
    drug: { generic: 'Methotrexate', brand: 'Methotrexate', strength: '2.5mg', form: 'tablet' },
    sig: {
      templateId: 'sig.oral.solid',
      dose: { value: 1, unit: 'tablet' },
      frequency,
      slots: { administer: 'take' },
    },
  });

  const dosingByGeneric = new Map<string, { weeklyOnly?: boolean }[]>([
    ['methotrexate', [{ weeklyOnly: true }]],
    ['paracetamol', [{ weeklyOnly: false }]],
  ]);

  it('refuses a daily frequency for a weekly-only drug', () => {
    const violation = weeklyOnlyViolation(methotrexateLine('OD'), dosingByGeneric);
    expect(violation).toMatch(/ONCE A WEEK|once a week/i);
    expect(violation).toMatch(/Methotrexate/);
  });

  it('is silent once the frequency actually reads "once a week"', () => {
    expect(weeklyOnlyViolation(methotrexateLine('WEEKLY'), dosingByGeneric)).toBeNull();
  });

  it('is silent for a drug that is not flagged weekly-only', () => {
    const paracetamol: MedicationLine = {
      id: 'm4',
      drug: { generic: 'Paracetamol' },
      sig: { templateId: 'sig.oral.solid', dose: { value: 1, unit: 'tablet' }, frequency: 'OD', slots: {} },
    };
    expect(weeklyOnlyViolation(paracetamol, dosingByGeneric)).toBeNull();
  });

  it('the real medicine pack flags methotrexate and leaves other generics alone', () => {
    const index = new Map<string, { weeklyOnly?: boolean }[]>();
    for (const row of medicine.dosing) {
      const key = row.generic.toLowerCase();
      index.set(key, [...(index.get(key) ?? []), row]);
    }
    expect(weeklyOnlyViolation(methotrexateLine('OD'), index)).not.toBeNull();
    expect(weeklyOnlyViolation(methotrexateLine('WEEKLY'), index)).toBeNull();
  });
});

describe('medicine pack: Urdu number placement differs by string, not just by pack', () => {
  it('places {n} at a different word position than the English original', () => {
    const ur = phrasesForShippedPack(medicine.id)['ur-PK'];
    const en = phrasesForShippedPack(medicine.id).en;

    const wordIndexOfSlot = (text: string) =>
      text.split(/\s+/).findIndex((w) => w.includes('{n}'));

    // advice.follow_up_in: English puts the number fourth; Urdu opens with it.
    const enFollowUp = wordIndexOfSlot(en.advice.tier1['advice.follow_up_in']!);
    const urFollowUp = wordIndexOfSlot(ur.advice.tier1['advice.follow_up_in']!);
    expect(urFollowUp).not.toBe(enFollowUp);
    expect(urFollowUp).toBe(0);

    // advice.limit_fluid: the number sits at a different offset in each locale.
    const enLimit = wordIndexOfSlot(en.advice.tier1['advice.limit_fluid']!);
    const urLimit = wordIndexOfSlot(ur.advice.tier1['advice.limit_fluid']!);
    expect(urLimit).not.toBe(enLimit);
  });
});
