/**
 * Investigations.
 *
 * The section exists because a paediatric script without "CBC, CRP, chest
 * X-ray" is incomplete, and putting tests into free-text advice printed them in
 * the patient register instead of as a clinical order.
 *
 * Two properties are worth guarding: the label is frozen at order time, so
 * editing the pack cannot retitle a test on a script already printed; and the
 * section is English-only, because a laboratory technician reads "CBC" and a
 * transliteration would be unusable at the lab.
 */
import { describe, expect, it } from 'vitest';
import type { LabOrder } from '@domain/prescription.ts';
import { emptyPrescription, isBlank } from '@domain/prescription.ts';
import {
  composeLab,
  composeLabs,
  findLab,
  freeLabId,
  isFreeLab,
  labCount,
  setLabValue,
  toggleLab,
} from '@domain/labs.ts';
import { validateContentPack } from '@domain/pack.ts';
import { paediatrics } from '@data/packs/paediatrics.ts';

let seq = 0;
const id = () => `l${++seq}`;

describe('ordering', () => {
  it('toggles a test on and back off', () => {
    let labs: LabOrder[] = [];
    labs = toggleLab(labs, 'cbc', 'CBC', id);
    expect(labs).toHaveLength(1);
    expect(findLab(labs, 'cbc')?.label).toBe('CBC');

    labs = toggleLab(labs, 'cbc', 'CBC', id);
    expect(labs).toHaveLength(0);
  });

  it('has no third state — a test is ordered or it is not', () => {
    // An exam chip cycles through `absent` because a pertinent negative is a
    // clinical claim. There is no "pertinently un-ordered" test, and inventing
    // one would print "no CBC" on a prescription.
    let labs = toggleLab([], 'cbc', 'CBC', id);
    labs = toggleLab(labs, 'cbc', 'CBC', id);
    expect(labs).toEqual([]);
  });

  it('keeps the order the doctor tapped them in', () => {
    let labs: LabOrder[] = [];
    labs = toggleLab(labs, 'cbc', 'CBC', id);
    labs = toggleLab(labs, 'crp', 'CRP', id);
    labs = toggleLab(labs, 'xray_chest', 'Chest X-ray', id);
    // Not sorted: ordering a CBC first usually signals priority.
    expect(composeLabs(labs)).toEqual(['CBC', 'CRP', 'Chest X-ray']);
  });

  it('counts what is ordered', () => {
    const labs = toggleLab(toggleLab([], 'cbc', 'CBC', id), 'crp', 'CRP', id);
    expect(labCount(labs)).toBe(2);
  });
});

describe('several taps before a re-render', () => {
  it('keeps every one, because each reads the previous list', () => {
    // Found in a browser: tapping CBC then Chest X-ray left only the X-ray.
    // The section passed `toggleLab(ordered, ...)` where `ordered` came from
    // the render that was on screen when the chip was tapped, so the second
    // tap overwrote the first -- a silently dropped investigation. `setLabs`
    // now takes an updater, which is what this simulates.
    let state: LabOrder[] = [];
    const setLabs = (update: (prev: LabOrder[]) => LabOrder[]) => {
      state = update(state);
    };
    const stale = state; // what every handler in one render would close over

    setLabs((prev) => toggleLab(prev, 'cbc', 'CBC', id));
    setLabs((prev) => toggleLab(prev, 'crp', 'CRP', id));
    setLabs((prev) => toggleLab(prev, 'xray', 'Chest X-ray', id));

    expect(composeLabs(state)).toEqual(['CBC', 'CRP', 'Chest X-ray']);
    // The bug, spelled out: computing from the captured array loses the rest.
    expect(composeLabs(toggleLab(stale, 'xray', 'Chest X-ray', id))).toEqual(['Chest X-ray']);
  });
});

describe('qualifiers', () => {
  it('appends the qualifier rather than rewriting the label', () => {
    let labs = toggleLab([], 'xray_chest', 'Chest X-ray', id);
    labs = setLabValue(labs, 'xray_chest', 'PA view');
    expect(composeLab(findLab(labs, 'xray_chest')!)).toBe('Chest X-ray PA view');

    // Clearing it must restore the original name, which folding the qualifier
    // into the label would have made impossible.
    labs = setLabValue(labs, 'xray_chest', '');
    expect(composeLab(findLab(labs, 'xray_chest')!)).toBe('Chest X-ray');
    expect(findLab(labs, 'xray_chest')!.value).toBeUndefined();
  });

  it('trims whitespace and ignores a blank qualifier', () => {
    let labs = toggleLab([], 'usg', 'Ultrasound abdomen', id);
    labs = setLabValue(labs, 'usg', '  full bladder  ');
    expect(findLab(labs, 'usg')!.value).toBe('full bladder');
    labs = setLabValue(labs, 'usg', '   ');
    expect(findLab(labs, 'usg')!.value).toBeUndefined();
  });
});

describe('free text', () => {
  it('never blocks — anything typed prints as written', () => {
    const labs = toggleLab([], freeLabId('Serum ceruloplasmin'), 'Serum ceruloplasmin', id);
    expect(composeLabs(labs)).toEqual(['Serum ceruloplasmin']);
    expect(isFreeLab(labs[0]!)).toBe(true);
  });

  it('cannot collide with a palette id', () => {
    expect(freeLabId('CBC')).not.toBe('cbc');
    expect(isFreeLab({ labId: 'cbc' })).toBe(false);
  });
});

describe('the frozen label', () => {
  it('survives the palette being edited afterwards', () => {
    // The pack may be renamed at any time. A script already written must keep
    // the words it was written with -- same reasoning as ExamFinding.label.
    const labs = toggleLab([], 'cbc', 'CBC with ESR', id);
    const renamedPaletteLabel = 'Complete blood count';
    expect(findLab(labs, 'cbc')!.label).toBe('CBC with ESR');
    expect(findLab(labs, 'cbc')!.label).not.toBe(renamedPaletteLabel);
  });
});

describe('the prescription', () => {
  it('starts with no tests and is still blank', () => {
    const rx = emptyPrescription('paediatrics', 'rx1');
    expect(rx.labs).toEqual([]);
    expect(isBlank(rx)).toBe(true);
  });

  it('is no longer blank once a test is ordered', () => {
    const rx = emptyPrescription('paediatrics', 'rx1');
    expect(isBlank({ ...rx, labs: toggleLab([], 'cbc', 'CBC', id) })).toBe(false);
  });
});

describe('the shipped paediatric palette', () => {
  it('validates', () => {
    expect(validateContentPack(paediatrics).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('declares a palette for every category it offers', () => {
    for (const category of paediatrics.labCategories) {
      expect(paediatrics.labsPalette[category.id]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps every test name in English', () => {
    // Urdu script anywhere in a test name would reach a lab technician who
    // cannot act on it.
    for (const labs of Object.values(paediatrics.labsPalette)) {
      for (const lab of labs) expect(lab.label).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it('marks the fasting tests, and only those', () => {
    const fasting = Object.values(paediatrics.labsPalette)
      .flat()
      .filter((l) => l.fasting)
      .map((l) => l.id);
    expect(fasting).toContain('fbs');
    expect(fasting).toContain('lipids');
    expect(fasting).not.toContain('cbc');
  });
});

describe('pack validation', () => {
  const base = () => structuredClone(paediatrics);

  it('rejects a palette for an undeclared category', () => {
    const pack = base();
    pack.labsPalette['ghost'] = [{ id: 'x', label: 'X' }];
    expect(validateContentPack(pack)).toContainEqual(
      expect.objectContaining({ severity: 'error', where: 'labsPalette.ghost' }),
    );
  });

  it('rejects a duplicate test id inside one category', () => {
    const pack = base();
    pack.labsPalette['haem'] = [
      { id: 'cbc', label: 'CBC' },
      { id: 'cbc', label: 'CBC again' },
    ];
    expect(validateContentPack(pack)).toContainEqual(
      expect.objectContaining({ severity: 'error', where: 'haem/cbc' }),
    );
  });

  it('rejects a test with no label', () => {
    const pack = base();
    pack.labsPalette['haem'] = [{ id: 'blank', label: '  ' }];
    expect(validateContentPack(pack)).toContainEqual(
      expect.objectContaining({ severity: 'error', where: 'haem/blank' }),
    );
  });

  it('warns about a category with no tests rather than failing', () => {
    const pack = base();
    pack.labCategories.push({ id: 'empty', label: 'Empty' });
    const issues = validateContentPack(pack);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: 'warning', where: 'labCategories.empty' }),
    );
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});
