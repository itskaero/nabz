/**
 * @vitest-environment jsdom
 *
 * The nav, which used to be two strips that scrolled sideways.
 *
 * The half worth testing hardest is `navModel`, because it is where a
 * destination can stop matching what is behind it: the Growth button was once
 * gated on device role alone and never on whether the active pack offered
 * growth, so a pack with `modules: []` still showed a tab leading nowhere.
 * These assert that every destination is generated from the pack, the profile
 * and the device, and that folding four groups onto a phone does not silently
 * drop one.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@render/screen/App.tsx';
import { StoreProvider } from '@render/screen/store.tsx';
import { bottomSlots, navGroups } from '@render/screen/shell/navModel.ts';
import type { NavGroup } from '@render/screen/shell/navModel.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import { clearDeviceRole, setDeviceRole } from '@domain/deviceRole.ts';
import { revertToShipped } from '@data/provider.ts';
import * as db from '@storage/db.ts';

const doctor = {
  modules: ['growth', 'malnutrition'] as const,
  scores: 0,
  queue: true,
  reception: false,
};

const ids = (groups: NavGroup[], id: string) =>
  groups.find((g) => g.id === id)?.items.map((i) => i.id) ?? [];

describe('what the nav offers', () => {
  it('generates the tools from the pack, not from a hardcoded list', () => {
    expect(ids(navGroups(doctor), 'tools')).toEqual(['growth', 'malnutrition']);
    expect(ids(navGroups({ ...doctor, modules: ['gfr', 'bmi'] }), 'tools')).toEqual([
      'gfr',
      'bmi',
    ]);
  });

  it('shows no TOOLS group at all for a pack with no modules and no scores', () => {
    // Not an empty heading: a group with nothing in it is a promise the pack
    // does not keep.
    const groups = navGroups({ ...doctor, modules: [] });
    expect(groups.map((g) => g.id)).not.toContain('tools');
  });

  it('adds Scores only when the pack has some', () => {
    expect(ids(navGroups(doctor), 'tools')).not.toContain('scores');
    expect(ids(navGroups({ ...doctor, scores: 3 }), 'tools')).toContain('scores');
  });

  it('offers the queue only when the clinic mode is on', () => {
    expect(ids(navGroups(doctor), 'clinic')).toEqual(['clinic', 'settings']);
    expect(ids(navGroups({ ...doctor, queue: false }), 'clinic')).toEqual(['settings']);
  });

  it('gives a reception station the queue and settings, and nothing clinical', () => {
    // Not disabled and not PIN-hidden: there is nothing behind the clinical
    // destinations on that machine, and a greyed-out button implies there is.
    const groups = navGroups({ ...doctor, reception: true });
    expect(groups.map((g) => g.id)).toEqual(['clinic']);
    expect(groups.flatMap((g) => g.items.map((i) => i.id))).toEqual(['clinic', 'settings']);
  });
});

describe('folding the nav onto a phone', () => {
  const shape = (input: Parameters<typeof navGroups>[0]) =>
    bottomSlots(navGroups(input)).map((s) => (s.kind === 'item' ? s.item.label : s.label));

  it('is Script, Queue, Tools, More — four, as designed', () => {
    expect(shape(doctor)).toEqual(['Script', 'Queue', 'Tools', 'More']);
  });

  it('drops the Queue button rather than leaving a dead slot', () => {
    expect(shape({ ...doctor, queue: false })).toEqual(['Script', 'Tools', 'More']);
  });

  it('drops Tools for a pack that has none', () => {
    expect(shape({ ...doctor, modules: [] })).toEqual(['Script', 'Queue', 'More']);
  });

  it('gives a reception station two real buttons, not one and a menu', () => {
    // A single leftover is rendered as itself: putting Settings behind "More"
    // on a machine with two destinations is a menu protecting one item.
    expect(shape({ ...doctor, reception: true })).toEqual(['Queue', 'Settings']);
  });

  it('loses no destination on the way down', () => {
    const groups = navGroups({ ...doctor, scores: 2 });
    const all = groups.flatMap((g) => g.items.map((i) => i.id)).sort();
    const reachable = bottomSlots(groups)
      .flatMap((s) =>
        s.kind === 'item' ? [s.item.id] : s.groups.flatMap((g) => g.items.map((i) => i.id)),
      )
      .sort();
    expect(reachable).toEqual(all);
  });
});

describe('the phone shell', () => {
  const width = (px: number) =>
    Object.defineProperty(window, 'innerWidth', { value: px, configurable: true });

  beforeEach(() => {
    setDeviceRole('consulting');
    width(390);
  });

  afterEach(async () => {
    clearDeviceRole();
    width(1024);
    cleanup();
    await revertToShipped();
    await db.saveProfile(defaultDoctorProfile);
  });

  it('puts the tools one tap away, behind a button that says so', async () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );

    // Not in the bottom bar itself -- four buttons is the budget, and Growth
    // and Malnutrition are two of the six destinations competing for them.
    expect(await screen.findByRole('button', { name: 'Tools' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Growth' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Tools' }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet.textContent).toContain('Growth');
    expect(sheet.textContent).toContain('Malnutrition');
  });

  it('says why Preview cannot be opened yet, instead of just refusing', async () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog');
    // A blank script has nothing to preview. The sheet has room to say so,
    // which the old header strip did not.
    expect(sheet.textContent).toMatch(/Nothing written yet|typeface is still loading/);
  });
});
