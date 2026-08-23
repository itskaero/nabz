/**
 * Document layout. THE print target, designed rather than exported
 * (PRODUCT.md 10, DESIGN.md 10).
 *
 * Everything the spec asks for lives here and is checked by tests/print.test.ts:
 *   - fixed physical dimensions from config (A4 / Letter) with real margins;
 *   - three letterhead modes, including the pre-printed pad whose reserved zone
 *     the preview shows and the printer never touches;
 *   - a repeating per-page identity strip, so there is no anonymous page 2;
 *   - a signature block pinned to the bottom of the page, with the space
 *     reserved on EVERY page so a short script cannot float it mid-page and a
 *     long one cannot collide with it;
 *   - keep-together on each medication row, so a drug's English and Urdu can
 *     never land on different sheets of paper;
 *   - a row-locked bilingual grid whose row height is the taller language;
 *   - a minimum point size for the patient's Urdu;
 *   - no colour-only encoding anywhere.
 */
import type { Prescription, MedicationLine, AdviceItem } from '@domain/prescription.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import type { ContentPack } from '@domain/pack.ts';
import type { Locale } from '@domain/locale.ts';
import { directionOf } from '@domain/locale.ts';
import { composeSig, drugLabel } from '@domain/sig.ts';
import { composeAdvice, orderAdvice } from '@domain/advice.ts';
import { composeExamination } from '@domain/exam.ts';
import { composeLabs } from '@domain/labs.ts';
import type { TextRun } from '@domain/text.ts';
import type { AppDefaults } from '@config/appDefaults.ts';
import { PAPER } from '@config/appDefaults.ts';
import type { DoctorProfile } from '@config/doctorProfile.ts';
import { languageFor } from '@config/doctorProfile.ts';
import { packStringFrom } from '@data/phrases/index.ts';
import { glyphOrFallback, measure } from '@render/text/engine.ts';
import type { LaidOutLine } from '@render/text/line.ts';
import { layoutLine, layoutParagraph, paragraphHeight } from '@render/text/line.ts';
import * as C from '@render/theme.ts';
import type { DocumentModel, DrawOp, PageModel } from './model.ts';
import { mm } from './model.ts';

export interface RenderContext {
  rx: Prescription;
  profile: DoctorProfile;
  pack: ContentPack;
  packs: PackRegistry;
  defaults: AppDefaults;
}

const GAP = 4;
const SECTION_GAP = 9;

/** Type scale, in points. Kept together so the document has one voice. */
const T = {
  doctorName: 13,
  doctorMeta: 8.2,
  strip: 7.2,
  sectionHead: 8.6,
  body: 9.5,
  drugName: 10,
  drugMeta: 8.4,
  sigEn: 9.4,
  cite: 7.8,
  adviceEn: 8.8,
  signature: 8.6,
} as const;

/** plain LTR English text as a run list */
const en = (text: string, kind: TextRun['kind'] = 'prose'): TextRun[] =>
  text ? [{ text, dir: 'ltr', kind }] : [];

class DocBuilder {
  pages: PageModel[] = [];
  private page!: PageModel;
  y = 0;

  readonly widthPt: number;
  readonly heightPt: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;

  /** y at which the reserved signature zone starts on every page */
  readonly signatureTop: number;
  /**
   * Height of the identity strip. Taller when there is an allergy, because the
   * allergy is carried on to every page and must have room reserved for it --
   * otherwise the next block is drawn over the top of it and the warning is
   * invisible on page 2 onwards.
   */
  readonly stripHeight: number;
  /** where each page's strip goes; stamped once the page count is known */
  private stripY: Array<number | null> = [];

  constructor(private ctx: RenderContext) {
    const paper = PAPER[ctx.profile.paper] ?? PAPER[ctx.defaults.paper];
    const m = ctx.profile.margins;
    this.widthPt = mm(paper.widthMm);
    this.heightPt = mm(paper.heightMm);
    this.left = mm(m.leftMm);
    this.right = this.widthPt - mm(m.rightMm);
    // On a pre-printed pad the reserved zone applies to EVERY sheet, not just
    // the first -- the pad is the same paper all the way down. Pushing the
    // content top past it is what stops the repeating identity strip from
    // landing on top of the physical letterhead.
    this.top = Math.max(
      mm(m.topMm),
      ctx.profile.letterhead.mode === 'pad' ? mm(ctx.profile.letterhead.reservedTopMm) : 0,
    );
    this.bottom = this.heightPt - mm(m.bottomMm);
    this.signatureTop = this.bottom - SIGNATURE_HEIGHT;
    this.stripHeight = ctx.rx.patient.allergies?.trim() ? STRIP_HEIGHT + 11 : STRIP_HEIGHT;
    // Page 1 reserves its strip AFTER the letterhead, so the doctor's own
    // block leads the page rather than sitting under a patient line.
    this.newPage({ reserveStrip: false });
  }

  get contentWidth(): number {
    return this.right - this.left;
  }

  newPage(options: { reserveStrip?: boolean } = {}): void {
    this.page = { widthPt: this.widthPt, heightPt: this.heightPt, ops: [] };
    this.pages.push(this.page);
    this.stripY.push(null);
    this.y = this.top;
    if (options.reserveStrip !== false) this.reserveStrip();
  }

  /**
   * Claim the strip's space at the current cursor and step past it.
   * Page 1 gets the short strip: it carries the full allergy box a few lines
   * below, and printing the warning twice within an inch of itself trains the
   * reader to skim past it.
   */
  reserveStrip(): void {
    const index = this.pages.length - 1;
    this.stripY[index] = this.y;
    this.y += index === 0 ? STRIP_HEIGHT : this.stripHeight;
  }

  push(op: DrawOp): void {
    this.page.ops.push(op);
  }

  /** Space left before the reserved signature zone. */
  get remaining(): number {
    return this.signatureTop - this.y - 6;
  }

  /** Break if `height` will not fit. Used for keep-together blocks. */
  ensure(height: number): void {
    if (height > this.remaining) this.newPage();
  }

  text(
    line: LaidOutLine,
    x: number,
    color = C.ink,
    align: 'left' | 'right' = 'left',
  ): void {
    this.push({ op: 'text', x, y: this.y + line.ascentPt, line, color, align });
    this.y += line.heightPt;
  }

  /** Stamp the repeating identity strip now that the total page count is known. */
  finishStrips(): void {
    const { rx, profile } = this.ctx;
    const total = this.pages.length;
    this.pages.forEach((page, i) => {
      const y = this.stripY[i];
      if (y === null || y === undefined) return;
      const reg = profile.doctor.registration;
      const identity = [
        rx.patient.name || 'Unnamed patient',
        rx.patient.age ? `${rx.patient.age}` : '',
        rx.patient.sex ?? '',
        rx.date,
      ]
        .filter(Boolean)
        .join('  ·  ');
      const tail = [
        reg.number ? `${reg.authority} ${reg.number}` : '',
        `Page ${i + 1} of ${total}`,
      ]
        .filter(Boolean)
        .join('  ·  ');

      const leftLine = layoutLine(en(identity), 'ltr', { sizePt: T.strip });
      const rightLine = layoutLine(en(tail), 'ltr', { sizePt: T.strip });
      const baseline = y + leftLine.ascentPt;
      const strip: DrawOp[] = [
        { op: 'text', x: this.left, y: baseline, line: leftLine, color: C.inkSoft },
        { op: 'text', x: this.right, y: baseline, line: rightLine, color: C.inkSoft, align: 'right' },
      ];

      // An allergy is a safety fact that must not live only on page 1 -- but
      // page 1 already states it in full, so the strip carries it onward only.
      if (rx.patient.allergies?.trim() && i > 0) {
        const alrt = layoutLine(
          en(`ALLERGY: ${rx.patient.allergies.trim()}`, 'name'),
          'ltr',
          { sizePt: T.strip, strong: true },
        );
        strip.push({
          op: 'text',
          x: this.left,
          y: y + STRIP_HEIGHT - 4 + alrt.ascentPt,
          line: alrt,
          color: C.alert,
        });
      }

      const ruleY = y + (i === 0 ? STRIP_HEIGHT : this.stripHeight) - 3;
      strip.push({
        op: 'line',
        x1: this.left,
        y1: ruleY,
        x2: this.right,
        y2: ruleY,
        color: C.rule,
        width: 0.5,
      });
      page.ops.unshift(...strip);
    });
  }

  /** The signature zone: on the last page it is the block; before it, a marker. */
  finishSignature(): void {
    const { profile } = this.ctx;
    const last = this.pages.length - 1;
    this.pages.forEach((page, i) => {
      const top = this.signatureTop;
      if (i < last) {
        const cont = layoutLine(en('continued on the next page'), 'ltr', { sizePt: T.strip });
        page.ops.push({
          op: 'text',
          x: this.right,
          y: top + 12,
          line: cont,
          color: C.inkFaint,
          align: 'right',
        });
        return;
      }

      page.ops.push({
        op: 'line',
        x1: this.left,
        y1: top + 4,
        x2: this.right,
        y2: top + 4,
        color: C.rule,
        width: 0.5,
      });

      const notice = layoutLine(
        en(packStringFrom(this.ctx.packs, 'en', 'notice.notPrescription')),
        'ltr',
        { sizePt: T.strip },
      );
      page.ops.push({
        op: 'text',
        x: this.left,
        y: top + 4 + 8 + notice.ascentPt,
        line: notice,
        color: C.inkFaint,
      });

      // The signature LINE is drawn; a stored signature image is never stamped.
      // PRODUCT.md rule 3.6: the doctor signs on paper.
      const lineY = this.bottom - 16;
      const sigWidth = Math.min(190, this.contentWidth * 0.45);
      page.ops.push({
        op: 'line',
        x1: this.right - sigWidth,
        y1: lineY,
        x2: this.right,
        y2: lineY,
        color: C.ink,
        width: 0.7,
      });

      const label = layoutLine(en(packStringFrom(this.ctx.packs, 'en', 'label.signature')), 'ltr', {
        sizePt: T.signature,
      });
      page.ops.push({
        op: 'text',
        x: this.right,
        y: lineY + label.ascentPt + 3,
        line: label,
        color: C.inkSoft,
        align: 'right',
      });

      const who = [profile.doctor.name, profile.doctor.qualifications]
        .filter((s) => s?.trim())
        .join(', ');
      if (who) {
        const whoLine = layoutLine(en(who), 'ltr', { sizePt: T.signature, strong: true });
        page.ops.push({
          op: 'text',
          x: this.right - sigWidth,
          y: lineY - 4,
          line: whoLine,
          color: C.ink,
        });
      }

      // Stamp area: an explicit, labelled box, so the blank space at the foot of
      // the page is accounted for rather than forgeable.
      const stampW = 74;
      const stampH = 34;
      page.ops.push({
        op: 'rect',
        x: this.left,
        y: this.bottom - stampH,
        w: stampW,
        h: stampH,
        stroke: C.rule,
        lineWidth: 0.5,
        dash: [2, 2],
      });
      const stampLabel = layoutLine(en('Clinic stamp'), 'ltr', { sizePt: 6.6 });
      page.ops.push({
        op: 'text',
        x: this.left + 4,
        y: this.bottom - stampH + stampLabel.ascentPt + 4,
        line: stampLabel,
        color: C.inkFaint,
      });
    });
  }
}

const STRIP_HEIGHT = 16;
const SIGNATURE_HEIGHT = 62;

// --- letterhead ------------------------------------------------------------

function drawLetterhead(b: DocBuilder, ctx: RenderContext): void {
  const { profile } = ctx;
  const mode = profile.letterhead.mode;

  if (mode === 'pad') {
    // The app draws NOTHING here. The zone is reserved so the physical
    // letterhead is never overprinted; the dashed guide is preview-only, so the
    // printer puts no ink in it (PRODUCT.md 10).
    const reserved = mm(profile.letterhead.reservedTopMm);
    const zoneTop = 0;
    b.push({
      op: 'rect',
      x: b.left,
      y: zoneTop,
      w: b.contentWidth,
      h: reserved,
      stroke: C.inkFaint,
      lineWidth: 0.5,
      dash: [3, 3],
      previewOnly: true,
    });
    const note = layoutLine(
      en('reserved for your pre-printed letterhead — nothing is printed here'),
      'ltr',
      { sizePt: 7 },
    );
    b.push({
      op: 'text',
      x: b.left + 6,
      y: zoneTop + reserved / 2,
      line: note,
      color: C.inkFaint,
      previewOnly: true,
    });
    // No y advance: the content top already clears the zone (see DocBuilder).
    return;
  }

  const d = profile.doctor;
  let textLeft = b.left;
  if (mode === 'text+logo' && profile.letterhead.logoDataUrl) {
    const size = 46;
    b.push({
      op: 'image',
      x: b.left,
      y: b.y,
      w: size,
      h: size,
      dataUrl: profile.letterhead.logoDataUrl,
    });
    textLeft = b.left + size + 12;
  }

  const startY = b.y;
  let y = startY;
  const put = (text: string, sizePt: number, color: C.Rgb, strong = false) => {
    if (!text.trim()) return;
    const line = layoutLine(en(text), 'ltr', { sizePt, strong });
    b.push({ op: 'text', x: textLeft, y: y + line.ascentPt, line, color });
    y += line.heightPt;
  };

  put(d.name || 'Doctor name not set', T.doctorName, C.ink, true);
  put(d.qualifications, T.doctorMeta, C.inkSoft);
  const reg = d.registration.number
    ? `${d.registration.authority} ${d.registration.number}`
    : '';
  put([d.clinicName, reg].filter(Boolean).join('  ·  '), T.doctorMeta, C.inkSoft);
  put(
    [d.clinicAddress, d.phone, d.timings].filter((s) => s?.trim()).join('  ·  '),
    T.doctorMeta,
    C.inkFaint,
  );

  b.y = Math.max(y, startY + (mode === 'text+logo' ? 46 : 0)) + 6;
  b.push({
    op: 'line',
    x1: b.left,
    y1: b.y,
    x2: b.right,
    y2: b.y,
    color: C.ink,
    width: 1,
  });
  b.y += GAP + 2;
}

// --- shared pieces ---------------------------------------------------------

function sectionHeading(b: DocBuilder, label: string, tag?: string): void {
  b.ensure(30);
  const line = layoutLine(en(label.toUpperCase()), 'ltr', {
    sizePt: T.sectionHead,
    strong: true,
  });
  b.push({ op: 'text', x: b.left, y: b.y + line.ascentPt, line, color: C.ink });
  if (tag) {
    const tagLine = layoutLine(en(tag), 'ltr', { sizePt: 6.8 });
    b.push({
      op: 'text',
      x: b.right,
      y: b.y + line.ascentPt,
      line: tagLine,
      color: C.inkFaint,
      align: 'right',
    });
  }
  b.y += line.heightPt + 2;
  b.push({
    op: 'line',
    x1: b.left,
    y1: b.y,
    x2: b.right,
    y2: b.y,
    color: C.rule,
    width: 0.5,
  });
  b.y += 5;
}

function bulletList(b: DocBuilder, items: string[], strong = false): void {
  for (const item of items) {
    const text = item.trim();
    if (!text) continue;
    const lines = layoutParagraph(en(text), 'ltr', b.contentWidth - 12, {
      sizePt: T.body,
      strong,
    });
    b.ensure(paragraphHeight(lines));
    lines.forEach((line, i) => {
      if (i === 0) {
        const dot = layoutLine(en('•'), 'ltr', { sizePt: T.body });
        b.push({ op: 'text', x: b.left, y: b.y + line.ascentPt, line: dot, color: C.inkFaint });
      }
      b.push({ op: 'text', x: b.left + 12, y: b.y + line.ascentPt, line, color: C.ink });
      b.y += line.heightPt;
    });
  }
  b.y += 3;
}

// --- the hero: bilingual medication grid ------------------------------------

interface MedRowPlan {
  headerLines: LaidOutLine[];
  strength: LaidOutLine | null;
  enLines: LaidOutLine[];
  urLines: LaidOutLine[];
  citeLines: LaidOutLine[];
  height: number;
  index: number;
}

function planMedicationRow(
  b: DocBuilder,
  line: MedicationLine,
  index: number,
  ctx: RenderContext,
  locales: { primary: Locale; secondary?: Locale },
): MedRowPlan {
  const numberWidth = 16;
  const inner = b.contentWidth - numberWidth - 12;
  const gutter = 14;
  const colWidth = locales.secondary ? (inner - gutter) / 2 : inner;

  const header = drugLabel(line.drug) || 'Unnamed medicine';
  const headerLines = layoutParagraph(
    [{ text: header, dir: 'ltr', kind: 'name' }],
    'ltr',
    inner - 90,
    { sizePt: T.drugName, strong: true },
  );

  const meta = [line.drug.strength, line.drug.form].filter(Boolean).join('  ·  ');
  const strength = meta
    ? layoutLine([{ text: meta, dir: 'ltr', kind: 'value' }], 'ltr', { sizePt: T.drugMeta })
    : null;

  const primary = composeSig(line, locales.primary, ctx.packs);
  const enLines = layoutParagraph(primary.runs, directionOf(locales.primary), colWidth, {
    sizePt: T.sigEn,
  });

  let urLines: LaidOutLine[] = [];
  if (locales.secondary) {
    const second = composeSig(line, locales.secondary, ctx.packs);
    urLines = layoutParagraph(second.runs, directionOf(locales.secondary), colWidth, {
      sizePt: T.sigEn,
      // The patient's language gets the legibility floor, not the clinical size.
      urduSizePt: Math.max(ctx.defaults.urduMinPt, T.sigEn + 2),
    });
  }

  const citeLines = line.citedSuggestion
    ? layoutParagraph(
        en(`${line.citedSuggestion.text} — ${line.citedSuggestion.reference}. Suggestion; confirm before signing.`),
        'ltr',
        inner,
        { sizePt: T.cite },
      )
    : [];

  const headerHeight = paragraphHeight(headerLines);
  const bodyHeight = Math.max(paragraphHeight(enLines), paragraphHeight(urLines));
  const height =
    headerHeight + 3 + bodyHeight + (citeLines.length ? paragraphHeight(citeLines) + 3 : 0) + 12;

  return { headerLines, strength, enLines, urLines, citeLines, height, index };
}

function drawMedicationRow(b: DocBuilder, plan: MedRowPlan): void {
  const numberWidth = 16;
  const inner = b.contentWidth - numberWidth - 12;
  const gutter = 14;
  const colWidth = plan.urLines.length ? (inner - gutter) / 2 : inner;
  const x0 = b.left + numberWidth;
  const top = b.y;

  const num = layoutLine(en(`${plan.index}`, 'value'), 'ltr', { sizePt: T.drugName, strong: true });
  b.push({ op: 'text', x: b.left, y: b.y + num.ascentPt, line: num, color: C.inkSoft });

  let y = b.y;
  plan.headerLines.forEach((line) => {
    b.push({ op: 'text', x: x0, y: y + line.ascentPt, line, color: C.ink });
    y += line.heightPt;
  });
  if (plan.strength) {
    b.push({
      op: 'text',
      x: b.right,
      y: b.y + plan.strength.ascentPt,
      line: plan.strength,
      color: C.ink,
      align: 'right',
    });
  }
  y += 3;

  // ROW-LOCKED GRID: both tracks start at the same y and the row is as tall as
  // the taller language, so English and Urdu for one drug cannot drift apart.
  const bodyTop = y;
  let enY = bodyTop;
  plan.enLines.forEach((line) => {
    b.push({ op: 'text', x: x0, y: enY + line.ascentPt, line, color: C.ink });
    enY += line.heightPt;
  });

  if (plan.urLines.length) {
    const urRight = b.right;
    let urY = bodyTop;
    plan.urLines.forEach((line) => {
      b.push({ op: 'text', x: urRight, y: urY + line.ascentPt, line, color: C.ink, align: 'right' });
      urY += line.heightPt;
    });
    // Divider between the two tracks: structure, not colour.
    const divX = x0 + colWidth + gutter / 2;
    b.push({
      op: 'line',
      x1: divX,
      y1: bodyTop - 1,
      x2: divX,
      y2: Math.max(enY, urY) + 1,
      color: C.rule,
      width: 0.5,
    });
    y = Math.max(enY, urY);
  } else {
    y = enY;
  }

  if (plan.citeLines.length) {
    y += 3;
    plan.citeLines.forEach((line) => {
      b.push({ op: 'text', x: x0, y: y + line.ascentPt, line, color: C.inkSoft });
      y += line.heightPt;
    });
  }

  y += 7;
  b.push({ op: 'line', x1: b.left, y1: y, x2: b.right, y2: y, color: C.rule, width: 0.5 });
  b.y = y + 5;
  void top;
}

// --- advice ----------------------------------------------------------------

function drawAdvice(b: DocBuilder, items: AdviceItem[], ctx: RenderContext): void {
  const lang = languageFor(ctx.profile, 'advice');
  const patientLocale = lang.primary;
  const clinicalLocale = lang.secondary;
  const urduSize = Math.max(ctx.defaults.urduMinPt + 1, 12.5);

  const ordered = orderAdvice(items);
  // DESIGN.md 8: colour must never be the only channel. Each state carries a
  // MARK as well as a border, and the legend below names what each mark means,
  // so the distinction survives a mono laser and a colourblind reader. The
  // marks are checked against the face first: a tick that renders as .notdef
  // next to a red flag is worse than no tick.
  const tick = glyphOrFallback('latin', ['✓'], '+');
  const bang = '!';
  const pencil = glyphOrFallback('latin', ['✎', '✐', '†'], '*');

  const legend = layoutLine(
    en(
      `${tick} approved wording   ${bang} come back immediately   ${pencil} doctor's own words, printed as typed`,
    ),
    'ltr',
    { sizePt: 7 },
  );
  b.push({ op: 'text', x: b.left, y: b.y + legend.ascentPt, line: legend, color: C.inkSoft });
  b.y += legend.heightPt + 4;

  for (const item of ordered) {
    const primary = composeAdvice(item, patientLocale, ctx.packs);
    const secondary = clinicalLocale ? composeAdvice(item, clinicalLocale, ctx.packs) : null;
    if (!primary && !secondary) continue;

    const redFlag = item.kind === 2;
    const own = item.kind === 3;
    const accent = redFlag ? C.alert : own ? C.unvetted : C.teal;
    const wash = redFlag ? C.alertWash : own ? C.warnWash : C.patientTint;
    const marker = redFlag ? bang : own ? pencil : tick;
    // Only the two exceptional states repeat their meaning in words on the
    // item itself. A vetted line carries the tick and the border and is
    // explained once, in the legend -- labelling every routine line "approved"
    // would bury the two that are not.
    const label = redFlag ? '' : own ? packStringFrom(ctx.packs, 'en', 'notice.notVetted') : '';

    const padX = 8;
    const innerWidth = b.contentWidth - padX * 2 - 6;

    const primaryLines = primary
      ? layoutParagraph(primary.runs, primary.dir, innerWidth, {
          sizePt: T.adviceEn,
          urduSizePt: urduSize,
          strong: redFlag,
        })
      : [];
    const secondaryLines = secondary
      ? layoutParagraph(secondary.runs, secondary.dir, innerWidth, { sizePt: T.adviceEn })
      : [];
    const labelLines = label
      ? layoutParagraph(en(label), 'ltr', innerWidth - 12, { sizePt: 7 })
      : [];
    const markLine = layoutLine(en(marker), 'ltr', { sizePt: 9, strong: true });

    const height =
      paragraphHeight(primaryLines) +
      paragraphHeight(secondaryLines) +
      Math.max(paragraphHeight(labelLines), markLine.heightPt) +
      12;

    b.ensure(height);
    const top = b.y;

    b.push({
      op: 'rect',
      x: b.left,
      y: top,
      w: b.contentWidth,
      h: height - 4,
      fill: wash,
      ...(redFlag || own ? { stroke: accent } : {}),
      lineWidth: redFlag ? 1 : 0.5,
    });
    // Left border: the non-colour channel, present on every advice item.
    b.push({
      op: 'rect',
      x: b.left,
      y: top,
      w: redFlag ? 3 : 2,
      h: height - 4,
      fill: accent,
    });

    let y = top + 5;
    b.push({
      op: 'text',
      x: b.left + padX,
      y: y + markLine.ascentPt,
      line: markLine,
      color: accent,
    });
    labelLines.forEach((line) => {
      b.push({ op: 'text', x: b.left + padX + 12, y: y + line.ascentPt, line, color: accent });
      y += line.heightPt;
    });
    if (labelLines.length === 0) y += markLine.heightPt;
    primaryLines.forEach((line) => {
      const rtl = primary!.dir === 'rtl';
      b.push({
        op: 'text',
        x: rtl ? b.right - padX : b.left + padX,
        y: y + line.ascentPt,
        line,
        color: C.ink,
        align: rtl ? 'right' : 'left',
      });
      y += line.heightPt;
    });
    secondaryLines.forEach((line) => {
      const rtl = secondary!.dir === 'rtl';
      b.push({
        op: 'text',
        x: rtl ? b.right - padX : b.left + padX,
        y: y + line.ascentPt,
        line,
        color: C.inkSoft,
        align: rtl ? 'right' : 'left',
      });
      y += line.heightPt;
    });

    b.y = top + height;
  }
}

// --- the document ----------------------------------------------------------

export function buildDocument(ctx: RenderContext): DocumentModel {
  const { rx, profile, pack } = ctx;
  const b = new DocBuilder(ctx);

  drawLetterhead(b, ctx);
  // Page 1's strip sits BELOW the letterhead: the doctor's own block leads the
  // page, and the patient line follows it. Pages 2+ reserve theirs at the top,
  // in newPage().
  b.reserveStrip();

  // Patient identity block. Repeated in the strip on every page, spelled out here.
  const idParts = [
    ['label.patient', rx.patient.name],
    ['label.age', rx.patient.age ?? ''],
    ['label.sex', rx.patient.sex ?? ''],
    ['label.weight', rx.patient.weightKg ? `${rx.patient.weightKg} kg` : ''],
    ['label.date', rx.date],
  ] as const;
  const idText = idParts
    .filter(([, v]) => String(v).trim())
    .map(([k, v]) => `${packStringFrom(ctx.packs, 'en', k)}: ${v}`)
    .join('    ');
  if (idText) {
    const line = layoutLine(en(idText), 'ltr', { sizePt: T.body });
    b.push({ op: 'text', x: b.left, y: b.y + line.ascentPt, line, color: C.ink });
    b.y += line.heightPt + GAP;
  }

  if (rx.patient.allergies?.trim()) {
    const text = `${packStringFrom(ctx.packs, 'en', 'label.allergies')}: ${rx.patient.allergies.trim()}`;
    const lines = layoutParagraph(en(text), 'ltr', b.contentWidth - 16, {
      sizePt: T.body,
      strong: true,
    });
    const height = paragraphHeight(lines) + 10;
    b.ensure(height);
    b.push({
      op: 'rect',
      x: b.left,
      y: b.y,
      w: b.contentWidth,
      h: height,
      fill: C.alertWash,
      stroke: C.alert,
      lineWidth: 1.2,
    });
    let y = b.y + 5;
    lines.forEach((line) => {
      b.push({ op: 'text', x: b.left + 8, y: y + line.ascentPt, line, color: C.alert });
      y += line.heightPt;
    });
    b.y += height + GAP;
  }

  if (rx.problems.length) {
    sectionHeading(b, packStringFrom(ctx.packs, 'en', 'section.problems'), 'EN');
    bulletList(b, rx.problems);
    b.y += SECTION_GAP - 6;
  }

  const examLines = composeExamination(
    rx.examination,
    (id) => pack.examSystems.find((s) => s.id === id)?.label ?? id,
  );
  if (examLines.length) {
    sectionHeading(b, packStringFrom(ctx.packs, 'en', 'section.examination'), 'EN');
    for (const text of examLines) {
      const lines = layoutParagraph(en(text), 'ltr', b.contentWidth, { sizePt: T.body });
      b.ensure(paragraphHeight(lines));
      lines.forEach((line) => {
        b.push({ op: 'text', x: b.left, y: b.y + line.ascentPt, line, color: C.ink });
        b.y += line.heightPt;
      });
    }
    b.y += SECTION_GAP - 4;
  }

  if (rx.diagnosis.length) {
    sectionHeading(b, packStringFrom(ctx.packs, 'en', 'section.diagnosis'), 'EN');
    bulletList(b, rx.diagnosis, true);
    b.y += SECTION_GAP - 6;
  }

  /**
   * Investigations. English only, so this is the cheap section: no bidi, no
   * plural rules, no locale template. Placement follows the doctor's setting --
   * some print "Advised" under the diagnosis, others below the Rx.
   */
  const placement = profile.labsPlacement ?? ctx.defaults.labsPlacement;
  const drawLabs = () => {
    if (!rx.labs.length) return;
    sectionHeading(b, packStringFrom(ctx.packs, 'en', 'section.labs'), 'EN');
    bulletList(b, composeLabs(rx.labs), true);
    b.y += SECTION_GAP - 6;
  };

  if (placement === 'after-diagnosis') drawLabs();

  if (rx.medications.length) {
    const lang = languageFor(profile, 'medications');
    const tag = lang.secondary
      ? `${lang.primary.toUpperCase()} · ${lang.secondary === 'ur-PK' ? 'UR' : lang.secondary.toUpperCase()}`
      : lang.primary.toUpperCase();
    sectionHeading(b, packStringFrom(ctx.packs, 'en', 'section.medications'), tag);
    rx.medications.forEach((line, i) => {
      const plan = planMedicationRow(b, line, i + 1, ctx, lang);
      // KEEP-TOGETHER: the whole row, both languages, moves to the next page
      // rather than splitting. A drug on one sheet and its Urdu on another is a
      // dosing hazard, not a typographic blemish.
      b.ensure(plan.height);
      drawMedicationRow(b, plan);
    });
    b.y += SECTION_GAP - 6;
  }

  if (placement === 'after-medications') drawLabs();

  if (rx.advice.length) {
    const lang = languageFor(profile, 'advice');
    const tag = lang.secondary
      ? `${lang.primary === 'ur-PK' ? 'UR' : lang.primary.toUpperCase()} · ${lang.secondary.toUpperCase()}`
      : lang.primary.toUpperCase();
    sectionHeading(b, packStringFrom(ctx.packs, 'en', 'section.patientInstructions'), tag);
    drawAdvice(b, rx.advice, ctx);
  }

  if (rx.followUp) {
    const q = rx.followUp.in;
    const text = `${packStringFrom(ctx.packs, 'en', 'label.followUp')}: ${q.value} ${q.unit}${q.value === 1 ? '' : 's'}`;
    const line = layoutLine(en(text), 'ltr', { sizePt: T.body, strong: true });
    b.ensure(line.heightPt + 6);
    b.y += 4;
    b.push({ op: 'text', x: b.left, y: b.y + line.ascentPt, line, color: C.ink });
    b.y += line.heightPt;
  }

  b.finishStrips();
  b.finishSignature();

  return {
    pages: b.pages,
    paper: profile.paper,
    meta: { patientName: rx.patient.name, date: rx.date },
  };
}

/** Reported by the preview so a doctor can see the Urdu floor is being met. */
export function urduSizeInUse(defaults: AppDefaults): number {
  return Math.max(defaults.urduMinPt, T.sigEn + 2);
}

export { measure };
