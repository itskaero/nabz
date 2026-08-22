/**
 * The page model: a backend-neutral description of the printed document.
 *
 * The layout engine produces this; the PDF backend and the on-screen preview
 * both consume it. That is the whole mechanism behind "preview == print"
 * (PRODUCT.md 5): there is exactly one layout, and the two renderers differ
 * only in how they put a path on a surface.
 *
 * Coordinates are POINTS with the origin at the TOP-LEFT of the page, because
 * that is how documents are laid out. The PDF backend flips to PDF's
 * bottom-left origin once, at the edge.
 */
import type { LaidOutLine } from '@render/text/line.ts';
import type { Rgb } from '@render/theme.ts';

export const MM_TO_PT = 72 / 25.4;

export function mm(value: number): number {
  return value * MM_TO_PT;
}

export interface TextOp {
  op: 'text';
  /** left edge for align 'left', right edge for align 'right' */
  x: number;
  /** BASELINE y, measured from the top of the page */
  y: number;
  line: LaidOutLine;
  color: Rgb;
  align?: 'left' | 'right';
  /**
   * True for the preview only. The pre-printed-pad guide is the case this
   * exists for: the doctor must SEE the zone the app is keeping clear, and the
   * printer must never put ink in it (PRODUCT.md 10).
   */
  previewOnly?: boolean;
}

export interface RectOp {
  op: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: Rgb;
  stroke?: Rgb;
  lineWidth?: number;
  radius?: number;
  dash?: number[];
  previewOnly?: boolean;
}

export interface LineOp {
  op: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: Rgb;
  width: number;
  dash?: number[];
  previewOnly?: boolean;
}

export interface ImageOp {
  op: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  dataUrl: string;
  previewOnly?: boolean;
}

export type DrawOp = TextOp | RectOp | LineOp | ImageOp;

export interface PageModel {
  widthPt: number;
  heightPt: number;
  ops: DrawOp[];
}

export interface DocumentModel {
  pages: PageModel[];
  paper: string;
  /** for the preview's own chrome; never printed */
  meta: { patientName: string; date: string };
}

/** Ops the printer is allowed to see. */
export function printableOps(page: PageModel): DrawOp[] {
  return page.ops.filter((o) => !o.previewOnly);
}
