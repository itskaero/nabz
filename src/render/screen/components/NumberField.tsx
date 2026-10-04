/**
 * A number you can actually type, and reach.
 *
 * THE BUG THIS EXISTS TO FIX. The patient bar bound the weight straight to
 * `Number(e.target.value)` and rendered the number back. Typing a decimal
 * therefore could not work:
 *
 *     type "3"    value 3     input shows "3"
 *     type "."    Number("3.") is 3, so the input re-renders as "3"
 *     type "4"    the field now holds "34"
 *
 * A 3.4 kg neonate became 34 kg, and every mg/kg dose in the app is multiplied
 * by ten. The cause is the oldest one in controlled inputs: a number is not a
 * string, and "3." is a legitimate thing for a string to be halfway through
 * being. So this keeps the DRAFT as text while the field is being typed in,
 * and only ever reports a number when the text is one.
 *
 * THE REACH PART. A weight is adjusted far more often than it is first entered
 * — the child was weighed in a vest, the scale read 12.8 and the chart says
 * 12.5 — and a stepper is a 44px target against a text caret inside a 16px
 * field. The buttons are plus and minus at the field's own height, placed at
 * either end the way React Bits' Elastic Slider places its two icons, so a
 * thumb can nudge the value without the keyboard ever appearing.
 */
import { useEffect, useRef, useState } from 'react';

export interface NumberFieldProps {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  label: string;
  /** what one press of + or − moves */
  step?: number;
  min?: number;
  max?: number;
  /** decimal places the steppers round to, so 0.1 + 0.2 never shows 0.30000000000000004 */
  places?: number;
  placeholder?: string;
  id?: string;
}

/** Text that is on its way to being a number: "", "3", "3.", "3.4", "-" */
const PARTIAL = /^-?\d*\.?\d*$/;

function clamp(n: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

export function NumberField({
  value,
  onChange,
  label,
  step = 1,
  min,
  max,
  places = 1,
  placeholder,
  id,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  /*
    The draft is dropped whenever the value changes from OUTSIDE — a patient
    being linked, a record being loaded. Without this the field would keep
    showing what somebody half-typed into the previous patient's weight.
  */
  useEffect(() => {
    setDraft(null);
  }, [value]);

  const shown = draft ?? (value === undefined ? '' : String(value));

  const bump = (by: number) => {
    const base = value ?? 0;
    const next = clamp(Number((base + by).toFixed(places)), min, max);
    setDraft(null);
    onChange(next);
    input.current?.focus();
  };

  return (
    <div className="numfield">
      <button
        type="button"
        className="numfield-step"
        aria-label={`${label}: less`}
        onClick={() => bump(-step)}
      >
        −
      </button>
      <input
        ref={input}
        id={id}
        className="numfield-input"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder ?? ''}
        value={shown}
        onChange={(e) => {
          const text = e.target.value.trim();
          // Anything that is not on its way to being a number is simply not
          // accepted — the field never shows a state it could not report.
          if (text !== '' && !PARTIAL.test(text)) return;
          setDraft(text);
          if (text === '') {
            onChange(undefined);
            return;
          }
          const n = Number(text);
          // "3." and "." parse to 3 and NaN. The first must NOT be reported as
          // 3 yet, because reporting it is what re-rendered the dot away.
          if (!Number.isFinite(n) || /\.$/.test(text)) return;
          onChange(clamp(n, min, max));
        }}
        onBlur={() => {
          // Leaving the field settles whatever was half-typed: "3." becomes 3,
          // "." becomes empty.
          const n = Number(draft);
          if (draft !== null) {
            if (draft === '' || !Number.isFinite(n)) onChange(undefined);
            else onChange(clamp(n, min, max));
          }
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            bump(step);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            bump(-step);
          }
        }}
      />
      <button
        type="button"
        className="numfield-step"
        aria-label={`${label}: more`}
        onClick={() => bump(step)}
      >
        +
      </button>
    </div>
  );
}
