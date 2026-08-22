/**
 * Turning composed runs into positioned glyphs: font selection, bidi
 * reordering, and wrapping.
 *
 * The bidi step here is the visual half of the safety rule whose logical half
 * lives in domain/bidi.ts. Composition marks each run's direction; this file
 * decides where each run physically LANDS on the page. Getting it wrong moves
 * a dose next to the wrong word, which is why the reordering is explicit and
 * tested rather than left to whatever the renderer happens to do.
 *
 * ORDER OF OPERATIONS -- and it matters more than it looks:
 *
 *   tokenise (logical) -> merge into segments (logical) -> reorder segments
 *   (visual) -> position left to right
 *
 * Merging BEFORE reordering is not a tidiness choice. Shaping is contextual, so
 * a segment has to hold text in LOGICAL order for HarfBuzz to join the letters
 * correctly -- and HarfBuzz then emits that segment's glyphs in visual order
 * itself. Merge after reordering and the run gets reversed twice: the letters
 * still join, the line still looks like Urdu, and the words are in the wrong
 * order. That is a silently wrong prescription, so the pipeline is fixed here
 * and asserted in tests/print.test.ts.
 */
import type { Direction } from '@domain/locale.ts';
import type { RunKind, TextRun } from '@domain/text.ts';
import type { FontRole, ShapedRun } from './engine.ts';
import { lineHeightFor, measure, shapeRun, verticalMetrics } from './engine.ts';

export interface Segment {
  role: FontRole;
  sizePt: number;
  /** LOGICAL text; HarfBuzz handles the visual order of the glyphs within it */
  text: string;
  dir: Direction;
  /** x offset from the line's left edge, in points */
  x: number;
  widthPt: number;
  shaped: ShapedRun;
}

export interface LaidOutLine {
  segments: Segment[];
  /** the line's text in LOGICAL order; for tests, alt text and search */
  text: string;
  widthPt: number;
  /** distance from the line's top to its baseline */
  ascentPt: number;
  heightPt: number;
}

export interface TypeStyle {
  sizePt: number;
  /** bump for the patient-facing Urdu; enforced against the legibility floor */
  urduSizePt?: number;
  strong?: boolean;
}

/** A decimal separator in a clinical value. Comma is never emitted as one. */
const DECIMAL = /[.٫]/;

/**
 * kind + direction (+ the token itself) -> face.
 *
 * DESIGN.md 4's "mono containment": mono is for clinical values, and it stays
 * out of the patient's Urdu prose. The one exception is the isolated LTR dose
 * token inside an Urdu line, which is bidi safety isolation, not styling -- and
 * that token arrives here as kind 'value', so it lands in a value face correctly.
 *
 * DECIMALS ARE THE ONE DEPARTURE, and it serves DESIGN.md 4's own reasoning
 * rather than contradicting it. The rule exists because "monospace numerals are
 * less mistakable -- '7.5' vs '75'". But a monospaced period is centred in a
 * full-width advance, so Plex Mono renders that very example as "7 . 5", which
 * can be read as two numbers. So a value containing a decimal point is set in
 * the tabular-figure sans instead: same 600-unit digit advance, so columns still
 * line up, and a period that no longer looks like a word space. Integers, which
 * have no such problem, stay in mono.
 */
export function roleFor(
  kind: RunKind,
  dir: Direction,
  strong = false,
  text = '',
): FontRole {
  if (kind === 'value') {
    if (DECIMAL.test(text)) return strong ? 'valueStrong' : 'value';
    return strong ? 'monoBold' : 'mono';
  }
  if (dir === 'rtl') return strong ? 'urduStrong' : 'urdu';
  return strong ? 'latinBold' : 'latin';
}

interface Token {
  text: string;
  dir: Direction;
  kind: RunKind;
  role: FontRole;
  sizePt: number;
  widthPt: number;
  /** whitespace tokens collapse at a line break */
  space: boolean;
}

function tokenise(runs: TextRun[], style: TypeStyle): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    const strong = style.strong ?? false;
    // Urdu gets its own size so the patient block can be set larger than the
    // clinical text without the Latin drifting with it.
    const sizePt =
      run.dir === 'rtl' && run.kind === 'prose' ? (style.urduSizePt ?? style.sizePt) : style.sizePt;
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      // Per token, not per run: "7.5" and "5" in the same run take different
      // faces, and only the token knows which it is.
      const role = roleFor(run.kind, run.dir, strong, piece);
      tokens.push({
        text: piece,
        dir: run.dir,
        kind: run.kind,
        role,
        sizePt,
        widthPt: measure(piece, role, sizePt),
        space: /^\s+$/.test(piece),
      });
    }
  }
  return tokens;
}

interface Chunk {
  role: FontRole;
  sizePt: number;
  dir: Direction;
  text: string;
}

/**
 * Merge adjacent tokens that share a face, size and direction. Logical order.
 *
 * A space keeps the direction and face of the RUN IT CAME FROM -- it is never
 * re-attached to its neighbour. That sounds like a detail and is not: the space
 * between a dose and its unit is authored as part of the Urdu run, so it has to
 * travel with the Urdu when the line is reordered. Give it to the preceding
 * Latin number instead and it lands on the far side of the number, printing
 * "7دن" with the gap stranded at the edge of the line, and in English it comes
 * out as a monospaced gap: "Give 5   ml". Both were real, and both came from
 * one line of misplaced cleverness.
 */
function mergeTokens(tokens: Token[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const token of tokens) {
    const last = chunks[chunks.length - 1];
    if (last && last.role === token.role && last.sizePt === token.sizePt && last.dir === token.dir) {
      last.text += token.text;
    } else {
      chunks.push({ role: token.role, sizePt: token.sizePt, dir: token.dir, text: token.text });
    }
  }
  return chunks;
}

/**
 * Unicode bidi reordering at segment granularity: reverse the line, then
 * re-reverse each maximal group of consecutive left-to-right segments so a
 * Latin drug name or a dose keeps its own internal order inside the Urdu line.
 */
export function visualOrder<T extends { dir: Direction }>(items: T[], base: Direction): T[] {
  if (base === 'ltr') return items;
  const reversed = [...items].reverse();
  const out: T[] = [];
  let i = 0;
  while (i < reversed.length) {
    if (reversed[i]!.dir === 'ltr') {
      let j = i;
      while (j < reversed.length && reversed[j]!.dir === 'ltr') j += 1;
      out.push(...reversed.slice(i, j).reverse());
      i = j;
    } else {
      out.push(reversed[i]!);
      i += 1;
    }
  }
  return out;
}

function buildLine(tokens: Token[], base: Direction): LaidOutLine {
  const logical = mergeTokens(tokens);
  const ordered = visualOrder(logical, base);

  const segments: Segment[] = [];
  let x = 0;
  let ascent = 0;
  let height = 0;

  for (const chunk of ordered) {
    const shaped = shapeRun(chunk.text, chunk.role);
    const widthPt = (shaped.width / shaped.unitsPerEm) * chunk.sizePt;
    segments.push({
      role: chunk.role,
      sizePt: chunk.sizePt,
      text: chunk.text,
      dir: chunk.dir,
      x,
      widthPt,
      shaped,
    });
    x += widthPt;
    const metrics = verticalMetrics(chunk.role, chunk.sizePt);
    ascent = Math.max(ascent, metrics.ascent);
    height = Math.max(height, lineHeightFor(chunk.role, chunk.sizePt));
  }

  return {
    segments,
    text: logical.map((c) => c.text).join(''),
    widthPt: x,
    ascentPt: ascent,
    heightPt: height,
  };
}

/**
 * Wrap composed runs into laid-out lines.
 *
 * Wrapping happens in LOGICAL order -- widths do not depend on visual order --
 * and each finished line is then reordered visually. Doing it the other way
 * round would break words across a direction change.
 */
export function layoutParagraph(
  runs: TextRun[],
  base: Direction,
  maxWidthPt: number,
  style: TypeStyle,
): LaidOutLine[] {
  const tokens = tokenise(runs, style);
  if (tokens.length === 0) return [];

  const lines: Token[][] = [];
  let current: Token[] = [];
  let width = 0;

  for (const token of tokens) {
    if (token.space && current.length === 0) continue; // no leading space on a wrapped line
    if (width + token.widthPt > maxWidthPt && current.length > 0 && !token.space) {
      while (current.length && current[current.length - 1]!.space) current.pop();
      lines.push(current);
      current = [token];
      width = token.widthPt;
    } else {
      current.push(token);
      width += token.widthPt;
    }
  }
  if (current.length) {
    while (current.length && current[current.length - 1]!.space) current.pop();
    lines.push(current);
  }

  return lines.map((line) => buildLine(line, base));
}

/** A single unwrapped line. For labels, table cells, the identity strip. */
export function layoutLine(
  runs: TextRun[],
  base: Direction,
  style: TypeStyle,
): LaidOutLine {
  return buildLine(tokenise(runs, style), base);
}

export function paragraphHeight(lines: LaidOutLine[]): number {
  return lines.reduce((h, l) => h + l.heightPt, 0);
}
