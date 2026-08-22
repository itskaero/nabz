/**
 * Serialise a page model to an SVG string.
 *
 * The React preview draws the same model as JSX; this is the same drawing as a
 * standalone document, which is what makes an automated visual check possible
 * (tests/visual.test.ts rasterises it) and what a future "share a picture of the
 * script" feature would use.
 *
 * Keep this and components/PreviewSheet.tsx in step: they are two encodings of
 * one drawing, and the moment they disagree, "preview == print" is a claim
 * rather than a fact.
 */
import type { DrawOp, PageModel, TextOp } from './model.ts';
import type { Rgb } from '@render/theme.ts';

const css = (c: Rgb) =>
  `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function textOp(op: TextOp): string {
  const originX = op.align === 'right' ? op.x - op.line.widthPt : op.x;
  const parts: string[] = [];
  for (const segment of op.line.segments) {
    const scale = segment.sizePt / segment.shaped.unitsPerEm;
    const glyphs = segment.shaped.glyphs
      .filter((g) => g.path)
      .map((g) => `<path d="${g.path}" transform="translate(${g.x} ${g.y})"/>`)
      .join('');
    if (!glyphs) continue;
    parts.push(
      `<g transform="translate(${round(originX + segment.x)} ${round(op.y)}) scale(${round(scale, 5)})">${glyphs}</g>`,
    );
  }
  if (parts.length === 0) return '';
  return `<g fill="${css(op.color)}" aria-label="${esc(op.line.text)}">${parts.join('')}</g>`;
}

const round = (n: number, dp = 2) => Number(n.toFixed(dp));

function opToSvg(op: DrawOp): string {
  switch (op.op) {
    case 'text':
      return textOp(op);
    case 'rect':
      return (
        `<rect x="${round(op.x)}" y="${round(op.y)}" width="${round(op.w)}" height="${round(op.h)}"` +
        (op.radius ? ` rx="${op.radius}"` : '') +
        ` fill="${op.fill ? css(op.fill) : 'none'}"` +
        ` stroke="${op.stroke ? css(op.stroke) : 'none'}"` +
        ` stroke-width="${op.lineWidth ?? 0.5}"` +
        (op.dash ? ` stroke-dasharray="${op.dash.join(' ')}"` : '') +
        '/>'
      );
    case 'line':
      return (
        `<line x1="${round(op.x1)}" y1="${round(op.y1)}" x2="${round(op.x2)}" y2="${round(op.y2)}"` +
        ` stroke="${css(op.color)}" stroke-width="${op.width}"` +
        (op.dash ? ` stroke-dasharray="${op.dash.join(' ')}"` : '') +
        '/>'
      );
    case 'image':
      return `<image href="${esc(op.dataUrl)}" x="${round(op.x)}" y="${round(op.y)}" width="${round(op.w)}" height="${round(op.h)}"/>`;
  }
}

export function pageToSvg(
  page: PageModel,
  options: { includePreviewOnly?: boolean } = {},
): string {
  const ops = options.includePreviewOnly ? page.ops : page.ops.filter((o) => !o.previewOnly);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.widthPt}" height="${page.heightPt}" ` +
    `viewBox="0 0 ${page.widthPt} ${page.heightPt}">` +
    `<rect width="${page.widthPt}" height="${page.heightPt}" fill="#ffffff"/>` +
    ops.map(opToSvg).join('') +
    '</svg>'
  );
}
