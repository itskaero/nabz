/**
 * Addons: what a file is allowed to do to a clinic's content.
 *
 * The properties worth holding, in the order they matter:
 *
 *  1. An addon cannot bring code. It names a module this build already has a
 *     tested implementation for, or it does not install. That is the whole
 *     safety argument for letting a file switch on a clinical calculator.
 *  2. It may add, never overwrite. A file that could silently replace the
 *     wording of a tier-2 red flag would be a way to change what a patient is
 *     told with nobody reviewing it.
 *  3. Removing one is complete. Addons are a layer over the pack, never
 *     written into it, so there is nothing to unpick and nothing to get wrong.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paediatrics } from '@data/packs/index.ts';
import { packs as shippedPhrases } from '@data/phrases/index.ts';
import { whoWasting2023 } from '@data/addons/who-wasting-2023.ts';
import type { Addon } from '@domain/addon.ts';
import {
  addonErrors,
  appliesTo,
  mergeAddon,
  mergeAddons,
  parseAddon,
  validateAddon,
} from '@domain/addon.ts';
import {
  canonical,
  generateSigningKey,
  keyFingerprint,
  signAddon,
  verifyAddon,
} from '@domain/addonSignature.ts';
import { classify } from '@domain/modules/malnutrition.ts';
import {
  installAddon,
  listAddons,
  removeAddon,
  resetContentCache,
  resolveContent,
} from '@data/provider.ts';
import * as db from '@storage/db.ts';

const base = () => structuredClone(whoWasting2023) as Addon;

const validate = (addon: Addon) =>
  validateAddon(addon, paediatrics, shippedPhrases);

beforeEach(async () => {
  resetContentCache();
  for (const entry of await db.listInstalledAddons()) await db.deleteInstalledAddon(entry.id);
  for (const entry of await db.listInstalledPacks()) await db.deleteInstalledPack(entry.id);
});

afterEach(() => resetContentCache());

describe('an addon carries data, never code', () => {
  it('refuses a module this build has no implementation for', async () => {
    const addon = base();
    (addon.contributes.modules as string[]) = ['telepathy'];
    const errors = addonErrors(validate(addon));
    expect(errors).toHaveLength(1);
    // Named, not filtered out: a file that quietly drops the capability it was
    // installed for is worse than one that will not install.
    expect(errors[0]?.where).toBe('contributes.modules.telepathy');
    expect(errors[0]?.message).toContain('never code');
  });

  it('refuses a document kind this build has no implementation for', () => {
    const addon = base();
    (addon.contributes as { documents: string[] }).documents = ['sick-note'];
    expect(addonErrors(validate(addon)).some((e) => e.where.includes('sick-note'))).toBe(true);
  });

  it('accepts the modules this build does have', () => {
    expect(addonErrors(validate(base()))).toEqual([]);
  });

  it('refuses a module switched on with no configuration to run it', () => {
    // The addon is the only chance to supply it; refusing later would leave
    // the pack validator complaining with nothing to point at.
    const addon = base();
    delete addon.contributes.moduleConfig;
    const errors = addonErrors(
      validateAddon(addon, { ...paediatrics, moduleConfig: {} }, shippedPhrases),
    );
    expect(errors.some((e) => e.where.includes('moduleConfig.malnutrition'))).toBe(true);
  });
});

describe('an addon may add, never overwrite', () => {
  it('refuses wording that already exists', () => {
    const existing = Object.keys(shippedPhrases['ur-PK'].advice.tier2)[0]!;
    const addon = base();
    addon.contributes.adviceText = { 'ur-PK': { tier2: { [existing]: 'something else' } } };
    const errors = addonErrors(validate(addon));
    expect(errors.some((e) => e.message.includes('nobody reviewing'))).toBe(true);
  });

  it('refuses a string that already exists', () => {
    const addon = base();
    addon.contributes.strings = { en: { 'section.diagnosis': 'Impression' } };
    expect(addonErrors(validate(addon)).some((e) => e.where.includes('section.diagnosis'))).toBe(
      true,
    );
  });

  it('refuses a score id that already exists', () => {
    const withScore = {
      ...paediatrics,
      scores: [{ id: 's1', label: 'A', criteria: [], bands: [], reference: 'x' }],
    };
    const addon = base();
    addon.contributes.scores = [{ id: 's1', label: 'B', criteria: [], bands: [], reference: 'y' }];
    const errors = addonErrors(validateAddon(addon, withScore, shippedPhrases));
    expect(errors.some((e) => e.message.includes('never replace'))).toBe(true);
  });

  it('refuses a score with no citation', () => {
    const addon = base();
    addon.contributes.scores = [{ id: 'new', label: 'B', criteria: [], bands: [], reference: '' }];
    expect(addonErrors(validate(addon)).some((e) => e.where.endsWith('reference'))).toBe(true);
  });

  it('refuses an advice id offered without wording in every locale', () => {
    const addon = base();
    addon.contributes.advice = { tier1: ['advice.new'] };
    addon.contributes.adviceText = { en: { tier1: { 'advice.new': 'Drink water.' } } };
    const errors = addonErrors(validate(addon));
    // A half-translated line prints the wrong language to a patient.
    expect(errors.some((e) => e.message.includes('ur-PK'))).toBe(true);
  });

  it('warns rather than refuses when it replaces a module’s settings', () => {
    // Swapping a clinic from the national criteria to WHO 2023 is the point of
    // this addon. It is a setting, not a sentence a patient reads -- but it
    // changes who gets classified, so it is never silent.
    const issues = validate(base());
    expect(addonErrors(issues)).toEqual([]);
    const warning = issues.find((i) => i.where === 'contributes.moduleConfig.malnutrition');
    expect(warning?.severity).toBe('warning');
    expect(warning?.message).toContain('classify different patients');
  });
});

describe('merging', () => {
  it('appends to lists without removing anything', () => {
    const addon = base();
    addon.contributes.modules = ['gfr'];
    const { pack } = mergeAddon(paediatrics, shippedPhrases, addon);
    expect(pack.modules).toContain('growth');
    expect(pack.modules).toContain('gfr');
  });

  it('never duplicates a module the pack already has', () => {
    const { pack } = mergeAddon(paediatrics, shippedPhrases, base());
    expect(pack.modules.filter((m) => m === 'malnutrition')).toHaveLength(1);
  });

  it('does not mutate what it was given', () => {
    const before = structuredClone(paediatrics);
    mergeAddon(paediatrics, shippedPhrases, base());
    expect(paediatrics).toEqual(before);
  });

  it('applies several addons in order', () => {
    const a = base();
    a.manifest.id = 'a';
    a.contributes.modules = ['gfr'];
    const b = base();
    b.manifest.id = 'b';
    b.contributes.modules = ['bmi'];
    const { pack } = mergeAddons(paediatrics, shippedPhrases, [a, b]);
    expect(pack.modules).toEqual(expect.arrayContaining(['growth', 'gfr', 'bmi']));
  });

  it('targets the packs it says it targets', () => {
    expect(appliesTo(base(), 'paediatrics')).toBe(true);
    expect(appliesTo(base(), 'medicine')).toBe(false);
    const any = base();
    delete any.manifest.appliesTo;
    expect(appliesTo(any, 'medicine')).toBe(true);
  });
});

describe('parsing', () => {
  it('rejects anything that is not an addon', () => {
    expect(parseAddon(null).ok).toBe(false);
    expect(parseAddon('a string').ok).toBe(false);
    expect(parseAddon({ schema: 99 }).ok).toBe(false);
  });

  it('insists an addon says who wrote it', () => {
    const raw = structuredClone(whoWasting2023) as unknown as Record<string, unknown>;
    (raw['manifest'] as Record<string, unknown>)['author'] = { name: '  ' };
    const out = parseAddon(raw);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.some((e) => e.where.includes('author'))).toBe(true);
  });

  it('accepts the shipped one', () => {
    expect(parseAddon(structuredClone(whoWasting2023)).ok).toBe(true);
  });
});

describe('signing', () => {
  it('round-trips', async () => {
    const keys = await generateSigningKey();
    const addon = base();
    addon.signature = await signAddon(
      addon.manifest,
      addon.contributes,
      keys.privateKey,
      keys.publicKey,
    );
    expect(await verifyAddon(addon)).toBe('valid');
  });

  it('notices a changed protocol', async () => {
    // The attack this exists to catch: the file says WHO 2023 on the label and
    // somebody moved a cut-off.
    const keys = await generateSigningKey();
    const addon = base();
    addon.signature = await signAddon(
      addon.manifest,
      addon.contributes,
      keys.privateKey,
      keys.publicKey,
    );
    addon.contributes.moduleConfig!.malnutrition!.muacSevereMm = 90;
    expect(await verifyAddon(addon)).toBe('invalid');
  });

  it('survives a round trip through JSON, in any key order', async () => {
    // A signature scheme whose input depends on key order fails the first time
    // a file goes through a formatter.
    const keys = await generateSigningKey();
    const addon = base();
    addon.signature = await signAddon(
      addon.manifest,
      addon.contributes,
      keys.privateKey,
      keys.publicKey,
    );
    const reparsed = JSON.parse(JSON.stringify(addon)) as Addon;
    expect(await verifyAddon(reparsed)).toBe('valid');

    const shuffled = {
      ...reparsed,
      manifest: Object.fromEntries(
        Object.entries(reparsed.manifest).reverse(),
      ) as Addon['manifest'],
    };
    expect(canonical(shuffled.manifest, shuffled.contributes)).toBe(
      canonical(reparsed.manifest, reparsed.contributes),
    );
    expect(await verifyAddon(shuffled)).toBe('valid');
  });

  it('says "unsigned" rather than "invalid" when there is no signature', async () => {
    expect(await verifyAddon(base())).toBe('unsigned');
  });

  it('treats a malformed signature as invalid, not as unreadable', async () => {
    const addon = base();
    addon.signature = { publicKey: 'not-a-key', signature: 'nope', signedAt: '2026-01-01' };
    expect(await verifyAddon(addon)).toBe('invalid');
  });

  it('gives a key a short form a person can compare', async () => {
    const keys = await generateSigningKey();
    const other = await generateSigningKey();
    expect(keyFingerprint(keys.publicKey)).toMatch(/^[0-9A-F]{8}-[0-9A-F]{8}$/);
    expect(keyFingerprint(keys.publicKey)).not.toBe(keyFingerprint(other.publicKey));
    expect(keyFingerprint(keys.publicKey)).toBe(keyFingerprint(keys.publicKey));
  });
});

describe('installing, and taking it back off', () => {
  it('installs, and the classification changes', async () => {
    // The end-to-end proof. Paediatrics ships with Pakistan's MUAC-only
    // criteria; this child is severely wasted on weight-for-height and has a
    // normal arm circumference, so the national protocol says nothing.
    const child = {
      sex: 'M' as const,
      weightKg: 8.0,
      measurementCm: 80,
      posture: 'standing' as const,
      muacMm: 130,
      oedema: 'absent' as const,
    };

    const before = await resolveContent('paediatrics');
    expect(before.pack.moduleConfig?.malnutrition?.criteria).toEqual(['oedema', 'muac']);

    const result = await installAddon(structuredClone(whoWasting2023), 'paediatrics');
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    const after = await resolveContent('paediatrics');
    expect(after.pack.moduleConfig?.malnutrition?.criteria).toEqual(['oedema', 'whz', 'muac']);
    expect(after.addons).toHaveLength(1);

    const deps = { wasting: [], muacRows: [] };
    // Criteria alone decides whether weight-for-height is even consulted; with
    // no tables loaded here the WHO config refuses for want of them, while the
    // national one answers without ever looking.
    expect(classify(child, before.pack.moduleConfig!.malnutrition!, deps)).toMatchObject({
      ok: true,
      severity: 'none',
    });
    expect(classify(child, after.pack.moduleConfig!.malnutrition!, deps)).toMatchObject({
      ok: false,
      reason: 'no-tables',
    });
  });

  it('removing it puts everything back exactly', async () => {
    const before = await resolveContent('paediatrics');
    const snapshot = structuredClone(before.pack);

    await installAddon(structuredClone(whoWasting2023), 'paediatrics');
    resetContentCache();
    expect((await resolveContent('paediatrics')).pack).not.toEqual(snapshot);

    await removeAddon('who-wasting-2023');
    const after = await resolveContent('paediatrics');
    // Complete by construction: the base pack never carried the addon's
    // contributions, so there is nothing to unpick.
    expect(after.pack).toEqual(snapshot);
    expect(after.addons).toEqual([]);
  });

  it('lists what is installed', async () => {
    await installAddon(structuredClone(whoWasting2023), 'paediatrics');
    const list = await listAddons();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('who-wasting-2023');
    expect(list[0]?.verdict).toBe('unsigned');
    // The warnings the install was allowed to proceed with are kept, so the UI
    // can keep saying them rather than only saying them once.
    expect(list[0]?.warnings.join(' ')).toContain('not signed');
  });

  it('refuses a file whose signature does not match its contents', async () => {
    const keys = await generateSigningKey();
    const addon = base();
    addon.signature = await signAddon(
      addon.manifest,
      addon.contributes,
      keys.privateKey,
      keys.publicKey,
    );
    addon.manifest.title = 'Something more reassuring';

    const result = await installAddon(addon, 'paediatrics');
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('changed since it was signed'))).toBe(true);
    expect(await listAddons()).toEqual([]);
  });

  it('installs a properly signed one and records the verdict', async () => {
    const keys = await generateSigningKey();
    const addon = base();
    addon.signature = await signAddon(
      addon.manifest,
      addon.contributes,
      keys.privateKey,
      keys.publicKey,
    );
    const result = await installAddon(addon, 'paediatrics');
    expect(result.ok).toBe(true);
    expect((await listAddons())[0]?.verdict).toBe('valid');
  });

  it('stores nothing when it refuses', async () => {
    const addon = base();
    (addon.contributes.modules as string[]) = ['telepathy'];
    const result = await installAddon(addon, 'paediatrics');
    expect(result.ok).toBe(false);
    expect(await listAddons()).toEqual([]);
    // And the pack is untouched.
    expect((await resolveContent('paediatrics')).addons).toEqual([]);
  });
});
