/**
 * @vitest-environment jsdom
 *
 * The setup screen, and when it gets out of the way.
 *
 * Setting this app up was a week-long sequence of interruptions arriving one
 * at a time from unrelated parts of the interface, with no moment at which
 * anybody could say it was finished. This is that moment. What these hold is
 * the two halves of the bargain: it must show before the first script, and it
 * must never be in the way of the second one.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@render/screen/App.tsx';
import { StoreProvider } from '@render/screen/store.tsx';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import { clearDeviceRole, setDeviceRole } from '@domain/deviceRole.ts';
import { revertToShipped } from '@data/provider.ts';
import * as db from '@storage/db.ts';

const named = {
  ...defaultDoctorProfile,
  doctor: {
    ...defaultDoctorProfile.doctor,
    name: 'Dr A. Tahir',
    registration: { authority: 'PMDC', number: '12345-P' },
  },
};

const renderApp = () =>
  render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );

beforeEach(() => setDeviceRole('consulting'));

afterEach(async () => {
  clearDeviceRole();
  cleanup();
  await revertToShipped();
  await db.saveProfile(defaultDoctorProfile);
});

describe('before setup is finished', () => {
  it('opens on the checklist rather than a blank script', async () => {
    await db.saveProfile(defaultDoctorProfile);
    renderApp();

    expect(await screen.findByText('Set up this device')).toBeTruthy();
    // Not merely alongside: the script is not what this device is ready for.
    expect(screen.queryByPlaceholderText(/Fever for 3 days/)).toBeNull();
  });

  it('says what is missing and why it matters, not that a field is required', async () => {
    await db.saveProfile(defaultDoctorProfile);
    renderApp();

    expect(await screen.findByText('Your name and registration')).toBeTruthy();
    expect(screen.getByText(/how a pharmacist checks who prescribed/)).toBeTruthy();
    expect(screen.getAllByText('Needed before you start').length).toBeGreaterThan(0);
  });

  it('will not pretend the script is available yet', async () => {
    await db.saveProfile(defaultDoctorProfile);
    renderApp();
    const start = await screen.findByRole('button', {
      name: 'Finish the steps above first',
    });
    expect(start.hasAttribute('disabled')).toBe(true);
  });

  it('sends the doctor to the place the missing thing lives', async () => {
    await db.saveProfile(defaultDoctorProfile);
    renderApp();
    await screen.findByText('Set up this device');
    await userEvent.click(screen.getAllByRole('button', { name: 'Fill in' })[0]!);
    // Settings, where the name and the registration number actually live.
    expect(await screen.findByRole('heading', { name: 'Your details' })).toBeTruthy();
  });
});

describe('once it is finished', () => {
  it('opens straight onto the script, adding nothing to the OPD path', async () => {
    await db.saveProfile(named);
    renderApp();

    expect(await screen.findByPlaceholderText(/Fever for 3 days/)).toBeTruthy();
    expect(screen.queryByText('Set up this device')).toBeNull();
  });

  it('stays reachable, because the backup row is not finished with anybody', async () => {
    await db.saveProfile(named);
    renderApp();
    await screen.findByPlaceholderText(/Fever for 3 days/);

    await userEvent.click(screen.getByRole('button', { name: 'Setup' }));
    expect(await screen.findByText('Set up this device')).toBeTruthy();
    expect(screen.getByText('A first backup, written')).toBeTruthy();
    // Outstanding, and saying so -- but it never held the app back.
    expect(screen.getAllByText('Still to do').length).toBeGreaterThan(0);
  });

  it('offers the way back to the script', async () => {
    await db.saveProfile(named);
    renderApp();
    await screen.findByPlaceholderText(/Fever for 3 days/);
    await userEvent.click(screen.getByRole('button', { name: 'Setup' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Write a script' }));
    expect(await screen.findByPlaceholderText(/Fever for 3 days/)).toBeTruthy();
  });
});
