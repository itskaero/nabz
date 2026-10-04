/**
 * A code, one box per digit.
 *
 * WHAT THIS REPLACES. A single text input with the placeholder `000000`, into
 * which a receptionist types six digits read off another screen across the
 * room. Nothing told them how many digits were wanted, nothing showed how far
 * they had got, and a mistyped digit meant selecting the whole field and
 * starting again.
 *
 * WHY IT IS EASIER. The boxes ARE the instruction: six boxes means six digits,
 * and the filled ones are the progress bar. Each box is a tap target in its own
 * right, so correcting the fourth digit is one tap rather than a text selection
 * on a phone. Backspace walks back a box at a time. A pasted code fills the
 * whole row, which is what actually happens when the two devices are a laptop
 * and a phone being held side by side.
 *
 * The pattern is React Bits' Code Slots. What matters here is that it is still
 * ONE value and one `onChange` — the boxes are a presentation of a string, not
 * six pieces of state, so nothing downstream has to know they exist.
 */
import { useRef } from 'react';

export interface CodeSlotsProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (() => void) | undefined;
  length?: number;
  label: string;
}

export function CodeSlots({ value, onChange, onComplete, length = 6, label }: CodeSlotsProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, '').slice(0, length);

  const write = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.();
    // Focus follows the value rather than the keystroke: a paste of six digits
    // and six separate taps both end on the same box.
    const at = Math.min(clean.length, length - 1);
    boxes.current[at]?.focus();
  };

  return (
    <div className="slots" role="group" aria-label={label}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          className="slot-box"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          data-filled={digits[i] ? 'true' : undefined}
          value={digits[i] ?? ''}
          /*
            Paste is its own event, and has to be.

            `maxLength={1}` means the DOM truncates a pasted code to its first
            character before `onChange` ever sees it — so reading the value
            there delivered "4" out of "482913" and the whole reason for
            handling a paste was silently gone. The clipboard is read directly,
            and the default is prevented so the truncated write never happens.

            This is the case that actually occurs: the code is on a laptop and
            the phone is in the other hand.
          */
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
            if (!pasted) return;
            e.preventDefault();
            write(digits.slice(0, i) + pasted);
          }}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '');
            if (!typed) return;
            write(digits.slice(0, i) + typed + digits.slice(i + 1));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (digits[i]) write(digits.slice(0, i) + digits.slice(i + 1));
              else if (i > 0) {
                write(digits.slice(0, i - 1) + digits.slice(i));
                boxes.current[i - 1]?.focus();
              }
            } else if (e.key === 'ArrowLeft' && i > 0) {
              boxes.current[i - 1]?.focus();
            } else if (e.key === 'ArrowRight' && i < length - 1) {
              boxes.current[i + 1]?.focus();
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
        />
      ))}
    </div>
  );
}
