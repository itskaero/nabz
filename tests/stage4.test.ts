/**
 * Roles, the CSV door, and the sync boundary.
 *
 * The test that matters most here is the last one: what crosses the wire. A
 * two-station clinic is only compatible with PRODUCT.md rule 3.1 if the shared
 * payload carries identity and money and nothing clinical, so that boundary is
 * asserted rather than assumed.
 */
import { describe, expect, it } from 'vitest';
import { canAccess, checkPin, hasPin, openGate, recordUnlock, setPin } from '@domain/roles.ts';
import { newGenerics, parseCsvLine, parseFormularyCsv } from '@render/screen/builder/csv.ts';
import { suggestDrugs } from '@domain/repertoire.ts';
import type { FormularyEntry } from '@domain/pack.ts';

describe('roles', () => {
  it('lets a receptionist reach the queue but not the clinical side', () => {
    expect(canAccess('receptionist', 'clinic')).toBe(true);
    expect(canAccess('receptionist', 'settings')).toBe(true);
    expect(canAccess('receptionist', 'write')).toBe(false);
    expect(canAccess('receptionist', 'preview')).toBe(false);
    expect(canAccess('receptionist', 'history')).toBe(false);
    expect(canAccess('receptionist', 'growth')).toBe(false);
  });

  it('lets the doctor everywhere', () => {
    for (const view of ['write', 'preview', 'history', 'growth', 'builder', 'clinic']) {
      expect(canAccess('doctor', view)).toBe(true);
    }
  });

  it('is open until a PIN is set', async () => {
    expect(hasPin(openGate)).toBe(false);
    expect(await checkPin(openGate, 'anything')).toBe(true);
  });

  it('stores a digest, never the PIN itself', async () => {
    const gate = await setPin('4821');
    expect(gate.pinHash).not.toContain('4821');
    expect(JSON.stringify(gate)).not.toContain('4821');
    expect(gate.salt.length).toBeGreaterThan(16);
  });

  it('accepts the right PIN and refuses the wrong one', async () => {
    const gate = await setPin('4821');
    expect(await checkPin(gate, '4821')).toBe(true);
    expect(await checkPin(gate, '4822')).toBe(false);
  });

  it('salts, so two identical PINs do not share a digest', async () => {
    const a = await setPin('4821');
    const b = await setPin('4821');
    expect(a.pinHash).not.toBe(b.pinHash);
  });

  it('rejects a PIN that is not 4 to 8 digits', async () => {
    await expect(setPin('123')).rejects.toThrow(/4 to 8 digits/);
    await expect(setPin('abcd')).rejects.toThrow();
  });

  it('keeps only a short tail of unlocks', () => {
    let gate = openGate;
    for (let i = 0; i < 30; i += 1) gate = recordUnlock(gate, `2026-08-22T00:00:${String(i).padStart(2, '0')}Z`);
    expect(gate.recentUnlocks).toHaveLength(20);
  });
});

describe('CSV import', () => {
  const existing: FormularyEntry[] = [
    { brand: 'Amoxil', generic: 'Amoxicillin', strength: '250mg/5ml', provenance: 'manual' },
  ];

  it('handles quoted fields and embedded commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(parseCsvLine('"he said ""hi""",x')).toEqual(['he said "hi"', 'x']);
  });

  it('imports rows as unverified, never as DRAP', () => {
    const csv = 'brand,generic,strength\nPanadol,Paracetamol,500mg\n';
    const result = parseFormularyCsv(csv, existing);
    expect(result.rows).toHaveLength(1);
    // A CSV proves nothing about a registration.
    expect(result.rows[0]!.provenance).toBe('manual');
    expect(result.rows[0]!.drapRegNo).toBeUndefined();
  });

  it('accepts the column names a real export uses', () => {
    const csv = 'Brand Name,Composition,Dosage Form\nPanadol,Paracetamol,Tablet\n';
    const result = parseFormularyCsv(csv, existing);
    expect(result.rows[0]!.generic).toBe('Paracetamol');
    expect(result.rows[0]!.form).toBe('tablet');
  });

  it('rejects a row with no generic, because a dose could never match it', () => {
    const csv = 'brand,generic\nMystery Syrup,\n';
    const result = parseFormularyCsv(csv, existing);
    expect(result.rows).toHaveLength(0);
    expect(result.rejected[0]!.reason).toMatch(/no generic/);
  });

  it('skips rows already in the pack rather than duplicating them', () => {
    const csv = 'brand,generic,strength\nAmoxil,Amoxicillin,250mg/5ml\n';
    const result = parseFormularyCsv(csv, existing);
    expect(result.rows).toHaveLength(0);
    expect(result.duplicates).toBe(1);
  });

  it('refuses a file with no brand/generic columns rather than guessing', () => {
    const result = parseFormularyCsv('foo,bar\n1,2\n', existing);
    expect(result.rows).toHaveLength(0);
    expect(result.rejected[0]!.reason).toMatch(/needs a brand and a generic/);
  });

  it('reports the new generics an import would add to the vocabulary', () => {
    const csv = 'brand,generic\nPanadol,Paracetamol\nCalpol,Paracetamol\nZinnat,Cefuroxime\n';
    const { rows } = parseFormularyCsv(csv, existing);
    expect(newGenerics(rows, existing).sort()).toEqual(['Cefuroxime', 'Paracetamol']);
  });

  it('has no path into the dosing table at all', () => {
    const csv = 'brand,generic,dosage,mgPerKg\nPanadol,Paracetamol,15mg/kg,15\n';
    const { rows } = parseFormularyCsv(csv, existing);
    // Catalogue "dosage" text is leaflet copy, not evidence (PRODUCT.md 11a).
    expect(Object.keys(rows[0]!)).not.toContain('mgPerKg');
    expect(Object.keys(rows[0]!)).not.toContain('dosage');
  });
});

describe('the doctor’s own repertoire outranks the catalogue', () => {
  const catalogue: FormularyEntry[] = [
    { brand: 'Amoxil', generic: 'Amoxicillin', provenance: 'manual' },
    { brand: 'Amoxicap', generic: 'Amoxicillin', provenance: 'manual' },
  ];

  it('puts what this doctor actually prescribes first', () => {
    const hits = suggestDrugs('amox', catalogue, [
      { text: 'Amoxicap', count: 40, lastUsed: '2026-08-01' },
    ]);
    expect(hits[0]!.label).toBe('Amoxicap');
    expect(hits[0]!.source).toBe('repertoire');
    expect(hits[0]!.used).toBe(40);
  });

  it('does not list the same drug twice', () => {
    const hits = suggestDrugs('amox', catalogue, [
      { text: 'Amoxil', count: 5, lastUsed: '2026-08-01' },
    ]);
    expect(hits.filter((h) => h.label === 'Amoxil')).toHaveLength(1);
  });

  it('still finds a catalogue drug the doctor has never used', () => {
    const hits = suggestDrugs('amoxil', catalogue, []);
    expect(hits[0]!.label).toBe('Amoxil');
    expect(hits[0]!.source).toBe('catalogue');
  });

  it('does not let usage beat a clearly better text match', () => {
    const hits = suggestDrugs('amoxil', catalogue, [
      { text: 'Amoxicap', count: 400, lastUsed: '2026-08-01' },
    ]);
    expect(hits[0]!.label).toBe('Amoxil');
  });

  it('needs two characters before it suggests anything', () => {
    expect(suggestDrugs('a', catalogue, [])).toEqual([]);
  });
});
