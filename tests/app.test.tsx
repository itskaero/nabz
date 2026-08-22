/**
 * @vitest-environment jsdom
 *
 * UI smoke tests. Not a pixel check -- these assert the behaviours the spec
 * makes promises about, at the level a doctor would notice:
 *
 *  - the section tabs show which language each section prints in, because the
 *    language-by-audience model is the product and has to be visible;
 *  - an unknown drug is accepted and the row says what is still missing rather
 *    than filling it in;
 *  - the sig editor writes nothing until the doctor chooses it;
 *  - advice tier 2 offers no free-text field at all.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@render/screen/App.tsx';
import { StoreProvider } from '@render/screen/store.tsx';
import { paediatrics } from '@data/packs/index.ts';
import { packs as shippedPhrases } from '@data/phrases/index.ts';
import { publishContent, resetContentCache, revertToShipped } from '@data/provider.ts';

afterEach(async () => {
  cleanup();
  await revertToShipped();
  resetContentCache();
});

const renderApp = () =>
  render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );

describe('shell', () => {
  it('tags every section with the language it prints in', async () => {
    renderApp();
    const tabs = await screen.findAllByRole('tab');
    const labelled = tabs.map((t) => t.textContent);
    expect(labelled.some((t) => t?.includes('Problems') && t.includes('EN'))).toBe(true);
    // medications print both, advice is patient-first
    expect(labelled.some((t) => t?.includes('Medicines') && t.includes('EN·UR'))).toBe(true);
    expect(labelled.some((t) => t?.includes('Advice') && t.includes('UR·EN'))).toBe(true);
  });

  it('says records live on this device, without burying it', async () => {
    renderApp();
    // findBy, not getBy: the store resolves its content asynchronously, and a
    // synchronous assertion here races that update.
    expect(await screen.findByText(/on this device only/i)).toBeTruthy();
  });

  it('shows the allergy banner the moment an allergy is entered', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByPlaceholderText('none known'), 'Penicillin');
    // Exactly one alert on the page, and it is the allergy. Anything else that
    // needs saying uses role="status" (DESIGN.md 3: red, and the alert role
    // with it, mean danger and nothing else).
    expect(screen.getByRole('alert').textContent).toContain('Penicillin');
  });

  it('explains a typesetting failure instead of showing a blank page', async () => {
    // jsdom has no fetch for /fonts/*, so the shaper genuinely fails to load
    // here -- which makes this the real failure path, not a simulated one.
    renderApp();
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/preview and print are\s+unavailable/);
    expect(status.textContent).toContain('still write and save');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});

describe('problems and diagnosis are free text', () => {
  it('accepts anything typed', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByPlaceholderText(/Fever for 3 days/), 'Fever for 3 days');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Fever for 3 days')).toBeTruthy();
    expect(screen.getAllByRole('tab')[0]!.textContent).toContain('1');
  });

  it('offers no chips for diagnosis', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('tab', { name: /Diagnosis/ }));
    expect(document.querySelectorAll('.chip').length).toBe(0);
    expect(screen.getByText(/diagnosis is judgement/i)).toBeTruthy();
  });
});

describe('examination chips', () => {
  it('cycles untouched to present to absent, and records the negative', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Exam/ }));

    const chip = screen.getByRole('button', { name: /^wheeze:/ });
    expect(chip.getAttribute('data-state')).toBe('none');

    await user.click(chip);
    expect(screen.getByRole('button', { name: /^wheeze:/ }).getAttribute('data-state')).toBe(
      'present',
    );

    await user.click(screen.getByRole('button', { name: /^wheeze:/ }));
    expect(screen.getByRole('button', { name: /^wheeze:/ }).getAttribute('data-state')).toBe(
      'absent',
    );
    // the pertinent negative composes into the printed English prose
    expect(screen.getByText(/no wheeze/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^wheeze:/ }));
    expect(screen.getByRole('button', { name: /^wheeze:/ }).getAttribute('data-state')).toBe(
      'none',
    );
  });
});

describe('medications', () => {
  it('accepts an unknown drug and never invents the instructions', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Medicines/ }));

    await user.type(
      screen.getByPlaceholderText(/Brand or generic/),
      'Something Not In The List',
    );
    await user.click(screen.getByRole('button', { name: 'Add as typed' }));

    // the sig editor opens on the new line and shows nothing pre-filled
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Nothing is filled in for you/)).toBeTruthy();
    expect(within(dialog).getByText(/Still needed/)).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Something Not In The List')).toBeTruthy();
    expect(screen.getByText(/Tap below to set/)).toBeTruthy();
  });

  it('autocompletes a brand name and offers its strength as a suggestion', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Medicines/ }));
    await user.type(screen.getByPlaceholderText(/Brand or generic/), 'Amoxil');

    const suggestion = screen.getAllByRole('button', { name: /Amoxil/ })[0]!;
    expect(suggestion.textContent).toContain('Amoxicillin');
    await user.click(suggestion);

    const dialog = screen.getByRole('dialog');
    // the dose is still the doctor's to choose
    expect(within(dialog).getByText(/Still needed/)).toBeTruthy();
  });

  it('composes both languages live as the doctor fills the slots', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Medicines/ }));
    await user.type(screen.getByPlaceholderText(/Brand or generic/), 'Calpol');
    await user.click(screen.getAllByRole('button', { name: /Calpol/ })[0]!);

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Dose amount'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'three times a day' }));
    await user.click(within(dialog).getByRole('button', { name: 'after food' }));

    expect(within(dialog).getByText(/Give 5 ml three times a day after food/)).toBeTruthy();
    // and the Urdu is composed in its own word order, not a reversal
    const urdu = dialog.querySelector('.live-preview .ur')!;
    expect(urdu.textContent).toContain('دن میں تین بار');
    expect(urdu.textContent).toContain('کھانے کے بعد');
    expect(urdu.getAttribute('dir')).toBe('rtl');
  });
});

describe('advice tiers', () => {
  it('gives red flags no free-text field at all', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Advice/ }));
    await user.click(screen.getByRole('button', { name: 'Red flags' }));

    expect(screen.getByText(/Library only/i)).toBeTruthy();
    // no textarea exists in this tier -- the constraint is structural
    expect(document.querySelectorAll('textarea').length).toBe(0);
  });

  it('marks the doctor’s own words as not vetted', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Advice/ }));
    await user.click(screen.getByRole('button', { name: 'My own words' }));

    expect(screen.getByText(/Prints exactly as typed/)).toBeTruthy();
    await user.type(screen.getByPlaceholderText(/اپنے الفاظ/), 'ٹھنڈی چیزیں نہ دیں');
    await user.click(screen.getByRole('button', { name: 'Add my line' }));

    const item = document.querySelector('[data-vouch="doctors-own"]')!;
    expect(item).toBeTruthy();
    expect(item.textContent).toContain('prints as typed, not translated');
  });

  it('adds a vetted red flag with its Urdu already reviewed', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Advice/ }));
    await user.click(screen.getByRole('button', { name: 'Red flags' }));
    await user.click(screen.getByRole('button', { name: /breathing becomes fast/ }));

    const item = document.querySelector('[data-vouch="red-flag"]')!;
    expect(item.textContent).toContain('اگر سانس تیز یا مشکل ہو جائے');
  });
});


describe('edited content reaches the app', () => {
  it('renames an exam chip and the Exam tab shows the new label', async () => {
    // The whole point of the builder: content edited there is what the doctor
    // then works with, and what ends up on the patient's script.
    const pack = structuredClone(paediatrics);
    const respiratory = pack.findingsPalette.respiratory!;
    const wheeze = respiratory.find((f) => f.id === 'wheeze')!;
    wheeze.label = 'expiratory wheeze';
    expect((await publishContent(pack, shippedPhrases)).ok).toBe(true);
    resetContentCache();

    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Exam/ }));

    expect(await screen.findByRole('button', { name: /^expiratory wheeze:/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^wheeze:/ })).toBeNull();
  });

  it('uses edited Urdu wording when composing the patient instruction', async () => {
    const phrases = structuredClone(shippedPhrases);
    phrases['ur-PK'].vocab.frequency!.TID = 'روزانہ تین مرتبہ';
    expect((await publishContent(paediatrics, phrases)).ok).toBe(true);
    resetContentCache();

    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /Medicines/ }));
    await user.type(screen.getByPlaceholderText(/Brand or generic/), 'Calpol');
    await user.click(screen.getAllByRole('button', { name: /Calpol/ })[0]!);

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Dose amount'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'three times a day' }));

    const urdu = dialog.querySelector('.live-preview .ur')!;
    expect(urdu.textContent).toContain('روزانہ تین مرتبہ');
    expect(urdu.textContent).not.toContain('دن میں تین بار');
  });

  it('ignores invalid stored content and says so rather than degrading quietly', async () => {
    const phrases = structuredClone(shippedPhrases);
    await publishContent(paediatrics, phrases);
    const db = await import('@storage/db.ts');
    const stored = (await db.loadContent())!;
    delete stored.phrases['ur-PK'].templates['sig.oral.liquid'];
    await db.saveContent(stored);
    resetContentCache();

    renderApp();
    const statuses = await screen.findAllByRole('status');
    const message = statuses.map((s) => s.textContent).join(' ');
    expect(message).toContain('edited content did not load');
    expect(message).toContain('sig.oral.liquid');
  });
});
