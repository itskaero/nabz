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
  /*
    The sunken shell, added when the surfaces opened up to three tones.

    The rail and the bottom bar are a DESTINATION LIST -- every one of those
    labels is text a doctor reads to decide where to go -- so the new surface
    is held to the body floor like any other, not to the 3:1 one. The
    segmented track sits on the same colour, and its unselected segments are
    `inkSoft`.
  */
  ['ink', 'surfaceSunken', '.side-item, .bottom-item label'],
  ['inkSoft', 'surfaceSunken', '.segmented button, an unselected segment'],
  ['inkFaint', 'surfaceSunken', '.side-group-label, .month-count'],
  /*
    The gradient's two stops, each treated as a background in its own right.

    A gradient is not one colour, and testing the average of two would pass a
    band whose dark end swallowed the text sitting on it. Both ends are
    checked, so the sweep can be re-aimed later without anyone having to
    remember that the text on it is the reason it was chosen.
  */
  ['ink', 'heroFrom', '.hero-band heading, at the saturated end'],
  ['ink', 'heroTo', '.hero-band heading, at the pale end'],
  ['inkSoft', 'heroFrom', '.hero-band sub-copy, at the saturated end'],
  ['inkSoft', 'heroTo', '.hero-band sub-copy, at the pale end'],
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
  /*
    The SELECTED segment's edge, not its fill.

    A lifted segment is about 1.3:1 against its own track, and no tonal ladder
    can do better -- three surfaces that differ by 3:1 are not a ladder, they
    are three different colours. So the state does not rest on the fill: the
    selected segment carries `--line-strong`, which is held to 3:1 on every
    surface it can sit on, plus bold weight, a shadow and `aria-pressed`.
  */
  ['lineStrong', 'surfaceSunken', 'the selected segment edge against its track'],
];

/**
 * The three tones have to BE three tones.
 *
 * The reason this is a test and not a comment: the old dark mode ran
 * #0c1413 / #141e1d / #1c2827, which is a 1.10 contrast step -- layering that
 * existed in the hex codes and nowhere an eye could find it, and the whole
 * reason the app read as flat. A future palette pass that quietly collapses
 * them again should fail rather than merely look duller.
 *
 * `contrast` is exempt and that exemption is the point of the mode: it is
 * built for direct sunlight, where a subtle tonal step is no step at all, so
 * its shell, page and card are all white and every boundary is a hard line.
 */
const LAYERED_MODES = MODES.filter((m) => m !== 'contrast');

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

  for (const mode of LAYERED_MODES) {
    it(`${mode} keeps the shell, the page and the card visibly apart`, () => {
      const t = THEMES[mode];
      // Measured off a dark app UI that does read as layered: ~1.28 between
      // adjacent surfaces. 1.15 is the floor this holds, which is well clear
      // of the 1.10 the old dark mode managed and still leaves room for a
      // palette that wants to be quieter than the reference.
      /*
        Two floors, because the two modes have different physics.

        A dark ground has room: the reference runs ~1.28 between adjacent
        surfaces and this mode gets 1.17 / 1.22 / 1.25. A light ground does
        not -- the page is already a tint and the card is already near-white,
        so Keylime to Cream is 1.14 and no amount of taste will make it 1.28.

        So each adjacent step must be visible at all (1.12, comfortably above
        the 1.10 the old dark mode managed), and the SHELL-TO-CARD total, which
        is what the eye actually reads as depth, must clear 1.35.
      */
      expect(contrast(t.surfaceSunken, t.bg)).toBeGreaterThanOrEqual(1.12);
      expect(contrast(t.bg, t.surface)).toBeGreaterThanOrEqual(1.12);
      expect(contrast(t.surfaceSunken, t.surface)).toBeGreaterThanOrEqual(1.35);
    });
  }

  it('leaves contrast mode flat, because a tonal step is no help in sunlight', () => {
    const t = THEMES.contrast;
    expect(t.surfaceSunken).toBe(t.surface);
    expect(t.bg).toBe(t.surface);
    // And the two decorative imports resolve to nothing, rather than being
    // skipped by a rule somebody could delete.
    expect(t.heroFrom).toBe(t.heroTo);
    expect(t.glass).toBe('#ffffff');
  });
});

/**
 * The alarms, against the whole surface ladder.
 *
 * The Ease Health system has no danger colour and no caution colour, and tells
 * you not to introduce new accent hues -- so red and amber are in here as
 * ALARMS rather than accents. That makes them the two values most likely to be
 * "tidied" into the green family by a future palette pass, and the two whose
 * job depends entirely on staying legible: the allergy banner and the
 * not-vetted stripe are the loudest things this app says.
 *
 * So they are checked against all five of the system's surfaces rather than
 * only the two the light-mode tokens currently pair them with. A tinted panel
 * added later must not be able to swallow them silently.
 */
describe('the alarm inks, on every Ease Health surface', () => {
  const SURFACES: Array<[string, string]> = [
    ['Cream Paper', '#fffefc'],
    ['Keylime Wash', '#e1f4df'],
    ['Mint', '#cfe7d3'],
    ['Sage', '#b1dbb8'],
    ['Slate', '#b6ced5'],
  ];

  const ALARMS: Array<[string, string]> = [
    ['the danger ink', THEMES.light.danger],
    ['the caution ink', THEMES.light.cautionInk],
  ];

  for (const [role, value] of ALARMS) {
    for (const [name, surface] of SURFACES) {
      it(`${role} stays readable on ${name}`, () => {
        expect(contrast(value, surface)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('keeps the docs hero marker legible', () => {
    /*
      The marker block behind the hero's key words (docs/assets/style.css,
      `.hero h1 em`) sets Forest Ink on Mint. It is the one place in the
      product where ink sits on a SATURATED fill rather than a near-white
      surface, so it is the one most likely to be broken by a palette pass
      that only checked the app's own pairs.
    */
    expect(contrast(THEMES.light.accentInk, THEMES.light.accentWash)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps Forest Ink as the only action colour', () => {
    // One green, used for the accent, its text step and the focus ring. A
    // second interactive hue is how "the green means you can press it" stops
    // being true.
    expect(THEMES.light.accent).toBe('#0f3e17');
    expect(THEMES.light.accentInk).toBe('#0f3e17');
    expect(THEMES.light.focus).toBe('#0f3e17');
  });

  it('keeps the alarms out of the green family', () => {
    // A red that has drifted green-ward is a red that no longer says danger.
    for (const [, value] of ALARMS) {
      expect(contrast(value, THEMES.light.accent)).toBeLessThan(4.5);
    }
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
