/**
 * The composed-text carrier.
 *
 * Composition does NOT return a string. It returns runs, because two consumers
 * need different things from the same sentence:
 *
 *   - the DOM needs a string with bidi isolate controls in it;
 *   - the PDF renderer needs to know which spans are clinical VALUES (so it can
 *     set them in mono) and which are Urdu prose (Nastaliq), and it needs the
 *     LTR spans identified so it can lay them out without the shaper dragging
 *     the dose across the line.
 *
 * Flattening to a string first and re-detecting spans later loses information we
 * already had, and the thing we would be re-detecting is the dose. So: runs.
 * See DESIGN.md 4 (mono containment) and 6 (bidi).
 */
import type { Direction, Locale } from './locale.ts';
import { isolateForHost, stripIsolates } from './bidi.ts';

/**
 * What a span IS, semantically. Drives font choice, never colour alone.
 *  - `prose`  : ordinary sentence text in the run's own script
 *  - `value`  : a clinical value (dose, strength, duration count) -- set in mono
 *  - `name`   : a proper name (drug brand/generic) -- Latin even inside Urdu
 */
export type RunKind = 'prose' | 'value' | 'name';

export interface TextRun {
  text: string;
  dir: Direction;
  kind: RunKind;
}

export interface ComposedText {
  locale: Locale;
  /** direction of the line as a whole */
  dir: Direction;
  runs: TextRun[];
  /** display string with bidi isolates inserted; safe to drop straight into the DOM */
  plain: string;
}

export function makeComposedText(
  locale: Locale,
  dir: Direction,
  runs: TextRun[],
): ComposedText {
  const kept = runs.filter((r) => r.text.length > 0);
  const plain = kept
    .map((r) => (r.dir === dir ? r.text : isolateForHost(r.text, dir)))
    .join('');
  return { locale, dir, runs: kept, plain };
}

/** Human-readable text with the invisible controls removed. For tests and search. */
export function toPlainText(text: ComposedText): string {
  return stripIsolates(text.plain);
}

/** Concatenate composed lines that share a locale (e.g. an advice list). */
export function joinComposed(
  parts: ComposedText[],
  separator: string,
): ComposedText | null {
  const first = parts[0];
  if (!first) return null;
  const runs: TextRun[] = [];
  parts.forEach((part, i) => {
    if (i > 0) runs.push({ text: separator, dir: first.dir, kind: 'prose' });
    runs.push(...part.runs);
  });
  return makeComposedText(first.locale, first.dir, runs);
}
