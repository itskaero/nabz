/**
 * @vitest-environment jsdom
 *
 * The sign-off screen, end to end: it refuses to sign under a placeholder
 * name, it records who and when, and editing the dose afterwards revokes it.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackBuilder } from '@render/screen/builder/PackBuilder.tsx';
import { StoreProvider } from '@render/screen/store.tsx';
import { setDeviceRole, clearDeviceRole } from '@domain/deviceRole.ts';
import { dosingFingerprint, dosingKey, unreviewedDosing, validateContentPack } from '@domain/pack.ts';
import { paediatrics } from '@data/packs/index.ts';
import * as db from '@storage/db.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';

beforeEach(async () => {
  setDeviceRole('consulting');
  await db.saveProfile(defaultDoctorProfile);
});
afterEach(async () => {
  clearDeviceRole();
  cleanup();
  await db.clearDraft();
});

const open = () =>
  render(
    <StoreProvider>
      <PackBuilder onDone={() => {}} />
    </StoreProvider>,
  );

describe('the sign-off screen', () => {
  it('will not sign anything while the pack author is a placeholder', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('tab', { name: /Sign-off/ }));

    expect(await screen.findByText(/Who is signing\?/)).toBeTruthy();
    // Every Sign off button is disabled until a real name is typed.
    const buttons = await screen.findAllByRole('button', { name: 'Sign off' });
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('records who and when, and says so', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('tab', { name: /Sign-off/ }));
    await user.type(await screen.findByLabelText('Your name'), 'Dr A. Tahir');

    const first = (await screen.findAllByRole('button', { name: 'Sign off' }))[0]!;
    expect((first as HTMLButtonElement).disabled).toBe(false);
    await user.click(first);

    // The count moves, and the row now carries a name and a date.
    await waitFor(() => expect(screen.getByText(/1 of \d+ signed/)).toBeTruthy());
    expect(screen.getByText(/Dr A\. Tahir ·/)).toBeTruthy();
  });

  it('counts down as rows are signed', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('tab', { name: /Sign-off/ }));
    await user.type(await screen.findByLabelText('Your name'), 'Dr A. Tahir');
    for (let i = 0; i < 3; i += 1) {
      const next = (await screen.findAllByRole('button', { name: 'Sign off' }))[0]!;
      await user.click(next);
    }
    await waitFor(() => expect(screen.getByText(/3 of \d+ signed/)).toBeTruthy());
  });

  /*
    The regression that mattered.

    The shortcut was a `window` keydown handler that ignored events aimed at an
    input. The name field then unmounted the moment it held a real name, so the
    rest of the name typed itself into `document.body` -- and the two spaces in
    "Dr A. Tahir" signed two doses nobody had read. The screen said "3 of 10
    signed" after a single deliberate click and every one of them was real.

    Typing a name is not an attestation. Neither is pressing space to scroll.
  */
  it('signs nothing while the signer is only typing their name', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('tab', { name: /Sign-off/ }));
    await user.type(await screen.findByLabelText('Your name'), 'Dr A. Tahir');

    // The field is still there, with the whole name in it.
    const field = (await screen.findByLabelText('Your name')) as HTMLInputElement;
    expect(field.value).toBe('Dr A. Tahir');
    expect(screen.getByText(/0 of \d+ signed/)).toBeTruthy();

    // And space pressed outside the list is still not a signature.
    await user.click(screen.getByRole('heading', { name: 'Dose sign-off' }));
    await user.keyboard(' ');
    expect(screen.getByText(/0 of \d+ signed/)).toBeTruthy();
  });

  it('signs the focused row from the keyboard, once the list has focus', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('tab', { name: /Sign-off/ }));
    await user.type(await screen.findByLabelText('Your name'), 'Dr A. Tahir');

    const list = screen.getByRole('group', { name: /awaiting sign-off/ });
    list.focus();
    await user.keyboard(' ');
    await waitFor(() => expect(screen.getByText(/1 of \d+ signed/)).toBeTruthy());

    // j moves on rather than re-signing the row already done.
    await user.keyboard('j ');
    await waitFor(() => expect(screen.getByText(/2 of \d+ signed/)).toBeTruthy());
  });
});

describe('what a sign-off is worth', () => {
  const row = paediatrics.dosing[0]!;

  it('lets the pack validate once every row is signed, and not before', () => {
    const claiming = { ...paediatrics, verified: true };
    expect(
      validateContentPack(claiming).some((i) => /not signed off/.test(i.message)),
    ).toBe(true);

    const dosingReview = Object.fromEntries(
      paediatrics.dosing.map((r) => [
        dosingKey(r),
        { reviewedBy: 'Dr A. Tahir', date: '2026-10-04', wording: dosingFingerprint(r) },
      ]),
    );
    const signed = {
      ...claiming,
      dosingReview,
      dosing: paediatrics.dosing.map((r) => ({ ...r, verified: true })),
    };
    expect(validateContentPack(signed).filter((i) => i.severity === 'error')).toEqual([]);
    expect(unreviewedDosing(signed)).toEqual([]);
  });

  it('dies the moment the dose is edited', () => {
    const dosingReview = {
      [dosingKey(row)]: {
        reviewedBy: 'Dr A. Tahir',
        date: '2026-10-04',
        wording: dosingFingerprint(row),
      },
    };
    const edited = {
      ...paediatrics,
      dosingReview,
      dosing: [{ ...row, mgPerKg: (row.mgPerKg ?? 10) * 2, verified: true }],
    };
    expect(unreviewedDosing(edited)).toEqual([
      { id: dosingKey(row), reason: 'wording-changed' },
    ]);
    expect(
      validateContentPack(edited).some((i) => /dose changed after Dr A\. Tahir/.test(i.message)),
    ).toBe(true);
  });
});
