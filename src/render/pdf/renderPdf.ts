/**
 * PDF backend: DocumentModel -> real PDF bytes at exact physical dimensions.
 *
 * This is the artifact the doctor prints (PRODUCT.md 5, CLAUDE.md 5). It is NOT
 * `window.print()` of the live DOM, because a browser's scale-to-fit silently
 * rewrites the margins and shrinks the Urdu below the legibility floor -- and
 * the whole product is a document a parent has to be able to read.
 *
 * The page geometry comes from the layout engine in points; this file only
 * flips to PDF's bottom-left origin and puts paths on the page. Preview-only
 * ops (the pre-printed-pad guide) are dropped here, so the printer never sees a
 * mark the app drew to explain itself.
 *
 * pdf-lib is imported ON DEMAND. The preview is drawn by the SVG backend from
 * the same page model, so the PDF library is only needed at the moment the
 * doctor actually asks for a file -- and a clinic on a slow connection should
 * not download it to open the app.
 */
import type { PDFPage } from 'pdf-lib';
import type { DocumentModel, DrawOp, PageModel } from './model.ts';
import { printableOps } from './model.ts';
import type { Rgb } from '@render/theme.ts';

type PdfLib = typeof import('pdf-lib');

let pdfLib: PdfLib | null = null;

async function lib(): Promise<PdfLib> {
  pdfLib ??= await import('pdf-lib');
  return pdfLib;
}

/** Layout y is measured down from the top; PDF y is measured up from the bottom. */
const flip = (page: PageModel, y: number) => page.heightPt - y;

function drawTextOp(
  pdf: PdfLib,
  pdfPage: PDFPage,
  page: PageModel,
  op: Extract<DrawOp, { op: 'text' }>,
): void {
  const originX = op.align === 'right' ? op.x - op.line.widthPt : op.x;
  const baseline = flip(page, op.y);
  const color = pdf.rgb(op.color.r, op.color.g, op.color.b);

  for (const segment of op.line.segments) {
    const scale = segment.sizePt / segment.shaped.unitsPerEm;
    const segmentX = originX + segment.x;
    for (const glyph of segment.shaped.glyphs) {
      if (!glyph.path) continue;
      // Glyph paths are y-down (see text/engine.ts); pdf-lib's drawSvgPath
      // applies its own y flip, so the pair lands the right way up.
      pdfPage.drawSvgPath(glyph.path, {
        x: segmentX + glyph.x * scale,
        y: baseline - glyph.y * scale,
        scale,
        color,
        borderWidth: 0,
      });
    }
  }
}

function drawOp(pdf: PdfLib, pdfPage: PDFPage, page: PageModel, op: DrawOp): void {
  const c = (v: Rgb) => pdf.rgb(v.r, v.g, v.b);
  switch (op.op) {
    case 'text':
      drawTextOp(pdf, pdfPage, page, op);
      return;
    case 'rect':
      pdfPage.drawRectangle({
        x: op.x,
        y: flip(page, op.y + op.h),
        width: op.w,
        height: op.h,
        ...(op.fill ? { color: c(op.fill) } : {}),
        ...(op.stroke ? { borderColor: c(op.stroke), borderWidth: op.lineWidth ?? 0.5 } : {}),
        ...(op.dash ? { borderDashArray: op.dash } : {}),
      });
      return;
    case 'line':
      pdfPage.drawLine({
        start: { x: op.x1, y: flip(page, op.y1) },
        end: { x: op.x2, y: flip(page, op.y2) },
        thickness: op.width,
        color: c(op.color),
        ...(op.dash ? { dashArray: op.dash } : {}),
      });
      return;
    case 'image':
      // handled separately: embedding is async
      return;
  }
}

async function drawImages(
  doc: Awaited<ReturnType<PdfLib['PDFDocument']['create']>>,
  pdfPage: PDFPage,
  page: PageModel,
  ops: DrawOp[],
): Promise<void> {
  for (const op of ops) {
    if (op.op !== 'image') continue;
    try {
      const commaAt = op.dataUrl.indexOf(',');
      if (commaAt < 0) continue;
      const isPng = op.dataUrl.slice(0, commaAt).includes('image/png');
      const bytes = Uint8Array.from(atob(op.dataUrl.slice(commaAt + 1)), (ch) => ch.charCodeAt(0));
      const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      pdfPage.drawImage(image, {
        x: op.x,
        y: flip(page, op.y + op.h),
        width: op.w,
        height: op.h,
      });
    } catch {
      // A broken logo must never stop a prescription from printing.
    }
  }
}

export async function renderPdf(model: DocumentModel): Promise<Uint8Array> {
  const pdf = await lib();
  const doc = await pdf.PDFDocument.create();
  doc.setTitle(`Prescription — ${model.meta.patientName || 'patient'} — ${model.meta.date}`);
  doc.setProducer('Nabz');
  doc.setCreator('Nabz');

  for (const page of model.pages) {
    const pdfPage = doc.addPage([page.widthPt, page.heightPt]);
    const ops = printableOps(page);
    pdfPage.pushOperators(pdf.pushGraphicsState());
    for (const op of ops) drawOp(pdf, pdfPage, page, op);
    pdfPage.pushOperators(pdf.popGraphicsState());
    await drawImages(doc, pdfPage, page, ops);
  }

  return doc.save();
}

export async function renderPdfBlob(model: DocumentModel): Promise<Blob> {
  const bytes = await renderPdf(model);
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

export function prescriptionFilename(model: DocumentModel): string {
  const who = (model.meta.patientName || 'patient').trim().replace(/\s+/g, '-');
  return `rx-${who}-${model.meta.date}.pdf`;
}

/**
 * Hand the script to the patient.
 *
 * BOTH competitors lead with WhatsApp, and in Pakistan WhatsApp is how
 * documents actually move. We do NOT integrate WhatsApp: the PDF goes to the
 * operating system's own share sheet, which offers WhatsApp among everything
 * else the phone can do with a file.
 *
 * That distinction is the entire reason this is compatible with PRODUCT.md
 * rule 3.1. No server, no API key, no account, no third party holding a
 * prescription. The doctor is handing the patient their own document, exactly
 * as they would a sheet of paper -- the file never leaves the device except
 * into the hands of the person it is about.
 *
 * Falls back to a download when the platform cannot share files, which is most
 * desktop browsers.
 */
export async function sharePrescription(
  model: DocumentModel,
  blob: Blob,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const filename = prescriptionFilename(model);
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: `Prescription — ${model.meta.patientName || 'patient'}`,
      });
      return 'shared';
    } catch (err) {
      // A user who backs out of the share sheet has not hit an error, and must
      // not be shown one.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Anything else: fall through to a download rather than stranding them.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
