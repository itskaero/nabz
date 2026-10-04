/**
 * @vitest-environment jsdom
 *
 * The drug search, which was a plain input with a list of buttons under it.
 *
 * Two things were wrong, and the second is the one that mattered. The list was
 * unreachable from the keyboard in any useful way — Tab reached "Add as typed"
 * first and then walked into eight suggestions one at a time. And Enter added
 * the TYPED TEXT as a raw drug even with the right catalogue row sitting first
 * in the list: a raw drug carries no generic, the dosing table joins on
 * generic, so the fastest path through this field produced the one kind of
 * record that can never get a dose suggestion.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MedicationsSection } from '@render/screen/sections/MedicationsSection.tsx';
import { StoreProvider } from '@render/screen/store.tsx';
import { setDeviceRole, clearDeviceRole } from '@domain/deviceRole.ts';
import * as db from '@storage/db.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';

beforeEach(async () => {
  setDeviceRole('consulting');
  await db.saveProfile(defaultDoctorProfile);
});
afterEach(async () => {
  clearDeviceRole();
  cleanup();
});

const open = () =>
  render(
    <StoreProvider>
      <MedicationsSection />
    </StoreProvider>,
  );

describe('picking a medicine', () => {
  it('announces itself as a combobox, so a screen reader offers the list', async () => {
    const user = userEvent.setup();
    open();
    const box = await screen.findByRole('combobox');
    await user.type(box, 'Calpol');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(box.getAttribute('aria-controls')).toBe('drug-suggestions');
  });

  it('walks the list with the arrows and tells the reader where it is', async () => {
    const user = userEvent.setup();
    open();
    const box = await screen.findByRole('combobox');
    await user.type(box, 'Calpol');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));

    // Nothing is highlighted to begin with: Enter must keep meaning "add what
    // I typed" until somebody deliberately moves into the list.
    expect(box.getAttribute('aria-activedescendant')).toBeNull();

    await user.keyboard('{ArrowDown}');
    expect(box.getAttribute('aria-activedescendant')).toBe('drug-opt-0');
    await user.keyboard('{ArrowDown}');
    expect(box.getAttribute('aria-activedescendant')).toBe('drug-opt-1');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(box.getAttribute('aria-activedescendant')).toBeNull();
  });

  /*
    The data-quality half. A catalogue row carries the generic, and the generic
    is what the dosing table joins on — so taking the row rather than the typed
    string is the difference between a medication that can be dosed and one
    that cannot.
  */
  it('takes the whole catalogue row on Enter, not the text that was typed', async () => {
    const user = userEvent.setup();
    open();
    const box = await screen.findByRole('combobox');
    await user.type(box, 'Calpo');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.keyboard('{ArrowDown}{Enter}');

    /*
      Asserted on the card, not on the text.

      The drug's name appears twice inside one medication row — once as the
      brand heading and once inside the composed sig sentence — so a text
      query matches two nodes in a single card and reads like two cards.
      Counting the cards is the thing actually being claimed.
    */
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(1);
    // The generic came across, which is the whole point: the dosing table
    // joins on it, and a raw drug would have none.
    expect(cards[0]!.textContent).toContain('Paracetamol');
    // And so the cited dose is offered, which it could not have been.
    expect(cards[0]!.textContent).toMatch(/mg\/kg/);
  });

  it('still adds an unknown medicine on Enter, because nobody may be blocked', async () => {
    const user = userEvent.setup();
    open();
    const box = await screen.findByRole('combobox');
    await user.type(box, 'Something Imported{Enter}');
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.textContent).toContain('Something Imported');
  });
});
