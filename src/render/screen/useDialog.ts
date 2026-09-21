/**
 * Make `aria-modal="true"` true.
 *
 * Eleven surfaces in this app render `<div className="scrim" role="dialog"
 * aria-modal="true">`, and not one of them trapped focus, moved focus in,
 * restored it on close, or closed on Escape. `aria-modal` is a PROMISE to
 * assistive technology that everything behind the dialog is inert; a screen
 * reader believes it and stops announcing the page underneath. So a doctor
 * using one could tab straight out of the dose editor into the prescription
 * behind it while the reader still insisted they were in a dialog — and the
 * next thing they typed went somewhere they could not see.
 *
 * This is the behaviour a component library would have brought with it. It is
 * also the argument for not bringing one: what was missing here is about sixty
 * lines, and the alternative was a Radix dependency tree inside a PWA that has
 * to work from a file on a clinic PC with no internet.
 *
 * `onClose` is OPTIONAL. Some of these dialogs are a decision that has to be
 * made — the legacy-growth resolver, the device-role picker — and giving those
 * an Escape key would be offering an exit that does not exist.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Deliberately NOT filtered on `offsetParent`, the usual shorthand for "is it
 * on screen". It is wrong twice: it is null for any `position: fixed` element,
 * which the scrim itself is, and jsdom has no layout at all so it is null for
 * everything -- which would have made this whole file untestable while looking
 * like it worked.
 *
 * Attributes instead. This app hides things by not rendering them, so the
 * cases left are a disabled control and something explicitly marked hidden.
 */
function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
  );
}

export function useDialog(ref: RefObject<HTMLElement | null>, onClose?: () => void): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // Where the doctor was before this opened, so they go back there rather
    // than to the top of the document.
    const returnTo = document.activeElement as HTMLElement | null;

    /*
      Focus the first control, not the dialog itself. A dose editor that opens
      with the cursor already in the dose field saves a tap on every single
      medication, which on a busy OPD morning is the difference between a
      keyboard being usable and being ignored.
    */
    const first = focusable(root)[0];
    if (first) first.focus();
    else root.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;

      // Wrap at both ends. Without this the tab order simply continues into
      // the page behind, which is the whole defect.
      if (e.shiftKey && (active === firstItem || !root.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      // Only take focus back if it is still inside the dialog that is closing;
      // an action that deliberately moved focus elsewhere keeps it.
      if (!returnTo || !returnTo.isConnected) return;
      if (document.activeElement === document.body || root.contains(document.activeElement)) {
        returnTo.focus();
      }
    };
  }, [ref, onClose]);
}
