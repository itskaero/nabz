/**
 * @vitest-environment jsdom
 *
 * `aria-modal="true"` is a promise, and this is the suite that keeps it.
 *
 * Eleven surfaces in this app declared it and none of them behaved like a
 * modal: a doctor could tab straight out of the dose editor into the
 * prescription behind it while a screen reader went on insisting they were in
 * a dialog. Everything below is the behaviour that claim implies, asserted
 * once, on the wrapper every one of those surfaces now uses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '@render/screen/components/Dialog.tsx';
import { useDialog } from '@render/screen/useDialog.ts';

afterEach(cleanup);

function Box({ onClose }: { onClose?: () => void }) {
  return (
    <Dialog label="Edit instructions" {...(onClose ? { onClose } : {})}>
      <div className="sheet-modal">
        <input aria-label="dose" />
        <button>Confirm</button>
      </div>
    </Dialog>
  );
}

function Page({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Behind</button>
      {open && <Box {...(onClose ? { onClose } : {})} />}
    </>
  );
}

describe('a dialog', () => {
  it('puts the cursor in the first field, not on the box', async () => {
    // A dose editor that opens with the cursor already in the dose field saves
    // a tap on every medication; on an OPD morning that is the difference
    // between a keyboard being usable and being ignored.
    render(<Box onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByLabelText('dose'));
  });

  it('keeps Tab inside it', async () => {
    const user = userEvent.setup();
    render(<Page onClose={() => {}} />);
    await user.click(screen.getByText('Open'));

    const dose = screen.getByLabelText('dose');
    const confirm = screen.getByText('Confirm');
    expect(document.activeElement).toBe(dose);

    await user.tab();
    expect(document.activeElement).toBe(confirm);
    // This is the defect: without a trap the next Tab lands on "Behind",
    // in the prescription the doctor cannot see.
    await user.tab();
    expect(document.activeElement).toBe(dose);
  });

  it('wraps backwards too', async () => {
    const user = userEvent.setup();
    render(<Box onClose={() => {}} />);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByText('Confirm'));
  });

  it('gives focus back to whatever opened it', async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && <Box onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByText('Open');
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Box onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers no exit when there is none', async () => {
    // A dialog that is a DECISION rather than an interruption -- the
    // legacy-growth resolver, the device-role picker -- passes no onClose, and
    // Escape must not appear to work.
    const user = userEvent.setup();
    render(<Box />);
    await user.keyboard('{Escape}');
    expect(screen.getByLabelText('dose')).toBeTruthy();
  });

  it('dismisses on a click on the backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Box onClose={onClose} />);
    await user.click(container.querySelector('.scrim')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not dismiss on a click that started inside the box', async () => {
    // Dragging to select a dose and releasing past the edge of the sheet is a
    // drag, not a dismissal, and losing a half-typed dose to one is
    // unforgivable.
    const onClose = vi.fn();
    const { container } = render(<Box onClose={onClose} />);
    const scrim = container.querySelector('.scrim')!;
    const inside = screen.getByText('Confirm');
    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    scrim.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('still behaves when the box has nothing focusable in it', () => {
    function Empty() {
      const ref = useRef<HTMLDivElement>(null);
      useDialog(ref);
      return (
        <div ref={ref} tabIndex={-1}>
          <p>Nothing to press.</p>
        </div>
      );
    }
    expect(() => render(<Empty />)).not.toThrow();
  });
});
