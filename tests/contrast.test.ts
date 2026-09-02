/**
 * WCAG contrast for the design-system tokens (DESIGN.md 14a), in BOTH
 * themes. This is the test that turns "must independently clear 4.5:1" from
 * a one-time manual check into a regression gate -- the critique that
 * started this work found --ink-faint failing at ~3:1 on field labels and
 * tab tags in the light palette; this suite exists so the dark palette
 * cannot ship the same mistake unnoticed, and so neither palette can drift
 * back into it later.
 *
 * The hex values below are duplicated from src/render/screen/styles.css's
 * :root / :root[data-theme='dark'] blocks on purpose (see render/theme.ts's
 * own header comment for the same reasoning): nothing at runtime needs to
 * COMPUTE a contrast ratio, so keeping the check here avoids adding runtime
 * surface for a build-time concern. If a token's hex changes in styles.css,
 * update it here too -- a mismatch only means this suite is checking last
 * commit's palette, not this one.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(hex: string): number {
  const linear = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

/** WCAG 2.x contrast ratio, 1:1 to 21:1. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const AA_UI = 3.0; // non-text UI components / borders (WCAG 1.4.11), and large text

const light = {
  bg: '#eef1f2',
  surface: '#ffffff',
  ink: '#14201f',
  inkSoft: '#55635f',
  teal: '#0f8055',
  tealInk: '#0b6b3f',
  tealWash: '#e3f2ea',
  onTeal: '#ffffff',
  alert: '#b4232a',
  alertWash: '#fbeceb',
  unvettedInk: '#6d4a1b',
  warnWash: '#f6eddf',
};

const dark = {
  bg: '#0d1614',
  surface: '#16241f',
  ink: '#eef3f1',
  inkSoft: '#a9bdb6',
  teal: '#0f8055',
  tealInk: '#8fe3c0',
  tealWash: '#123128',
  onTeal: '#ffffff',
  alert: '#ff7a72',
  alertWash: '#3a1613',
  unvettedInk: '#ffdca3',
  warnWash: '#332411',
};

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, p) => {
  it('body ink on bg and on surface', () => {
    expect(contrastRatio(p.ink, p.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.ink, p.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('--ink-soft on bg and on surface (field labels, tab language tags -- critique P1)', () => {
    expect(contrastRatio(p.inkSoft, p.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.inkSoft, p.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('--on-teal (button/chip/tab text) on a solid --teal fill', () => {
    expect(contrastRatio(p.onTeal, p.teal)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('--teal as a border/UI component against surface and bg', () => {
    expect(contrastRatio(p.teal, p.surface)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrastRatio(p.teal, p.bg)).toBeGreaterThanOrEqual(AA_UI);
  });

  it('--teal-ink (teal used AS text) on --teal-wash', () => {
    expect(contrastRatio(p.tealInk, p.tealWash)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('--alert on --alert-wash (allergy banner text)', () => {
    expect(contrastRatio(p.alert, p.alertWash)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('--unvetted-ink on --warn-wash (warn-box / pill.warn text)', () => {
    expect(contrastRatio(p.unvettedInk, p.warnWash)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

/**
 * A 2nd-pass critique found --ink-faint still wired to real informational
 * text on THREE classes (.hint, .ref-note, .empty) that the first pass's
 * sweep missed -- .hint alone covers most of Settings' explanatory copy,
 * .ref-note is the dosing-citation caption CLAUDE.md 8a requires. The token
 * pair test above proves --ink-faint fails AA in light mode; this test
 * proves those three selectors don't reach for it, by reading the actual
 * stylesheet rather than trusting a comment not to drift back. A real
 * (test-only) source-of-truth check, not a duplicated hex -- unlike the
 * palette table above, there's nothing to keep hand-synced here.
 */
describe('selectors that must not regress onto --ink-faint', () => {
  const css = readFileSync(
    resolve(import.meta.dirname, '../src/render/screen/styles.css'),
    'utf-8',
  );

  function ruleBody(selector: string): string {
    // Matches "SELECTOR {" (allowing the multi-selector form the sheet uses
    // elsewhere) up to its closing brace. Good enough for this flat sheet --
    // it has no nested rules -- without pulling in a real CSS parser.
    const escaped = selector.replace(/[.[\]]/g, '\\$&');
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'm'));
    if (!match) throw new Error(`selector not found in styles.css: ${selector}`);
    return match[1]!;
  }

  it.each(['.hint', '.ref-note', '.empty'])('%s does not use var(--ink-faint)', (selector) => {
    expect(ruleBody(selector)).not.toContain('var(--ink-faint)');
  });
});
