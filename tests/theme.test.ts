/**
 * The palette, as a test.
 *
 * Two properties, both of which used to be true only by luck:
 *
 * 1. `screen/tokens.css` is exactly what `theme.ts` generates. The stylesheet
 *    used to write the same hexes out by hand next to the ones the PDF reads,
 *    so the preview and the print could drift apart without anything failing.
 *
 * 2. Every pair of colours the UI actually puts together clears its WCAG
 *    floor, in every mode. This is the half that catches a REGRESSION: a
 *    colour is easy to nudge and impossible to eyeball at 4.5:1, and the
 *    smallest type in this app is a 9.5px uppercase field label read
 *    one-handed at OPD speed.
 *
 * The floors are WCAG 2.2: 4.5:1 for body text (1.4.3), 3:1 for a boundary or
 * a focus ring that carries meaning on its own (1.4.11).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ThemeMode, ThemeTokens } from '@render/theme.ts';
import { THEMES, tokensCss, resolveMode, DENSITIES } from '@render/theme.ts';

const MODES = Object.keys(THEMES) as ThemeMode[];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

type Key = keyof ThemeTokens;
type Pair = [fg: Key, bg: Key, where: string];

/**
 * Every pair below is somewhere real in the stylesheet. A pair that is not in
 * the UI does not belong here: a test that guards imaginary combinations is a
 * test that blocks a palette change for no reason.
 */
const TEXT_PAIRS: Pair[] = [
  ['ink', 'bg', 'body text on the page'],
  ['ink', 'surface', 'body text in a card'],
  ['ink', 'surfaceRaised', 'body text in a modal'],
  ['inkSoft', 'bg', '.hint on the page'],
  ['inkSoft', 'surface', '.med-head .generic, .row-item .meta'],
  ['inkSoft', 'surfaceRaised', 'modal sub-copy'],
  ['inkFaint', 'bg', '.empty, .tabs area'],
  ['inkFaint', 'surface', '.field label, .track-label, .stat .k'],
  ['inkFaint', 'patientTint', '.track.ur .track-label'],
  ['accent', 'surface', '.btn.ghost, .linkish'],
  ['accentInk', 'accentWash', '.pill.good, .builder-status'],
  ['onAccent', 'accent', '.btn, .chip[present], .tab[selected]'],
  ['danger', 'surface', '.btn.danger, .mini:hover'],
  ['danger', 'dangerWash', 'the allergy banner'],
  ['onDanger', 'danger', 'filled danger control'],
  ['cautionInk', 'cautionWash', '.banner-backup, .warn-box, .pill.warn'],
  ['cautionInk', 'surface', '.cite .unverified'],
  ['paperInk', 'paper', 'the preview sheet -- paper is paper in every mode'],
];

/** Boundaries and rings, which carry meaning without carrying text. */
const NON_TEXT_PAIRS: Pair[] = [
  ['lineStrong', 'surface', 'an input border on a card: the only affordance'],
  ['lineStrong', 'bg', 'an input border on the page'],
  ['focus', 'bg', 'the focus ring, which sits outside the control'],
  ['focus', 'surface', 'the focus ring over a card'],
  ['caution', 'cautionWash', 'the 4px advice-tier stripe'],
  ['accent', 'bg', 'a filled accent control against the page'],
];

describe('the screen palette', () => {
  for (const mode of MODES) {
    describe(mode, () => {
      const t = THEMES[mode];

      for (const [fg, bg, where] of TEXT_PAIRS) {
        it(`${fg} on ${bg} is readable as text — ${where}`, () => {
          expect(contrast(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(4.5);
        });
      }

      for (const [fg, bg, where] of NON_TEXT_PAIRS) {
        it(`${fg} on ${bg} is visible as a boundary — ${where}`, () => {
          expect(contrast(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(3);
        });
      }

      it('declares a colour-scheme, so native selects follow the app', () => {
        expect(['light', 'dark']).toContain(t.colorScheme);
      });

      it('keeps the preview sheet on white paper', () => {
        // Not negotiable and not a matter of taste: the sheet is a picture of
        // what the printer will produce, and the printer has one palette.
        expect(t.paper).toBe('#ffffff');
      });
    });
  }

  it('offers exactly the three modes the UI can switch between', () => {
    expect(MODES.sort()).toEqual(['contrast', 'dark', 'light']);
  });
});

describe('tokens.css', () => {
  it('is exactly what theme.ts generates', () => {
    const onDisk = readFileSync(
      resolve(__dirname, '../src/render/screen/tokens.css'),
      'utf8',
    );
    // If this fails, someone edited the generated file or changed the palette
    // without running `npm run theme:tokens`.
    expect(onDisk).toBe(tokensCss());
  });

  it('defines the legacy names, so the existing stylesheet keeps working', () => {
    const css = tokensCss();
    for (const name of ['--teal', '--teal-ink', '--teal-wash', '--alert', '--alert-wash', '--unvetted', '--warn-wash']) {
      expect(css).toContain(`${name}:`);
    }
  });

  it('lets an explicit choice beat the operating system', () => {
    const css = tokensCss();
    // The OS rule is scoped to :root WITHOUT a data-theme, so picking "light"
    // on a dark phone actually gives you light.
    expect(css).toContain(':root:not([data-theme])');
    expect(css).toContain('[data-theme="light"]');
  });

  it('zeroes motion rather than restating every transition', () => {
    expect(tokensCss()).toContain('prefers-reduced-motion');
  });
});

describe('density', () => {
  it('never drops a tap target below the WCAG 2.2 minimum', () => {
    for (const d of Object.values(DENSITIES)) {
      expect(parseInt(d.tap, 10)).toBeGreaterThanOrEqual(24);
    }
  });

  it("gives the doctor's phone a comfortable thumb target", () => {
    expect(parseInt(DENSITIES.comfortable.tap, 10)).toBeGreaterThanOrEqual(44);
  });
});

describe('resolveMode', () => {
  it('defers to the system only when the choice is "system"', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
    expect(resolveMode('contrast', true)).toBe('contrast');
  });
});
