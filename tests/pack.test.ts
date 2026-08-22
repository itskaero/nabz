/**
 * Content-pack and data-integrity suite.
 *
 * The headline test is `every dosing row carries a citation`: CLAUDE.md 8a
 * requires a check that FAILS THE BUILD if any dosing row has an empty
 * reference. It is here, and it is the reason a dose can never quietly appear
 * in this app without a source attached to it.
 */
import { describe, expect, it } from 'vitest';
import { paediatrics, contentPacks, packIndex } from '@data/packs/index.ts';
import { packs } from '@data/phrases/index.ts';
import { validateContentPack } from '@domain/pack.ts';

describe('paediatrics pack', () => {
  it('is structurally valid', () => {
    const errors = validateContentPack(paediatrics).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('every dosing row carries a non-empty citation', () => {
    for (const row of paediatrics.dosing) {
      expect(row.reference.trim(), `${row.generic} has no reference`).not.toBe('');
      expect(row.reference.length).toBeGreaterThan(10);
    }
  });

  it('cites only openly licensed sources in the shipped seed', () => {
    // Consult-and-cite applies to BNFC/Nelson/Harriet Lane/Lexicomp/Micromedex:
    // a clinician authors those entries. Nothing transcribed in bulk from them
    // may ship in the repo.
    const licensed = /BNFC|BNF for Children|Nelson|Harriet Lane|Lexicomp|Micromedex/i;
    for (const row of paediatrics.dosing) {
      expect(licensed.test(row.reference), `${row.generic} cites a licensed source`).toBe(false);
    }
  });

  it('ships every dosing row as unverified until a clinician signs it off', () => {
    for (const row of paediatrics.dosing) {
      expect(row.verified).toBe(false);
    }
  });

  it('keeps catalogue and evidence in separate tables joined on generic', () => {
    const { dosingByGeneric } = packIndex(paediatrics);
    const paracetamolBrands = paediatrics.formularySeed.filter(
      (f) => f.generic === 'Paracetamol',
    );
    expect(paracetamolBrands.length).toBeGreaterThan(1);
    // one evidence row serves every brand of that generic
    expect(dosingByGeneric.get('paracetamol')?.length).toBe(1);
  });

  it('claims no DRAP provenance it cannot back with a registration number', () => {
    for (const row of paediatrics.formularySeed) {
      if (row.provenance === 'DRAP') expect(row.drapRegNo).toBeTruthy();
    }
  });

  it('carries no dosage text from the catalogue side', () => {
    for (const row of paediatrics.formularySeed) {
      expect(Object.keys(row)).not.toContain('dosage');
      expect(Object.keys(row)).not.toContain('mgPerKg');
    }
  });

  it('seeds roughly the promised number of real brands', () => {
    expect(paediatrics.formularySeed.length).toBeGreaterThanOrEqual(140);
    expect(paediatrics.formularySeed.length).toBeLessThan(400);
  });

  it('offers only sig templates the locale packs actually define', () => {
    for (const id of paediatrics.sigTemplates) {
      expect(packs.en.templates[id], `en missing ${id}`).toBeDefined();
      expect(packs['ur-PK'].templates[id], `ur-PK missing ${id}`).toBeDefined();
    }
  });

  it('offers only advice ids the locale packs actually define', () => {
    for (const id of paediatrics.advicePacks.tier1) {
      expect(packs.en.advice.tier1[id], `en missing ${id}`).toBeDefined();
      expect(packs['ur-PK'].advice.tier1[id], `ur-PK missing ${id}`).toBeDefined();
    }
    for (const id of paediatrics.advicePacks.tier2) {
      expect(packs.en.advice.tier2[id], `en missing ${id}`).toBeDefined();
      expect(packs['ur-PK'].advice.tier2[id], `ur-PK missing ${id}`).toBeDefined();
    }
  });

  it('enables the growth module and configures it', () => {
    expect(paediatrics.modules).toContain('growth');
    expect(paediatrics.moduleConfig?.growth?.defaultReference).toBe('WHO');
  });

  it('does not chip-ify diagnosis', () => {
    // Diagnosis is judgement; chips push click-convenience over it (PRODUCT.md 8).
    expect(Object.keys(paediatrics.findingsPalette)).not.toContain('diagnosis');
  });
});

describe('pack registry', () => {
  it('ships exactly one pack in v1', () => {
    expect(Object.keys(contentPacks)).toEqual(['paediatrics']);
  });
});
