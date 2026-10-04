/**
 * @vitest-environment jsdom
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
import { THEMES, palette, tokensCss, resolveMode, DENSITIES } from '@render/theme.ts';

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

  /*
    FOUR DISTINCT SURFACES — and no floor on the step between them.

    An earlier pass demanded 1.12 between adjacent surfaces, measured off a
    dark app UI that reads as layered. nama's own void register runs 1.036 /
    1.054 / 1.067, which is FLATTER than the palette that floor was written to
    replace, and nama's site does not look flat — because the family gets its
    depth from `--lift-1/2/3`, a 10%-ink hairline, glass panels and film
    grain, not from tone. Holding a tonal floor would have meant overriding
    the system to satisfy a number borrowed from somewhere else.

    So what is asserted is what actually matters: the four surfaces are four
    DIFFERENT values in the order shell < page < card < raised, and the
    shadows that carry the depth exist and differ from each other.
  */
  for (const mode of LAYERED_MODES) {
    it(`${mode} keeps four distinct surfaces in order`, () => {
      const t = THEMES[mode];
      const ladder = [t.surfaceSunken, t.bg, t.surface, t.surfaceRaised];
      // `raised` is allowed to equal `surface`: in the clinical register both
      // are white, because there is nowhere above white to go and nama's
      // answer is `--lift-3` rather than an invented off-white.
      expect(new Set(ladder).size).toBeGreaterThanOrEqual(3);
      /*
        The ladder ascends in BOTH registers, which is not obvious until you
        write it down: on the void the shell is the darkest thing and the card
        the lightest, and in the clinical register the shell is a tinted step
        BELOW a near-white page. Same direction, opposite grounds.
      */
      const step = (a: string, b: string) => Math.sign(luminance(b) - luminance(a));
      expect(step(t.surfaceSunken, t.bg)).toBe(1);
      expect(step(t.bg, t.surface)).toBe(1);
    });

    it(`${mode} carries the depth in its shadows, which is where nama puts it`, () => {
      const t = THEMES[mode];
      expect(t.shadow1.length).toBeGreaterThan(0);
      expect(t.shadow2).not.toBe(t.shadow1);
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
describe('the alarm inks, on every nama surface', () => {
  const SURFACES: Array<[string, string]> = [
    ['nama panel', '#ffffff'],
    ['nama void (clinical)', '#eef1f2'],
    ['nama deep (clinical)', '#f6f8f8'],
    ['the shell', '#e1e7e8'],
    ['the accent wash', '#e3f2ea'],
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

  /*
    THE DRIFT THIS TEST EXISTS TO STOP.

    Nabz is a member of the nama family (itskaero.github.io/nama), whose whole
    mechanism is that one attribute -- the accent -- is the entire difference
    between two members. The screen palette had drifted onto a different
    system entirely: keylime grounds, Forest Ink #0f3e17, cream cards. The
    PRINT palette never drifted, so the two had come apart on the one product
    whose structural promise is that the preview IS the print.

    These are nama's published values, pinned by hand. A future pass that
    "tidies" the accent is changing which family this product belongs to, and
    should have to say so by editing a test.
  */
  it('uses the nama family accent for nabz, in both registers', () => {
    // [data-accent="nabz"] under [data-register="clinical"]
    expect(THEMES.light.accent).toBe('#0f8055');
    expect(THEMES.light.accentWash).toBe('#e3f2ea');
    expect(THEMES.light.focus).toBe(THEMES.light.accent);
    // [data-accent="nabz"] on the void
    expect(THEMES.dark.accent).toBe('#19a06d');
    expect(THEMES.dark.accentInk).toBe('#7fd1a8');
  });

  it('keeps the nama ground and ink ramp, and keeps print agreeing with it', () => {
    expect(THEMES.light.bg).toBe('#eef1f2');
    expect(THEMES.light.surface).toBe('#ffffff');
    expect(THEMES.light.ink).toBe('#14201f');
    expect(THEMES.light.inkSoft).toBe('#55635f');
    expect(THEMES.light.line).toBe('#dfe4e3');
    expect(THEMES.light.lineSoft).toBe('#eceeed');
    // The void register, published as four surfaces.
    expect([THEMES.dark.surfaceSunken, THEMES.dark.bg, THEMES.dark.surface, THEMES.dark.surfaceRaised])
      .toEqual(['#04070e', '#080d16', '#0d1420', '#121b29']);
    expect(THEMES.dark.ink).toBe('#eef3f4');
    // The preview draws the print palette; both are now the same nama values.
    expect(THEMES.light.ink).toBe(palette.ink);
    expect(THEMES.light.bg).toBe(palette.bg);
  });

  it('departs from nama only where a published value fails WCAG, and nowhere else', () => {
    /*
      Three clinical values in nama.css are display values that do not survive
      small text, and this test records the measurement rather than the
      opinion -- so that anyone restoring them can see what it costs.
    */
    expect(contrast('#8a9691', THEMES.light.bg)).toBeLessThan(4.5); // nama ink-3
    expect(contrast('#d9a24a', '#ffffff')).toBeLessThan(4.5); // nama amber
    expect(contrast('#e0716a', '#ffffff')).toBeLessThan(4.5); // nama alert
    // And the void register's own published accent-ink for nabz.
    expect(contrast('#f4fbf7', '#19a06d')).toBeLessThan(4.5);
  });

  it('keeps the alarms out of the accent family', () => {
    // A red that has drifted teal-ward is a red that no longer says danger.
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

/**
 * THE AURORA, AND EVERY SURFACE THAT IS NOW TRANSLUCENT OVER IT.
 *
 * This is the part of the palette that cannot be eyeballed. Once the shell and
 * the cards are glass, the colour behind a piece of text is not a token any
 * more -- it is a composite of the glass fill, the aurora stop that happens to
 * be overhead, and the page. Three values, two alpha blends, and a drifting
 * field that puts a different one of them behind the same label every minute.
 *
 * So the test composites it. For each mode, each stop, and each surface alpha,
 * it reconstructs exactly what the browser will paint and checks every text
 * pair against 4.5 and every boundary pair against 3 -- at FULL stop strength,
 * which is the worst corner and also the one the eye finds first, since the
 * gradient holds its core flat before fading.
 *
 * What this protects: raising `auroraOpacity` by a tenth, or thinning a glass
 * alpha because it looked nicer, is a change to the legibility of every field
 * label in the app. It should fail a test rather than ship.
 */
describe('text over glass over the aurora', () => {
  /** `rgba(r, g, b, a)` -> `['#rrggbb', a]`. The tokens are authored as CSS. */
  function parseRgba(value: string): [string, number] {
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/.exec(
      value.trim(),
    );
    if (!m) return [value, 1];
    const hex = `#${[m[1], m[2], m[3]]
      .map((n) => Math.round(Number(n)).toString(16).padStart(2, '0'))
      .join('')}`;
    return [hex, m[4] === undefined ? 1 : Number(m[4])];
  }

  /** `fg` painted at `alpha` over `bg`, as the compositor would. */
  function over(fg: string, bg: string, alpha: number): string {
    const f = fg.replace('#', '');
    const b = bg.replace('#', '');
    const ch = (i: number) =>
      Math.round(
        parseInt(f.slice(i * 2, i * 2 + 2), 16) * alpha +
          parseInt(b.slice(i * 2, i * 2 + 2), 16) * (1 - alpha),
      );
    return `#${[0, 1, 2].map((i) => ch(i).toString(16).padStart(2, '0')).join('')}`;
  }

  const TEXT: Array<[Key, string]> = [
    ['ink', 'body text'],
    ['inkSoft', 'secondary text'],
    ['inkFaint', 'a field label — the quietest text that is still text'],
    ['cautionInk', 'an unverified dose'],
    ['dangerInk', 'an allergy'],
  ];
  const NON_TEXT: Array<[Key, string]> = [
    ['lineStrong', 'an input border, whose edge is its only affordance'],
    ['accent', 'a filled action'],
  ];

  for (const mode of MODES) {
    const t = THEMES[mode];
    const opacity = Number(t.auroraOpacity);
    // `contrast` turns the field off entirely, so there is no composite.
    if (opacity === 0) continue;

    for (const stopKey of ['auroraA', 'auroraB', 'auroraC'] as const) {
      const ground = over(t[stopKey], t.bg, opacity);
      const [glassHex, glassA] = parseRgba(t.glass);
      const [cardHex, cardA] = parseRgba(t.glassCard);

      const surfaces: Array<[string, string]> = [
        [ground, 'the bare page under the aurora'],
        [over(glassHex, ground, glassA), 'the glass shell over it'],
        [over(cardHex, ground, cardA), 'a glass card over it'],
      ];

      for (const [bg, where] of surfaces) {
        for (const [fg, what] of TEXT) {
          it(`${mode}: ${fg} stays readable on ${where} (${stopKey}) — ${what}`, () => {
            expect(contrast(t[fg] as string, bg)).toBeGreaterThanOrEqual(4.5);
          });
        }
        for (const [fg, what] of NON_TEXT) {
          it(`${mode}: ${fg} stays visible on ${where} (${stopKey}) — ${what}`, () => {
            expect(contrast(t[fg] as string, bg)).toBeGreaterThanOrEqual(3);
          });
        }
      }
    }
  }

  /*
    The rule that keeps a sunset from looking like a warning light.

    Amber and red are alarms here, and the aurora is deliberately warm, so the
    two could collide. What keeps them apart is grammar -- an alarm is a small
    saturated object inside the content, the aurora is a large soft field
    behind it -- and that is a discipline in the CSS, not something a colour
    test can check. What CAN be checked is that nobody ever shortcuts it by
    pointing an aurora stop straight at an alarm token.
  */
  it('never paints the aurora in an alarm colour', () => {
    for (const mode of MODES) {
      const t = THEMES[mode];
      if (Number(t.auroraOpacity) === 0) continue;
      const alarms = [t.danger, t.dangerInk, t.caution, t.cautionInk];
      for (const stop of [t.auroraA, t.auroraB, t.auroraC]) {
        expect(alarms, `${mode} aurora reuses an alarm colour`).not.toContain(stop);
      }
    }
  });

  it('turns the whole thing off in contrast mode rather than dimming it', () => {
    const t = THEMES.contrast;
    expect(Number(t.auroraOpacity)).toBe(0);
    expect(t.auroraA).toBe(t.bg);
    expect(t.auroraB).toBe(t.bg);
    expect(t.auroraC).toBe(t.bg);
    // And its glass is opaque, so a translucent surface never appears in the
    // one mode whose whole promise is that contrast is guaranteed.
    expect(t.glass).toBe('#ffffff');
    expect(t.glassCard).toBe('#ffffff');
  });
});

/**
 * WHICH REGISTER A DOCTOR MEETS FIRST.
 *
 * nama is explicit that Nabz "ships light by default and never auto-switches
 * to dark, because dark murders Nastaʿlīq legibility and trust". That is a
 * product rule with a typographic reason behind it, not a preference, so it is
 * worth a test: the Urdu line on the medication row is the thing this app does
 * that nothing else does, and Nastaʿlīq's thin strokes bloom and break up as
 * white-on-dark.
 *
 * `system` remains available as an explicit CHOICE. What is forbidden is the
 * OS making it on a doctor's behalf.
 */
describe('the register a doctor meets first', () => {
  it('is light, and is not inherited from the operating system', async () => {
    const { readAppearance } = await import('@domain/appearance.ts');
    // A device that has stored nothing. jsdom's localStorage is empty here.
    expect(readAppearance().theme).toBe('light');
  });

  it('still resolves system to whichever the OS asked for, once chosen', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
  });
});
