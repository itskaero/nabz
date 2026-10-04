/**
 * Content-pack and data-integrity suite.
 *
 * The headline test is `every dosing row carries a citation`: CLAUDE.md 8a
 * requires a check that FAILS THE BUILD if any dosing row has an empty
 * reference. It is here, and it is the reason a dose can never quietly appear
 * in this app without a source attached to it.
 */
import { describe, expect, it } from 'vitest';
import { medicine, paediatrics, contentPacks, packIndex, phrasesForShippedPack } from '@data/packs/index.ts';
import { packs } from '@data/phrases/index.ts';
import { validateContentPack, packErrors } from '@domain/pack.ts';
import { validatePacks } from '@domain/phrases.ts';
import { contentErrors } from '@data/provider.ts';
import { computeScore } from '@domain/scores.ts';

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

  /*
    This test used to ban the NAME of a licensed source anywhere in a reference,
    as a proxy for the thing it actually cared about: nothing transcribed in
    bulk from BNFC, Nelson, Harriet Lane, Lexicomp or Micromedex may ship here.

    The proxy stopped working the moment the pack grew rows that were WRITTEN
    rather than transcribed. "BNF for Children, cefaclor monograph — check the
    current edition before signing" names BNFC in order to say nobody has
    copied anything out of it, which is the opposite of the banned act, and
    naming no source at all would leave the reviewer with nowhere to look.

    So the rule is now the real one. A row may name a licensed source when it
    is `drafted` (written to be checked, and saying so) or `verified` (a
    clinician opened that source and signed it). What it may never be is
    neither: a row wearing a licensed citation with nothing behind it is
    claiming to be a transcription, and that claim is the whole problem.
  */
  it('never wears a licensed citation it has not earned', () => {
    const licensed = /BNFC|BNF for Children|Nelson|Harriet Lane|Lexicomp|Micromedex/i;
    for (const row of paediatrics.dosing) {
      if (!licensed.test(row.reference)) continue;
      expect(
        row.drafted === true || row.verified === true,
        `${row.generic} cites a licensed source while neither drafted nor signed off`,
      ).toBe(true);
    }
  });

  it('keeps the transcribed WHO rows and the drafted ones apart', () => {
    // The ten rows that came out of open WHO guidance must not quietly acquire
    // the drafted mark, and nothing drafted may pose as one of them.
    const fromWho = paediatrics.dosing.filter((r) => /^WHO/.test(r.reference) && !/check/i.test(r.reference));
    expect(fromWho.length).toBeGreaterThanOrEqual(10);
    for (const row of fromWho) expect(row.drafted).toBeUndefined();
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

  it('enables the malnutrition module and names the protocol it follows', () => {
    expect(paediatrics.modules).toContain('malnutrition');
    const cfg = paediatrics.moduleConfig?.malnutrition;
    expect(cfg?.reference).toMatch(/Pakistan/);
    // Pakistan's national programme admits on MUAC or oedema alone. This is a
    // deliberate divergence from WHO 2023, which also admits on
    // weight-for-height, and it changes who gets treated -- so it is asserted
    // rather than left to whoever next edits the pack.
    expect(cfg?.criteria).toEqual(['oedema', 'muac']);
    expect(cfg?.muacSevereMm).toBe(115);
    expect(cfg?.muacModerateMm).toBe(125);
  });

  it('offers MUAC as a plottable growth measure too', () => {
    // Classifying once and following a child through a feeding programme are
    // different jobs; MUAC-for-age is an ordinary age-keyed chart and serves
    // the second.
    expect(paediatrics.moduleConfig?.growth?.measures).toContain('muac');
  });

  it('does not chip-ify diagnosis', () => {
    // Diagnosis is judgement; chips push click-convenience over it (PRODUCT.md 8).
    expect(Object.keys(paediatrics.findingsPalette)).not.toContain('diagnosis');
  });
});

describe('pack registry', () => {
  it('ships paediatrics and medicine, and nothing else', () => {
    expect(Object.keys(contentPacks).sort()).toEqual(['medicine', 'paediatrics']);
  });

  it('badges BOTH shipped packs as drafts, because neither is signed off', () => {
    /*
      This test used to assert `paediatrics.verified === true`, which is how
      the false claim survived: the pack said it was clinician-verified, the
      website repeated it, and a test locked it in -- while the author was the
      string 'Pack author' and not one dosing row was signed by anybody.

      `validateContentPack` now refuses `verified: true` while any dosing row
      is unreviewed, so this flips back only by being earned.
    */
    expect(paediatrics.verified).toBe(false);
    expect(medicine.verified).toBe(false);
  });
});

describe('medicine pack', () => {
  it('is structurally valid', () => {
    expect(packErrors(medicine)).toEqual([]);
  });

  it('is self-contained: its own registry validates without touching en.ts/ur-PK.ts', () => {
    // This is the test that proves Stage A's actual claim -- that installing
    // a second pack does not mean hand-merging its words into the shared
    // locale files. `phrasesForShippedPack('medicine')` is composed entirely
    // from `data/phrases/medicine.ts`; the base `en`/`ur-PK` packs (`packs`,
    // imported above) are never mutated by it.
    const medicinePhrases = phrasesForShippedPack(medicine.id);
    expect(contentErrors(medicine, medicinePhrases)).toEqual([]);
    // The base packs are untouched: none of medicine's own ids leaked in.
    expect(packs.en.advice.tier1['advice.take_with_food']).toBeUndefined();
    expect(packs.en.templates['sig.weekly']).toBeUndefined();
  });

  it('switching packs leaves nothing behind: no medicine-only id resolves against paediatrics', () => {
    const paedsPhrases = phrasesForShippedPack(paediatrics.id);
    for (const id of medicine.sigTemplates) {
      if (paediatrics.sigTemplates.includes(id)) continue;
      expect(paedsPhrases.en.templates[id], `paediatrics registry gained "${id}"`).toBeUndefined();
    }
  });

  it('every dosing row carries a non-empty citation', () => {
    for (const row of medicine.dosing) {
      expect(row.reference.trim(), `${row.generic} has no reference`).not.toBe('');
    }
  });

  it('ships every dosing row as unverified until a clinician signs it off', () => {
    for (const row of medicine.dosing) {
      expect(row.verified).toBe(false);
    }
  });

  it('every dosing row expresses a dose -- mgPerKg, fixedDose, or maxPerDay', () => {
    for (const row of medicine.dosing) {
      const expressesDose = Boolean(row.mgPerKg || row.fixedDose || row.maxPerDay);
      expect(expressesDose, `${row.generic} expresses no dose at all`).toBe(true);
    }
  });

  it('flags methotrexate weekly-only, and no daily-dosed drug is flagged by mistake', () => {
    const methotrexate = medicine.dosing.filter((r) => r.generic === 'Methotrexate');
    expect(methotrexate.length).toBeGreaterThan(0);
    expect(methotrexate.every((r) => r.weeklyOnly)).toBe(true);
    // weeklyOnly is a deliberate per-row flag, not a side effect of citing WHO
    // -- most rows must NOT carry it.
    const flagged = medicine.dosing.filter((r) => r.weeklyOnly).length;
    expect(flagged).toBeLessThan(medicine.dosing.length);
  });

  it('every score has a non-empty reference, at least one criterion and one band', () => {
    for (const score of medicine.scores ?? []) {
      expect(score.reference.trim(), `${score.id} has no reference`).not.toBe('');
      expect(score.criteria.length, `${score.id} has no criteria`).toBeGreaterThan(0);
      expect(score.bands.length, `${score.id} has no bands`).toBeGreaterThan(0);
    }
  });

  it('rejects a score with an empty reference', () => {
    const broken = structuredClone(medicine);
    broken.scores = [
      {
        id: 'test-score',
        label: 'Test',
        criteria: [{ id: 'a', label: 'A', points: 1 }],
        bands: [{ min: 0, max: 1, label: 'low' }],
        reference: '',
      },
    ];
    const errors = validateContentPack(broken).filter((i) => i.severity === 'error');
    expect(errors.some((e) => e.where === 'scores.test-score')).toBe(true);
  });

  it('enables the gfr and bmi modules, neither needing a moduleConfig entry', () => {
    expect(medicine.modules).toContain('gfr');
    expect(medicine.modules).toContain('bmi');
    expect(packErrors(medicine).some((e) => e.where.includes('moduleConfig'))).toBe(false);
  });

  it('every score band covers 0..max with no gap and no overlap', () => {
    for (const score of medicine.scores ?? []) {
      // The achievable max respects mutually-exclusive groups (computeScore's
      // own rule) -- a flat sum of every criterion overcounts a score like
      // CHA2DS2-VASc, whose two age bands can never both apply.
      const max = computeScore(score, new Set(score.criteria.map((c) => c.id))).max;
      for (let total = 0; total <= max; total += 1) {
        const matches = score.bands.filter((b) => total >= b.min && total <= b.max);
        expect(matches.length, `${score.id} at ${total}/${max}: ${matches.length} bands match`).toBe(1);
      }
    }
  });

  it('computeScore sums CURB-65 correctly and resolves the right band', () => {
    const curb65 = (medicine.scores ?? []).find((s) => s.id === 'curb65')!;
    expect(curb65).toBeDefined();

    const none = computeScore(curb65, new Set());
    expect(none.total).toBe(0);
    expect(none.band?.label).toBe('Low severity');

    const three = computeScore(
      curb65,
      new Set(['confusion', 'urea', 'age65']),
    );
    expect(three.total).toBe(3);
    expect(three.band?.label).toBe('High severity');

    const all = computeScore(curb65, new Set(curb65.criteria.map((c) => c.id)));
    expect(all.total).toBe(all.max);
    expect(all.band?.label).toBe('High severity');
  });

  it('CHA2DS2-VASc counts only the higher of its two mutually-exclusive age bands', () => {
    // The regression this pins: naively summing every ticked criterion would
    // score both age bands at once as 3 points, which the published score
    // can never actually produce -- a patient is 65-74 or >=75, never both.
    const cha2ds2vasc = (medicine.scores ?? []).find((s) => s.id === 'cha2ds2vasc')!;
    expect(cha2ds2vasc).toBeDefined();

    const bothAgeBands = computeScore(cha2ds2vasc, new Set(['age65', 'age75']));
    expect(bothAgeBands.total).toBe(2); // the higher of the two, not 1+2=3

    const everything = computeScore(cha2ds2vasc, new Set(cha2ds2vasc.criteria.map((c) => c.id)));
    expect(everything.total).toBe(9); // the real published maximum, not 10
    expect(everything.total).toBe(everything.max);
  });

  it('addresses the adult patient directly ("take"/لیں), not the paediatric caregiver ("give"/دیں)', () => {
    // The mechanism-level check, not a prose scan: Urdu compound verbs like
    // چھوڑ دیں ("quit") legitimately contain دیں without being the caregiver
    // imperative, so scanning advice text for that substring produces false
    // positives. What actually decides the register is `sigDefaults` -- the
    // slot every {administer}-based sig template resolves through.
    expect(medicine.sigDefaults?.slots?.administer).toBe('take');
    const medicinePhrases = phrasesForShippedPack(medicine.id);
    expect(medicinePhrases['ur-PK'].vocab.administer?.take).toBe('لیں');
  });
});

describe('the malnutrition protocol is configured or the module is off', () => {
  const enable = (cfg: unknown) =>
    packErrors({
      ...paediatrics,
      modules: ['malnutrition'],
      moduleConfig: cfg === undefined ? {} : { malnutrition: cfg },
    } as typeof paediatrics).filter((e) => e.where.includes('malnutrition'));

  it('refuses the module with no protocol at all', () => {
    // There is no safe default: WHO 2023 and national programmes use
    // different case definitions, and picking one silently would apply
    // another country's criteria to a clinic's caseload.
    const errors = enable(undefined);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.severity).toBe('error');
  });

  it('refuses cut-offs with no citation', () => {
    const errors = enable({
      criteria: ['muac'], muacSevereMm: 115, muacModerateMm: 125,
      whzSevere: -3, whzModerate: -2, reference: '   ',
    });
    expect(errors.some((e) => e.where.endsWith('reference'))).toBe(true);
  });

  it('refuses a protocol that admits on nothing', () => {
    const errors = enable({
      criteria: [], muacSevereMm: 115, muacModerateMm: 125,
      whzSevere: -3, whzModerate: -2, reference: 'somewhere',
    });
    expect(errors.some((e) => e.where.endsWith('criteria'))).toBe(true);
  });

  it('refuses cut-offs that are the wrong way round', () => {
    // A severe threshold above the moderate one would classify every
    // moderately wasted child as severe and never fire the moderate band.
    const muac = enable({
      criteria: ['muac'], muacSevereMm: 125, muacModerateMm: 115,
      whzSevere: -3, whzModerate: -2, reference: 'somewhere',
    });
    expect(muac.some((e) => e.message.includes('MUAC'))).toBe(true);

    const whz = enable({
      criteria: ['whz'], muacSevereMm: 115, muacModerateMm: 125,
      whzSevere: -2, whzModerate: -3, reference: 'somewhere',
    });
    expect(whz.some((e) => e.message.includes('WHZ'))).toBe(true);
  });

  it('accepts the shipped paediatric protocol', () => {
    expect(packErrors(paediatrics).filter((e) => e.where.includes('malnutrition'))).toEqual([]);
  });
});

describe('pack self-containment (structural)', () => {
  it('every shipped pack validates against its own paired registry', () => {
    for (const pack of Object.values(contentPacks)) {
      const phrases = phrasesForShippedPack(pack.id);
      expect(contentErrors(pack, phrases), `${pack.id} failed`).toEqual([]);
      expect(validatePacks(phrases), `${pack.id}'s registry failed`).toEqual([]);
    }
  });
});
