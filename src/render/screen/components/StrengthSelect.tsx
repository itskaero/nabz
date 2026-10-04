/**
 * Which bottle, and what it would mean.
 *
 * WHAT THIS REPLACES. Five chips in a row — `500mg`, `120mg/5ml`, `100mg/ml`,
 * `250mg/5ml`, `125mg` — which wrap onto two lines on a 390px phone, give each
 * option a target the width of its own label, and say nothing about what
 * choosing one would do. The doctor picked a bottle blind and read the
 * millilitres afterwards.
 *
 * WHAT IT IS INSTEAD. A trigger that shows the current strength, and a panel of
 * full-width rows where each option carries THE VOLUME THAT BOTTLE WOULD NEED.
 * The pattern is React Bits' Glide Select; the second column is this app's
 * contribution, and it is the point. 150 mg is 6 ml of one bottle and 1.5 ml of
 * another, and the choice a parent has to measure is now visible before the
 * choice is made rather than after.
 *
 * WHY IT IS EASIER TO REACH. Every option becomes a full-width row at the
 * comfortable tap height rather than a chip sized by its own text, the list
 * opens under the thumb rather than wrapping away from it, and the whole
 * control is one keyboard widget: arrows move, Enter chooses, Escape leaves.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DosingEntry, FormularyEntry } from '@domain/pack.ts';
import { doseFor, mlText, suggestRounded, volumeFor } from '@domain/dose.ts';

export interface StrengthSelectProps {
  options: FormularyEntry[];
  value: string | undefined;
  onChange: (strength: string) => void;
  /** the cited row, so each option can say what it would come to */
  entry?: DosingEntry | undefined;
  weightKg?: number | undefined;
  ageDays?: number | undefined;
}

/** What this bottle would mean for this child, in four words or fewer. */
function consequence(
  option: FormularyEntry,
  entry: DosingEntry | undefined,
  weightKg: number | undefined,
  ageDays: number | undefined,
): string {
  if (!option.concentration) return 'no volume';
  if (!entry) return '';
  const dose = doseFor(entry, { weightKg, ageDays });
  if (!dose.ok) return '';
  const low = volumeFor(dose.dose.mgLow, option.concentration);
  const high = volumeFor(dose.dose.mgHigh, option.concentration);
  if (!low.ok || !high.ok) return '';
  return mlText(suggestRounded(low.ml, high.ml).ml);
}

export function StrengthSelect({
  options,
  value,
  onChange,
  entry,
  weightKg,
  ageDays,
}: StrengthSelectProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  /**
   * Which way the panel opens.
   *
   * The strength row sits near the bottom of a medication card, and on a phone
   * that is behind the action bar — so a panel that always dropped downward was
   * a panel nobody could see, which is how this was first built. It opens
   * upward whenever the trigger is in the lower half of the viewport, which on
   * a phone is almost always and on a desk is almost never.
   */
  const [drop, setDrop] = useState<'down' | 'up'>('down');
  const wrap = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () =>
      options.map((o) => ({
        strength: o.strength ?? '',
        note: consequence(o, entry, weightKg, ageDays),
        /* A solid cannot produce a volume, and saying so beside it is more use
           than letting the millilitre line vanish after the choice is made. */
        solid: !o.concentration,
      })),
    [options, entry, weightKg, ageDays],
  );

  useEffect(() => {
    if (!open) return;
    const at = rows.findIndex((r) => r.strength === value);
    setCursor(at >= 0 ? at : 0);
  }, [open, rows, value]);

  // Close on anything that is not this control: a dropdown that survives a tap
  // elsewhere is a dropdown that covers the thing you were reaching for.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const choose = (at: number) => {
    const row = rows[at];
    if (!row) return;
    onChange(row.strength);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        const box = wrap.current?.getBoundingClientRect();
        if (box) setDrop(box.bottom > window.innerHeight * 0.55 ? 'up' : 'down');
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(cursor);
    }
  };

  const current = rows.find((r) => r.strength === value);

  return (
    <div className="glide" ref={wrap} onKeyDown={onKey}>
      <span className="track-label">strength</span>
      <button
        type="button"
        className="glide-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setDrop(box.bottom > window.innerHeight * 0.55 ? 'up' : 'down');
          setOpen((o) => !o);
        }}
      >
        <span className="mono">{value || 'choose a bottle'}</span>
        {current?.note && <span className="glide-note">{current.note}</span>}
        <span className="glide-caret" aria-hidden="true">
          {open ? '⌃' : '⌄'}
        </span>
      </button>

      {open && (
        <div className="glide-panel" data-drop={drop} role="listbox" aria-label="Strength">
          {rows.map((row, at) => (
            <button
              type="button"
              key={row.strength || at}
              role="option"
              aria-selected={row.strength === value}
              className="glide-row"
              data-cursor={at === cursor ? 'true' : undefined}
              onPointerEnter={() => setCursor(at)}
              onClick={() => choose(at)}
            >
              <span className="mono glide-strength">{row.strength}</span>
              <span className={row.solid ? 'glide-note is-none' : 'glide-note'}>{row.note}</span>
              <span className="glide-tick" aria-hidden="true">
                {row.strength === value ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
