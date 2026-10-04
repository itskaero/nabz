/**
 * `verified` has to mean somebody vouched for it.
 *
 * THE DEFECT THIS CLOSES. `DosingEntry.verified` was a boolean anybody could
 * set and nothing checked, the pack author was the literal string 'Pack
 * author', and docs/index.html advertised "Paediatrics — clinician-verified"
 * while not one of the 62 shipped dosing rows was signed off by anyone.
 *
 * A dose is the most consequential claim this app makes: it is printed, handed
 * to a parent, and measured into a syringe. It now gets the same machinery the
 * red flags already had — a named signer, a date, and a fingerprint that
 * revokes the sign-off the moment the numbers change.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack, DosingEntry } from '@domain/pack.ts';
import {
  dosingFingerprint,
  dosingKey,
  unreviewedDosing,
  validateContentPack,
} from '@domain/pack.ts';
import { paediatrics } from '@data/packs/index.ts';

const row = (patch: Partial<DosingEntry> = {}): DosingEntry => ({
  generic: 'amoxicillin',
  indication: 'pneumonia',
  ageBand: { label: '2 months to 5 years', fromDays: 60, toDays: 1826 },
  mgPerKg: 40,
  perDoses: 3,
  route: 'oral',
  reference: 'WHO Pocket Book of Hospital Care for Children, 2nd ed.',
  verified: false,
  ...patch,
});

const packWith = (dosing: DosingEntry[], review?: ContentPack['dosingReview']): ContentPack => ({
  ...paediatrics,
  dosing,
  ...(review ? { dosingReview: review } : {}),
});

const signedBy = (entry: DosingEntry, who = 'Dr A. Tahir', date = '2026-10-04') => ({
  [dosingKey(entry)]: { reviewedBy: who, date, wording: dosingFingerprint(entry) },
});

describe('the key', () => {
  it('identifies a row by what it is about, since DosingEntry has no id', () => {
    expect(dosingKey(row())).toBe('amoxicillin|pneumonia|2 months to 5 years');
  });

  it('separates the same drug at different ages', () => {
    expect(dosingKey(row())).not.toBe(
      dosingKey(row({ ageBand: { label: 'over 5 years', fromDays: 1826 } })),
    );
  });
});

describe('the fingerprint', () => {
  it('changes when the dose changes', () => {
    expect(dosingFingerprint(row())).not.toBe(dosingFingerprint(row({ mgPerKg: 45 })));
  });

  it('changes when the range, frequency, cap or route changes', () => {
    const base = dosingFingerprint(row());
    for (const patch of [
      { mgPerKgHigh: 90 },
      { perDoses: 2 },
      { maxPerDay: '3 g' },
      { route: 'IV' },
      { weeklyOnly: true },
      { ageBand: { label: '2 months to 5 years', fromDays: 90, toDays: 1826 } },
    ] as Array<Partial<DosingEntry>>) {
      expect(dosingFingerprint(row(patch))).not.toBe(base);
    }
  });

  it('does NOT change when only prose changes', () => {
    // A sign-off is on the numbers. Rewording a note should not force a
    // paediatrician to re-check 150 rows they already checked.
    const base = dosingFingerprint(row());
    expect(dosingFingerprint(row({ note: 'take with food' }))).toBe(base);
    expect(dosingFingerprint(row({ reference: 'A different edition' }))).toBe(base);
  });
});

describe('validateContentPack', () => {
  it('refuses verified: true with nobody behind it', () => {
    const errors = validateContentPack(packWith([row({ verified: true })]))
      .filter((i) => i.severity === 'error')
      .map((i) => i.message);
    expect(errors.join(' ')).toMatch(/nobody has signed it off/);
  });

  it('accepts verified: true once it is signed', () => {
    const r = row({ verified: true });
    expect(
      validateContentPack(packWith([r], signedBy(r))).filter((i) => i.severity === 'error'),
    ).toEqual([]);
  });

  it('revokes the sign-off when the dose is edited afterwards', () => {
    // The whole point. Sign off 40 mg/kg, then change it to 90, and the old
    // approval must not quietly carry forward onto the new number.
    const signed = row({ verified: true });
    const edited = { ...signed, mgPerKg: 90 };
    const errors = validateContentPack(packWith([edited], signedBy(signed)))
      .filter((i) => i.severity === 'error')
      .map((i) => i.message);
    expect(errors.join(' ')).toMatch(/dose changed after Dr A\. Tahir signed it off/);
  });

  it('rejects a dose range with no bottom, or one that is inside out', () => {
    const noLow: DosingEntry = { ...row(), mgPerKgHigh: 15, fixedDose: '1 g' };
    delete (noLow as { mgPerKg?: number }).mgPerKg;
    expect(
      validateContentPack(packWith([noLow])).some((i) => /top of a dose range/.test(i.message)),
    ).toBe(true);
    expect(
      validateContentPack(packWith([row({ mgPerKg: 15, mgPerKgHigh: 10 })])).some((i) =>
        /inside out/.test(i.message),
      ),
    ).toBe(true);
  });
});

describe('unreviewedDosing', () => {
  it('reports every row as never-reviewed in a pack nobody has signed', () => {
    const out = unreviewedDosing(packWith([row(), row({ generic: 'paracetamol' })]));
    expect(out).toHaveLength(2);
    expect(out.every((o) => o.reason === 'never-reviewed')).toBe(true);
  });

  it('distinguishes "never signed" from "signed, then edited"', () => {
    const signed = row();
    const out = unreviewedDosing(packWith([{ ...signed, mgPerKg: 90 }], signedBy(signed)));
    expect(out).toEqual([{ id: dosingKey(signed), reason: 'wording-changed' }]);
  });

  it('is silent once a row is signed and unchanged', () => {
    const r = row();
    expect(unreviewedDosing(packWith([r], signedBy(r)))).toEqual([]);
  });
});

describe('the packs as shipped', () => {
  it('still has nothing signed off, and says so rather than claiming otherwise', async () => {
    // This is the honest state today and the test that keeps it honest: if a
    // future pack sets verified: true without a sign-off, validate() fails.
    const { medicine } = await import('@data/packs/index.ts');
    for (const pack of [paediatrics, medicine]) {
      expect(pack.dosing.every((d) => d.verified === false)).toBe(true);
      expect(unreviewedDosing(pack)).toHaveLength(
        new Set(pack.dosing.map(dosingKey)).size,
      );
      expect(validateContentPack(pack).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });
});

describe('one key, one row', () => {
  /*
    `dosingKey` is `generic|indication|ageBand.label`, and until now nothing
    said it had to be unique. A sign-off is stored against the key, not the
    array index -- so two rows that collide share one signature, and ticking
    the first silently vouches for the second. Shipped packs happen to have
    distinct keys; "happen to" is not a guarantee, and the paediatric pack is
    heading for ~150 rows where an oral and an IV row for the same indication
    in the same age band is an ordinary thing to write.
  */
  it('refuses two dosing rows with the same identity', () => {
    const issues = validateContentPack(packWith([row(), row({ route: 'IV' })]));
    expect(issues.some((i) => i.severity === 'error' && /share the identity/.test(i.message))).toBe(
      true,
    );
  });

  it('accepts them once something tells them apart', () => {
    const issues = validateContentPack(
      packWith([row(), row({ route: 'IV', indication: 'severe pneumonia (IV)' })]),
    );
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('would have let one tick sign both', () => {
    // The reason the rule above is an error and not a warning: `unreviewedDosing`
    // reports ONE outstanding row for two, so the screen would show the second
    // as signed by a clinician who never saw it.
    const dup = packWith([row(), row({ route: 'IV' })]);
    expect(dup.dosing).toHaveLength(2);
    expect(unreviewedDosing(dup)).toHaveLength(1);
  });
});

describe('a sign-off that survives being shared', () => {
  /*
    A review that does not survive export is a review somebody has to do twice,
    and the second time nobody does it: the rows arrive marked `verified: true`
    with no `dosingReview` behind them, and `validateContentPack` refuses the
    pack a colleague is trying to install.
  */
  it('round-trips through the dosing slice of a pack file', async () => {
    const { serialisePack, parsePackFile, mergeSection } = await import(
      '@render/screen/builder/packFile.ts'
    );
    const { defaultResolvedContent } = await import('@data/provider.ts');
    const { phrases } = defaultResolvedContent();

    const r = row({ verified: true });
    const signed = packWith([r], signedBy(r));
    expect(validateContentPack(signed).filter((i) => i.severity === 'error')).toEqual([]);

    const file = parsePackFile(serialisePack(signed, phrases, false, 'dosing'));
    expect(file.pack.dosingReview).toEqual(signed.dosingReview);

    // And landing it on a pack that has never seen the row carries the
    // signature with it, rather than importing a bare `verified: true`.
    const landed = mergeSection(
      { pack: packWith([]), phrases },
      { pack: file.pack, phrases: file.phrases },
      'dosing',
    );
    expect(unreviewedDosing(landed.pack)).toEqual([]);
    expect(validateContentPack(landed.pack).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('what the pack now claims about where its numbers came from', () => {
  /*
    The measurement that started this: 95 of 102 paediatric generics had no
    dose at all, and the seven that did came from ten WHO rows. The hole is
    closed. What matters more than the count is that closing it did not blur
    the two kinds of claim together.
  */
  it('has a row for every generic, and none of them is verified', () => {
    const generics = new Set(paediatrics.formularySeed.map((r) => r.generic.toLowerCase()));
    const dosed = new Set(paediatrics.dosing.map((r) => r.generic.toLowerCase()));
    for (const g of generics) expect(dosed.has(g), `${g} has no dosing row`).toBe(true);
    expect(paediatrics.dosing.every((r) => r.verified === false)).toBe(true);
  });

  it('marks every written row as drafted, and leaves the transcribed ones unmarked', () => {
    const drafted = paediatrics.dosing.filter((r) => r.drafted);
    const transcribed = paediatrics.dosing.filter((r) => !r.drafted);

    // The ten WHO rows the pack started with, and nothing else.
    expect(transcribed).toHaveLength(10);
    for (const row of transcribed) expect(row.reference).toMatch(/^WHO/);

    // Every drafted row says where to check it, and none of them pretends to
    // have been taken from there.
    expect(drafted.length).toBeGreaterThan(100);
    for (const row of drafted) {
      expect(row.reference, `${row.generic} does not say where to check it`).toMatch(
        /check (the current edition|against the current edition)/i,
      );
    }
  });

  it('expresses a dose on every row, even the ones that refuse to suggest one', () => {
    // `fixedDose` is documented as holding "a plainly-worded refusal to
    // suggest one". Several rows use it that way -- a steroid-plus-antifungal
    // combination, a withdrawn H2 blocker, the sedating cough mixtures. A
    // stated reason is more use to a prescriber than a silent gap, and the
    // validator's "row must express a dose" rule is what keeps it visible.
    for (const row of paediatrics.dosing) {
      expect(
        row.mgPerKg !== undefined || Boolean(row.fixedDose) || Boolean(row.maxPerDay),
        `${row.generic} expresses no dose and no reason`,
      ).toBe(true);
    }
    const refusals = paediatrics.dosing.filter((r) => /No dose offered/.test(r.fixedDose ?? ''));
    expect(refusals.length).toBeGreaterThan(3);
    for (const row of refusals) expect(row.note, `${row.generic} refuses without saying why`).toBeTruthy();
  });
});
