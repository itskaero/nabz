/**
 * The text engine. ONE shaper, used by the PDF backend and the screen preview
 * alike, so "preview == print" is true by construction rather than by
 * discipline (PRODUCT.md 5, 10).
 *
 * WHY HARFBUZZ AND NOT THE PDF LIBRARY'S OWN SHAPER
 * -------------------------------------------------
 * The obvious build is pdf-lib + fontkit with the Nastaliq face embedded.
 * It does not work: fontkit throws on Noto Nastaliq Urdu's GPOS anchors
 * (`Cannot read properties of null (reading 'xCoordinate')` -- NULL anchors are
 * legal OpenType and fontkit does not guard them), and it fails the same way on
 * every Nastaliq face tried. Naskh faces shape fine, which is exactly the trap:
 * the pipeline would look healthy while quietly printing Urdu in the wrong
 * script. Nastaliq IS the product (DESIGN.md 4), so the shaper is HarfBuzz --
 * the same engine browsers use.
 *
 * Consequence, deliberately accepted: glyphs are drawn as OUTLINES, not as
 * embedded-font text. Both backends draw the same paths, so what the doctor
 * previews is exactly what the PDF prints, and no font has to survive a
 * round-trip through a PDF viewer's own shaper. The cost is that text in the
 * PDF is not selectable. For a document whose delivery format is paper handed
 * to a parent, that is the right trade.
 */
import type * as hbTypes from 'harfbuzzjs';

/**
 * HarfBuzz is imported lazily, not at module scope, and that is a resilience
 * decision rather than a bundle-size one.
 *
 * `harfbuzzjs` instantiates its WASM with a TOP-LEVEL await. Imported
 * statically, anything that stops the WASM loading -- a bad path, a CSP, a
 * half-written cache entry -- rejects the module, which rejects every importer,
 * which renders a blank white page with nothing on it. For a clinical tool
 * running in a clinic, "nothing happens and there is no message" is the worst
 * possible failure. Loading it inside `loadFonts()` makes the failure a caught
 * error the UI can explain.
 */
let hb: typeof hbTypes | null = null;

export type FontRole =
  | 'latin'
  | 'latinBold'
  | 'mono'
  | 'monoBold'
  | 'value'
  | 'valueStrong'
  | 'urdu'
  | 'urduStrong';

interface FontSpec {
  file: string;
  /** variable-font axis settings; one file can serve several weights */
  variations?: Record<string, number>;
  /** OpenType features to force on, e.g. tabular figures */
  features?: string[];
}

/**
 * DESIGN.md 4: geometric Latin sans against flowing Nastaliq is the type
 * personality, and clinical VALUES are monospace because monospaced numerals
 * are less mistakable -- "7.5" vs "75" on a dose is a safety property, not a
 * style choice.
 */
const FONT_SPECS: Record<FontRole, FontSpec> = {
  latin: { file: 'IBMPlexSans.ttf', variations: { wght: 450 } },
  latinBold: { file: 'IBMPlexSans.ttf', variations: { wght: 600 } },
  mono: { file: 'IBMPlexMono-Regular.ttf' },
  monoBold: { file: 'IBMPlexMono-SemiBold.ttf' },
  /**
   * DECIMAL clinical values only -- see roleFor() in line.ts.
   *
   * A monospaced decimal point sits centred in a full-width advance, so Plex
   * Mono prints "7.5" as "7 . 5". On a dose that is the exact misreading
   * DESIGN.md 4 set out to prevent: it can be read as two numbers. Plex Sans
   * keeps the property that matters -- its digits are tabular, 600 units, the
   * same advance as Plex Mono's, so columns still align -- and gives the period
   * 279 units instead of 600. `tnum`/`lnum` are forced on anyway so a future
   * font swap cannot quietly lose tabular figures.
   *
   * The weight sits above body text so a value still reads as data, not prose.
   */
  value: { file: 'IBMPlexSans.ttf', variations: { wght: 520 }, features: ['tnum', 'lnum'] },
  valueStrong: { file: 'IBMPlexSans.ttf', variations: { wght: 640 }, features: ['tnum', 'lnum'] },
  urdu: { file: 'NotoNastaliqUrdu.ttf', variations: { wght: 400 } },
  urduStrong: { file: 'NotoNastaliqUrdu.ttf', variations: { wght: 600 } },
};

export interface PositionedGlyph {
  /**
   * SVG path data in font units with Y POINTING DOWN, glyph origin at (0,0).
   *
   * Fonts are y-up; SVG and this layout engine are y-down, and pdf-lib's
   * `drawSvgPath` flips y once more on its way into PDF's y-up space. Flipping
   * here, once, at the source means the same path string is correct in both
   * backends with no per-backend fix-ups -- which is the point, since a
   * per-backend fix-up is how preview stops equalling print.
   */
  path: string;
  /** pen position in font units relative to the run origin, y down */
  x: number;
  y: number;
}

export interface ShapedRun {
  role: FontRole;
  glyphs: PositionedGlyph[];
  /** total advance, in font units */
  width: number;
  unitsPerEm: number;
  ascender: number;
  descender: number;
}

export interface FontLoader {
  (file: string): Promise<ArrayBuffer | Uint8Array>;
}

interface LoadedFont {
  font: hbTypes.Font;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  features: hbTypes.Feature[];
}

const fonts = new Map<FontRole, LoadedFont>();
const faces = new Map<string, hbTypes.Face>();
const shapeCache = new Map<string, ShapedRun>();
const glyphPathCache = new Map<string, string>();

let loaded = false;

/**
 * Load every face once. Called before any render; the PDF renderer refuses to
 * run without it rather than silently producing a document with no Urdu in it.
 */
export async function loadFonts(load: FontLoader): Promise<void> {
  if (loaded) return;
  hb ??= await import('harfbuzzjs');
  for (const [role, spec] of Object.entries(FONT_SPECS) as Array<[FontRole, FontSpec]>) {
    const lib = hb;
    let face = faces.get(spec.file);
    if (!face) {
      const bytes = await load(spec.file);
      face = new lib.Face(new lib.Blob(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)));
      faces.set(spec.file, face);
    }
    const font = new lib.Font(face);
    if (spec.variations) {
      font.setVariations(
        Object.entries(spec.variations).map(([tag, value]) => new lib.Variation(tag, value)),
      );
    }
    const extents = font.hExtents();
    fonts.set(role, {
      font,
      unitsPerEm: face.upem,
      ascender: extents?.ascender ?? face.upem * 0.8,
      descender: extents?.descender ?? -face.upem * 0.2,
      features: (spec.features ?? []).map(
        (tag) => new lib.Feature(tag, 1, lib.Feature.GLOBAL_START, lib.Feature.GLOBAL_END),
      ),
    });
  }
  loaded = true;
}

export function fontsReady(): boolean {
  return loaded;
}

function fontFor(role: FontRole): LoadedFont {
  const f = fonts.get(role);
  if (!f) {
    throw new Error(
      `text engine: font "${role}" is not loaded. Call loadFonts() before rendering -- ` +
        'rendering without the Nastaliq face would silently drop the patient instructions.',
    );
  }
  return f;
}

/** Re-emit HarfBuzz's outline commands with the Y axis flipped. */
function flipY(commands: hbTypes.SvgPathCommand[]): string {
  let out = '';
  for (const cmd of commands) {
    out += cmd.type;
    for (let i = 0; i < cmd.values.length; i += 1) {
      const value = i % 2 === 1 ? -cmd.values[i]! : cmd.values[i]!;
      out += (i ? ' ' : '') + (Number.isInteger(value) ? value : Number(value.toFixed(2)));
    }
  }
  return out;
}

function glyphPath(role: FontRole, gid: number): string {
  const key = `${role}:${gid}`;
  let path = glyphPathCache.get(key);
  if (path === undefined) {
    path = flipY(fontFor(role).font.glyphToJson(gid));
    glyphPathCache.set(key, path);
  }
  return path;
}

/**
 * Shape one directionally-homogeneous run.
 *
 * HarfBuzz emits glyphs in VISUAL order, so an RTL run comes back already
 * reversed and the caller just lays it out left to right. Cursive joining and
 * mark attachment -- which is nearly all of what makes Nastaliq legible -- are
 * done here, correctly, by the reference implementation.
 */
export function shapeRun(text: string, role: FontRole): ShapedRun {
  const key = role + String.fromCharCode(0) + text;
  const cached = shapeCache.get(key);
  if (cached) return cached;

  const loadedFont = fontFor(role);
  const lib = hb;
  if (!lib) throw new Error('text engine: shapeRun called before loadFonts()');
  const buffer = new lib.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  lib.shape(loadedFont.font, buffer, loadedFont.features);

  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const glyphs: PositionedGlyph[] = [];
  let penX = 0;
  let penY = 0;

  for (let i = 0; i < infos.length; i += 1) {
    const gid = infos[i]!.codepoint;
    const pos = positions[i]!;
    const path = glyphPath(role, gid);
    if (path) {
      // y is negated: the path space is y-down, HarfBuzz offsets are y-up.
      glyphs.push({ path, x: penX + pos.xOffset, y: -(penY + pos.yOffset) });
    }
    penX += pos.xAdvance;
    penY += pos.yAdvance;
  }

  const run: ShapedRun = {
    role,
    glyphs,
    width: penX,
    unitsPerEm: loadedFont.unitsPerEm,
    ascender: loadedFont.ascender,
    descender: loadedFont.descender,
  };
  shapeCache.set(key, run);
  return run;
}

/** Advance width of `text` at `sizePt`, in points. */
export function measure(text: string, role: FontRole, sizePt: number): number {
  if (!text) return 0;
  const run = shapeRun(text, role);
  return (run.width / run.unitsPerEm) * sizePt;
}

/** Ascender / descender at a given size, in points. */
export function verticalMetrics(role: FontRole, sizePt: number): {
  ascent: number;
  descent: number;
  lineHeight: number;
} {
  const f = fontFor(role);
  const scale = sizePt / f.unitsPerEm;
  const ascent = f.ascender * scale;
  const descent = Math.abs(f.descender) * scale;
  return { ascent, descent, lineHeight: ascent + descent };
}

/**
 * Nastaliq's descenders are deep and its baseline sits high; a line height
 * copied from the Latin face crops the Urdu. Measured off the face's own
 * extents rather than guessed at.
 */
export function lineHeightFor(role: FontRole, sizePt: number): number {
  const { lineHeight } = verticalMetrics(role, sizePt);
  return lineHeight * (role.startsWith('urdu') ? 1.02 : 1.18);
}

/** Word-wrap a single-role string to `maxWidthPt`. Returns the lines. */
export function wrapText(
  text: string,
  role: FontRole,
  sizePt: number,
  maxWidthPt: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, role, sizePt) <= maxWidthPt || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Does this face actually have a glyph for `char`?
 *
 * DESIGN.md 8 asks for a glyph plus a border plus a label on every safety
 * state. The glyph is the part that can silently fail -- a missing tick renders
 * as .notdef, and a box-with-a-cross next to a red flag is worse than no mark
 * at all. So callers check first and fall back to the word alone.
 */
export function hasGlyph(role: FontRole, char: string): boolean {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;
  const gid = fontFor(role).font.glyph(codePoint);
  return gid !== undefined && gid !== 0;
}

/** The first of `candidates` this face can actually draw, else `fallback`. */
export function glyphOrFallback(
  role: FontRole,
  candidates: string[],
  fallback: string,
): string {
  for (const candidate of candidates) if (hasGlyph(role, candidate)) return candidate;
  return fallback;
}

/** Test seam: drop caches when a font file is swapped at runtime. */
export function resetTextEngine(): void {
  fonts.clear();
  faces.clear();
  shapeCache.clear();
  glyphPathCache.clear();
  loaded = false;
}

/** True once the WASM shaper is in memory, whether or not fonts loaded after it. */
export function shaperReady(): boolean {
  return hb !== null;
}
