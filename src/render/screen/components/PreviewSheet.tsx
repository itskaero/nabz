/**
 * The on-screen preview: the SECOND backend for the same page model.
 *
 * It draws the identical glyph outlines, at the identical coordinates, that the
 * PDF backend writes into the file. That is what makes "preview == print" a
 * structural property rather than a promise (PRODUCT.md 5). The only difference
 * between the two is that this one also draws the preview-only marks -- notably
 * the reserved zone in pre-printed-pad mode, which the doctor must SEE and the
 * printer must never touch.
 */
import { useMemo } from 'react';
import type { DocumentModel, DrawOp, PageModel, TextOp } from '@render/pdf/model.ts';
import type { Rgb } from '@render/theme.ts';

const css = (c: Rgb) =>
  `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;

function Text({ op }: { op: TextOp }) {
  const originX = op.align === 'right' ? op.x - op.line.widthPt : op.x;
  return (
    <g
      fill={css(op.color)}
      opacity={op.previewOnly ? 0.55 : 1}
      // The logical text goes on the group so the preview is readable to a
      // screen reader and to anyone inspecting the DOM; the glyphs themselves
      // are outlines and carry no text.
      aria-label={op.line.text}
      role="text"
    >
      {op.line.segments.map((segment, i) => {
        const scale = segment.sizePt / segment.shaped.unitsPerEm;
        return (
          <g
            key={i}
            transform={`translate(${originX + segment.x} ${op.y}) scale(${scale})`}
          >
            {segment.shaped.glyphs.map((glyph, j) => (
              <path key={j} d={glyph.path} transform={`translate(${glyph.x} ${glyph.y})`} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Op({ op }: { op: DrawOp }) {
  const ghost = op.previewOnly ? 0.6 : 1;
  switch (op.op) {
    case 'text':
      return <Text op={op} />;
    case 'rect':
      return (
        <rect
          x={op.x}
          y={op.y}
          width={op.w}
          height={op.h}
          rx={op.radius ?? 0}
          fill={op.fill ? css(op.fill) : 'none'}
          stroke={op.stroke ? css(op.stroke) : 'none'}
          strokeWidth={op.lineWidth ?? 0.5}
          strokeDasharray={op.dash?.join(' ')}
          opacity={ghost}
        />
      );
    case 'line':
      return (
        <line
          x1={op.x1}
          y1={op.y1}
          x2={op.x2}
          y2={op.y2}
          stroke={css(op.color)}
          strokeWidth={op.width}
          strokeDasharray={op.dash?.join(' ')}
          opacity={ghost}
        />
      );
    case 'image':
      return <image href={op.dataUrl} x={op.x} y={op.y} width={op.w} height={op.h} />;
  }
}

function Page({ page, index, total }: { page: PageModel; index: number; total: number }) {
  return (
    <svg
      className="sheet-page"
      viewBox={`0 0 ${page.widthPt} ${page.heightPt}`}
      width={page.widthPt}
      height={page.heightPt}
      role="img"
      aria-label={`Page ${index + 1} of ${total}`}
      style={{ width: '100%', maxWidth: page.widthPt }}
    >
      <rect x={0} y={0} width={page.widthPt} height={page.heightPt} fill="#ffffff" />
      {page.ops.map((op, i) => (
        <Op key={i} op={op} />
      ))}
    </svg>
  );
}

export function PreviewSheet({ model }: { model: DocumentModel }) {
  const pages = useMemo(() => model.pages, [model]);
  return (
    <div className="preview-wrap">
      <div className="preview-meta">
        <span>
          {model.paper} · {pages.length} page{pages.length === 1 ? '' : 's'}
        </span>
        <span>
          This is exactly what will print — the PDF is drawn from the same layout.
        </span>
      </div>
      {pages.map((page, i) => (
        <Page key={i} page={page} index={i} total={pages.length} />
      ))}
    </div>
  );
}
