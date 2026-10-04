/**
 * @vitest-environment jsdom
 *
 * The three controls that changed because they were hard to HIT, not because
 * they were hard to look at. Each replaced something whose target was the
 * width of its own text or sat in the corner furthest from a thumb.
 *
 * What is tested is the behaviour that makes them easier, not the look: that
 * every option is reachable from the keyboard, that a pasted code lands whole,
 * and that the information you need in order to choose is present before the
 * choice rather than after it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrengthSelect } from '@render/screen/components/StrengthSelect.tsx';
import { CodeSlots } from '@render/screen/components/CodeSlots.tsx';
import type { DosingEntry, FormularyEntry } from '@domain/pack.ts';
import { parseConcentration } from '@domain/dose.ts';

afterEach(cleanup);

const bottle = (strength: string): FormularyEntry => {
  const row: FormularyEntry = { brand: 'X', generic: 'Paracetamol', strength, provenance: 'manual' };
  const c = parseConcentration(strength);
  if (c) row.concentration = c;
  return row;
};

const paracetamol: DosingEntry = {
  generic: 'Paracetamol',
  route: 'oral',
  mgPerKg: 10,
  mgPerKgHigh: 15,
  perDoses: 4,
  reference: 'WHO Pocket Book of Hospital Care for Children, 2nd ed.',
  verified: false,
};

describe('choosing which bottle', () => {
  /*
    The reason this replaced a row of chips. 150 mg is 6 ml of one bottle and
    1.5 ml of another, and a doctor used to have to pick blind and read the
    consequence afterwards. Every option now carries its own consequence.
  */
  it('says what each bottle would come to, before the choice is made', async () => {
    const user = userEvent.setup();
    render(
      <StrengthSelect
        options={[bottle('120mg/5ml'), bottle('100mg/ml'), bottle('500mg')]}
        value="120mg/5ml"
        onChange={() => {}}
        entry={paracetamol}
        weightKg={10}
      />,
    );
    await user.click(screen.getByRole('button', { name: /120mg\/5ml/ }));

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    // 150 mg at 24 mg/ml is 6.25 ml, and the largest whole millilitre inside
    // the 100-150 mg band is 6.
    expect(options[0]!.textContent).toContain('6 ml');
    /*
      150 mg at 100 mg/ml is 1.5 ml, and the suggestion is 1 ml — which is the
      documented rule working rather than a bug. `suggestRounded` prefers a
      whole millilitre to a half, and 1 is the largest whole inside the
      1.0-1.5 band. It is the same rule that gives 3 ml of 200 mg/5 ml and
      7 ml of 100 mg/5 ml in the worked example this was built from.
    */
    expect(options[1]!.textContent).toContain('1 ml');
    // A tablet has no volume, and says so rather than going blank.
    expect(options[2]!.textContent).toContain('no volume');
  });

  it('is operable without a pointer, from open to chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StrengthSelect
        options={[bottle('120mg/5ml'), bottle('100mg/ml'), bottle('250mg/5ml')]}
        value="120mg/5ml"
        onChange={onChange}
        entry={paracetamol}
        weightKg={10}
      />,
    );
    const trigger = screen.getByRole('button', { name: /120mg\/5ml/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}'); // opens
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('100mg/ml');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('leaves on Escape without changing anything', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StrengthSelect
        options={[bottle('120mg/5ml'), bottle('100mg/ml')]}
        value="120mg/5ml"
        onChange={onChange}
      />,
    );
    const trigger = screen.getByRole('button', { name: /120mg\/5ml/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('typing a pairing code', () => {
  it('fills every box from one paste, and reports one string', async () => {
    const user = userEvent.setup();
    let value = '';
    const onChange = vi.fn((next: string) => {
      value = next;
    });
    render(<CodeSlots label="Clinic pairing code" value="" onChange={onChange} />);

    const first = screen.getByLabelText('Clinic pairing code, digit 1 of 6');
    first.focus();
    await user.paste('482913');
    expect(value).toBe('482913');
  });

  it('calls back the moment the last digit lands, so nobody hunts for Pair', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <CodeSlots
        label="Clinic pairing code"
        value="48291"
        onChange={() => {}}
        onComplete={onComplete}
      />,
    );
    const sixth = screen.getByLabelText('Clinic pairing code, digit 6 of 6');
    sixth.focus();
    await user.keyboard('3');
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows how many digits are wanted, which a placeholder never did', () => {
    render(<CodeSlots label="Clinic pairing code" value="482" onChange={() => {}} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    // And how far through: the filled boxes are the progress.
    const filled = screen
      .getAllByRole('textbox')
      .filter((b) => (b as HTMLInputElement).dataset.filled === 'true');
    expect(filled).toHaveLength(3);
  });
});
