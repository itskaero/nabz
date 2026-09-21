/**
 * The modal scrim, with the behaviour `aria-modal="true"` has been claiming.
 *
 * Every dialog in this app used to be a bare `<div className="scrim"
 * role="dialog" aria-modal="true">`. The attributes were right and the
 * behaviour behind them was missing: nothing trapped focus, moved focus in,
 * gave it back on close, or listened for Escape. See `useDialog.ts` for why
 * that is worse than having claimed nothing.
 *
 * The inner `.sheet-modal` stays at the call site. This component owns the
 * behaviour, not the layout — a confirmation with two buttons and the pack
 * builder's import preview want very different boxes, and flattening that into
 * a prop list is how a wrapper stops being worth using.
 */
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useDialog } from '../useDialog.ts';

interface Props {
  children: ReactNode;
  /** Names the dialog for a screen reader. Omit only when a heading inside is labelled. */
  label?: string;
  /**
   * Escape, and a click on the backdrop. OMIT IT for a dialog that is a
   * decision rather than an interruption — offering an exit that does not
   * exist is worse than offering none.
   */
  onClose?: () => void;
}

export function Dialog({ children, label, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <div
      ref={ref}
      className="scrim"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // A click on the backdrop, but never a click that started inside the box
      // and ended outside it — that is a drag-select of some text, not a
      // dismissal, and losing a half-typed dose to one is unforgivable.
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
