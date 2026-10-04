/**
 * @vitest-environment jsdom
 *
 * The chart, end to end: open it from a linked patient, record an allergy,
 * and see it reach the banner on the script underneath.
 *
 * That last part is the whole feature. Everything else in here is arranging.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@render/screen/App.tsx';
import { StoreProvider } from '@render/screen/store.tsx';
import { setDeviceRole, clearDeviceRole } from '@domain/deviceRole.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';

const PID = 'p-chart';

const setUp = {
  ...defaultDoctorProfile,
  doctor: {
    ...defaultDoctorProfile.doctor,
    name: 'Dr A. Tahir',
    registration: { authority: 'PMDC', number: '12345-P' },
  },
};

beforeEach(async () => {
  setDeviceRole('consulting');
  await db.saveProfile(setUp);
  await db.savePatient({
    id: PID,
    name: 'Hassan Raza',
    createdAt: '2026-01-02T09:00:00.000Z',
    updatedAt: '2026-01-02T09:00:00.000Z',
  });
  await db.savePrescription({
    ...emptyPrescription('paediatrics', 'rx-old'),
    patientId: PID,
    date: '2026-03-14',
    diagnosis: ['Acute gastroenteritis'],
    medications: [
      {
        id: 'm1',
        drug: { brand: 'Amoxil', generic: 'amoxicillin', strength: '125mg/5ml' },
        sig: {
          templateId: 't',
          dose: { value: 5, unit: 'ml' },
          frequency: 'TID',
          duration: { value: 5, unit: 'day' },
        },
      },
    ],
  });
});

afterEach(async () => {
  clearDeviceRole();
  cleanup();
  const database = await db.db();
  for (const store of ['prescriptions', 'patients', 'patientClinical'] as const) {
    await database.clear(store);
  }
});

async function linkAndOpenChart(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByText(/link to a patient record/i));
  await user.type(screen.getByLabelText('Search by name'), 'Hassan');
  await user.click(await screen.findByText(/Hassan Raza/));
  await user.click(await screen.findByText(/^chart$/i));
}

describe('the chart', () => {
  it('shows what was prescribed before, with its duration', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    await linkAndOpenChart(user);

    await user.click(await screen.findByRole('button', { name: /Medications/ }));
    // Grouped by generic, not by brand: the question is "has this child had
    // amoxicillin", and the answer must not depend on which brand was written.
    const row = await screen.findByText('amoxicillin');
    await user.click(row);
    expect(await screen.findByText(/5 day/)).toBeTruthy();
    expect(screen.getByText(/as Amoxil/)).toBeTruthy();
  });

  it('lists the past visit without loading any of it', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    await linkAndOpenChart(user);
    await user.click(await screen.findByRole('button', { name: /Visits/ }));
    expect(await screen.findByText('Acute gastroenteritis')).toBeTruthy();
    // Nothing from March is on today's script.
    expect(screen.queryByDisplayValue('Amoxil')).toBeNull();
  });

  it('records an allergy that then reaches the banner', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    await linkAndOpenChart(user);

    expect(await screen.findByText(/Nothing recorded/)).toBeTruthy();
    await user.type(screen.getByLabelText('Allergy substance'), 'penicillin');
    await user.click(screen.getByRole('button', { name: 'Severe' }));
    await user.click(screen.getByRole('button', { name: /Record this allergy/ }));

    await waitFor(async () =>
      expect((await db.getPatientClinical(PID))?.allergies[0]?.substance).toBe('penicillin'),
    );

    // Back to the script: the banner is fed from the recorded list the next
    // time the patient is linked, which is what makes recording it worth doing.
    await user.click(screen.getByRole('button', { name: /Close/ }));
    await user.click(await screen.findByText(/^unlink$/i));
    await user.click(await screen.findByText(/link to a patient record/i));
    await user.click(await screen.findByText(/Hassan Raza/));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toMatch(/penicillin/i);
    expect(banner.getAttribute('data-severity')).toBe('severe');
  });

  it('says "nothing recorded" rather than "none known"', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    await linkAndOpenChart(user);
    // The difference between "nobody asked" and "asked, and there are none" is
    // the only thing an allergy screen must never blur.
    const empty = await screen.findByText(/Nothing recorded/);
    expect(empty.textContent).toMatch(/not the same as/i);
  });
});
