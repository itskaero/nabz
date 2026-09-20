/**
 * Colour, in one place, for the printed document AND the screen.
 *
 * Colour discipline (DESIGN.md 3): exactly three roles get colour.
 *   accent (teal) = interactive actions AND "vetted / approved / safe"
 *   caution (amber) = "the doctor's own words, not vetted" (advice tier 3)
 *   danger (red)  = danger only -- allergy, red-flag advice
 * Everything else is neutral ink. Because red is never decorative, the eye
 * learns that red means danger.
 *
 * On paper, colour is a REINFORCEMENT and never the signal: a cheap mono laser
 * renders all of this as grey. Every safety state also carries a border and a
 * word (DESIGN.md 8, PRODUCT.md 10).
 *
 * ---------------------------------------------------------------------------
 * PAPER AND SCREEN ARE TWO PALETTES, AND THAT IS THE POINT.
 *
 * They used to be one set of hexes written out twice -- once here for the PDF,
 * once by hand in `screen/styles.css` for the app -- which is two sources of
 * truth for the same value. Change one and the other silently drifts, and this
 * app's structural promise is that the preview IS the print.
 *
 * So: `palette` below is the PRINT palette and nothing else reads it but the
 * PDF layout. `THEMES` is the SCREEN palette, and `tokensCss()` generates
 * `screen/tokens.css` from it, so the stylesheet cannot drift from this file.
 *
 * They are separate because paper and screen have different contrast physics.
 * A 3:1 grey at 7.2pt on a 300dpi laser is comfortable; the same grey at 10px
 * on a phone held under an OPD window is not. Print values are therefore
 * FROZEN -- a clinician has reviewed what comes out of the printer -- while the
 * screen values are held to WCAG floors that `tests/theme.test.ts` enforces.
 * The preview is unaffected either way: it draws the PDF model, so it renders
 * the print palette by construction.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

// --- the print palette -----------------------------------------------------

/**
 * What the PDF draws with. FROZEN: changing a value here changes what comes
 * out of a clinic's printer, and what comes out of a clinic's printer has been
 * looked at by a clinician. Screen accessibility fixes belong in `THEMES`.
 */
export const palette = {
  bg: '#eef1f2',
  surface: '#ffffff',
  ink: '#14201f',
  inkSoft: '#55635f',
  inkFaint: '#8a9691',
  line: '#dfe4e3',
  lineSoft: '#eceeed',

  teal: '#0f766e',
  tealInk: '#0b5a54',
  tealWash: '#e6f2f0',

  alert: '#b4232a',
  alertWash: '#fbeceb',

  unvetted: '#a8722a',
  warnWash: '#f6eddf',

  /**
   * DESIGN.md 7: NOT the cream-paper cliche. The patient block is a faint
   * in-palette teal tint so the jump from workspace to document is a gradient
   * within one family rather than a change of app.
   */
  patientTint: '#f2f7f6',
  sheet: '#f6f8f8',
} as const;

export const ink = hexToRgb(palette.ink);
export const inkSoft = hexToRgb(palette.inkSoft);
export const inkFaint = hexToRgb(palette.inkFaint);
export const rule = hexToRgb(palette.line);
export const teal = hexToRgb(palette.teal);
export const tealWash = hexToRgb(palette.tealWash);
export const alert = hexToRgb(palette.alert);
export const alertWash = hexToRgb(palette.alertWash);
export const unvetted = hexToRgb(palette.unvetted);
export const warnWash = hexToRgb(palette.warnWash);
export const patientTint = hexToRgb(palette.patientTint);
export const white = { r: 1, g: 1, b: 1 };

// --- the screen palette ----------------------------------------------------

/**
 * Three modes, not two.
 *
 * `light` is the base register (DESIGN.md 1.2). `dark` exists because a ward
 * round at 03:00 is a real shift and a white phone at arm's length in a dark
 * room is a genuine complaint, not a preference. `contrast` exists because the
 * other end of the same day is an OPD window in Lahore in June, and because
 * the doctor holding the phone may be sixty.
 *
 * `system` is not a mode -- it is a CHOICE between modes, resolved before
 * anything here is consulted (see `resolveMode`).
 */
export type ThemeMode = 'light' | 'dark' | 'contrast';

/** What the user may pick. `system` follows `prefers-color-scheme`. */
export type ThemeChoice = ThemeMode | 'system';

/**
 * Two densities, one axis.
 *
 * The app already needed this and faked it with `.app[data-wide]` plus a
 * comment apiece: the doctor's phone wants tap targets, the reception desk
 * wants twenty rows on screen at once. Making it a token axis means one switch
 * instead of one exception per component.
 */
export type Density = 'comfortable' | 'compact';

/**
 * A semantic role, never a colour name.
 *
 * `accent` rather than `teal` because in dark mode the accent is a LIGHT teal
 * carrying dark ink, and a token called `--teal` that must be read as "the
 * interactive colour, whatever it currently is" is a token that will be misused.
 * The literal names survive as aliases (see `LEGACY_ALIASES`) so the existing
 * stylesheet keeps working; new rules use these.
 */
export interface ThemeTokens {
  /** page behind everything */
  bg: string;
  /** cards, bars, inputs */
  surface: string;
  /** modals and popovers, which must read as ABOVE a card */
  surfaceRaised: string;
  /** body text */
  ink: string;
  /** secondary text: notes, metadata, the English under a drug name */
  inkSoft: string;
  /**
   * The quietest text that is still TEXT -- field labels, hints, unit tags.
   * Held to the 4.5:1 body-text floor, not the 3:1 non-text one, because
   * "Weight kg" at 10.5px is the thing telling a doctor which box they are in.
   */
  inkFaint: string;
  /** hairlines and card edges: decorative, never the only affordance */
  line: string;
  /** the quietest divider; inside a card, between rows */
  lineSoft: string;
  /**
   * The border of a control whose boundary is the ONLY thing marking it --
   * a white input on a white card. Held to 3:1 (WCAG 1.4.11).
   */
  lineStrong: string;

  /** interactive, and "vetted / approved / safe" */
  accent: string;
  /** accent as TEXT on `accentWash` -- a darker or lighter step of the same hue */
  accentInk: string;
  /** the accent's tinted background */
  accentWash: string;
  /** what sits ON a filled accent surface. White in light mode, dark in dark mode. */
  onAccent: string;

  /** danger: allergy, red flags. Never decorative. */
  danger: string;
  dangerInk: string;
  dangerWash: string;
  onDanger: string;

  /** "not vetted": the doctor's own words, an unverified dose */
  caution: string;
  /**
   * Caution as TEXT. A separate step because the amber that reads correctly as
   * a 4px border stripe is below the text floor as 12px type -- which the old
   * stylesheet already knew, and worked around with `#6d4a1b` written out by
   * hand in three places.
   */
  cautionInk: string;
  cautionWash: string;

  /** the patient-facing block: a faint in-palette tint, not cream */
  patientTint: string;
  /** the desk the preview sheet sits on */
  sheet: string;

  /** the focus ring. Sits OUTSIDE the control, so it contrasts with `bg`. */
  focus: string;
  /** modal backdrop */
  scrim: string;
  shadow1: string;
  shadow2: string;

  /**
   * PAPER IS PAPER.
   *
   * The preview sheet is white with near-black ink in every mode, including
   * dark, because it is a picture of the thing coming out of the printer. A
   * "dark mode preview" would be a preview of a document that does not exist.
   */
  paper: string;
  paperInk: string;

  /** what `color-scheme` should say, so native selects and scrollbars follow */
  colorScheme: 'light' | 'dark';
}

const LIGHT: ThemeTokens = {
  bg: '#eef1f2',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  ink: '#14201f',
  inkSoft: '#55635f',
  // was #8a9691 -- 3.06:1 on white and 2.70:1 on the app background, i.e.
  // below the text floor everywhere it was used, which was every field label.
  inkFaint: '#616e6a',
  line: '#dfe4e3',
  lineSoft: '#eceeed',
  lineStrong: '#808d89',

  accent: '#0f766e',
  accentInk: '#0b5a54',
  accentWash: '#e6f2f0',
  onAccent: '#ffffff',

  danger: '#b4232a',
  dangerInk: '#8f1b21',
  dangerWash: '#fbeceb',
  onDanger: '#ffffff',

  caution: '#a8722a',
  cautionInk: '#6d4a1b',
  cautionWash: '#f6eddf',

  patientTint: '#f2f7f6',
  sheet: '#f6f8f8',

  focus: '#0f766e',
  scrim: 'rgba(20, 32, 31, 0.35)',
  shadow1: '0 1px 2px rgba(20, 32, 31, 0.06), 0 4px 10px rgba(20, 32, 31, 0.04)',
  shadow2: '0 1px 3px rgba(20, 32, 31, 0.14), 0 8px 24px rgba(20, 32, 31, 0.08)',

  paper: '#ffffff',
  paperInk: '#14201f',
  colorScheme: 'light',
};

/**
 * Not black. A pure-black field makes white Nastaliq bloom, and this app draws
 * a lot of Nastaliq; the surfaces are a deep desaturated green-grey so the
 * whole thing stays recognisably the same product with the lights off.
 */
const DARK: ThemeTokens = {
  bg: '#0c1413',
  surface: '#141e1d',
  surfaceRaised: '#1c2827',
  ink: '#e8efed',
  inkSoft: '#a8b7b3',
  inkFaint: '#8b9a96',
  line: '#2b3937',
  lineSoft: '#212d2c',
  lineStrong: '#657672',

  // Light accent carrying dark ink -- a #0f766e button on a #141e1d card is a
  // 2.2:1 shape you cannot find, and no amount of white text fixes that.
  accent: '#4fd1c5',
  accentInk: '#7fdcd1',
  accentWash: '#11302d',
  onAccent: '#04211e',

  danger: '#ff8b84',
  dangerInk: '#ffa8a2',
  dangerWash: '#341917',
  onDanger: '#2b0b09',

  caution: '#e3ab63',
  cautionInk: '#f0c68f',
  cautionWash: '#2e2415',

  patientTint: '#0f1f1d',
  sheet: '#080f0e',

  focus: '#7fdcd1',
  scrim: 'rgba(0, 0, 0, 0.6)',
  shadow1: '0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.35)',
  shadow2: '0 1px 3px rgba(0, 0, 0, 0.6), 0 8px 24px rgba(0, 0, 0, 0.45)',

  paper: '#ffffff',
  paperInk: '#14201f',
  colorScheme: 'dark',
};

/**
 * High contrast, and deliberately built on WHITE rather than as a darker
 * light mode: the case it serves is direct sunlight on a phone, where the
 * screen's own black point is the limit and the only lever left is ink.
 */
const CONTRAST: ThemeTokens = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  ink: '#000000',
  inkSoft: '#1d2726',
  inkFaint: '#394643',
  line: '#5c6c68',
  lineStrong: '#31403c',
  lineSoft: '#8d9b97',

  accent: '#0a534d',
  accentInk: '#073d39',
  accentWash: '#e2f0ee',
  onAccent: '#ffffff',

  danger: '#8e0f17',
  dangerInk: '#6d0b11',
  dangerWash: '#fbeceb',
  onDanger: '#ffffff',

  caution: '#6d4a1b',
  cautionInk: '#4a3011',
  cautionWash: '#f6eddf',

  patientTint: '#eef5f4',
  sheet: '#e7ecea',

  focus: '#0a534d',
  scrim: 'rgba(0, 0, 0, 0.5)',
  shadow1: '0 0 0 1px #31403c',
  shadow2: '0 0 0 1px #31403c',

  paper: '#ffffff',
  paperInk: '#000000',
  colorScheme: 'light',
};

export const THEMES: Record<ThemeMode, ThemeTokens> = {
  light: LIGHT,
  dark: DARK,
  contrast: CONTRAST,
};

/**
 * `system` is not a palette -- it is a deferral. Resolved here so nothing
 * downstream has to know the choice existed.
 */
export function resolveMode(choice: ThemeChoice, prefersDark: boolean): ThemeMode {
  if (choice !== 'system') return choice;
  return prefersDark ? 'dark' : 'light';
}

// --- the non-colour axes ---------------------------------------------------

export interface DensityTokens {
  /** minimum hit area on any control, px. WCAG 2.2 AA floor is 24. */
  tap: string;
  /** vertical padding inside a button or input */
  ctlPadY: string;
  ctlPadX: string;
  /** padding inside a card */
  cardPad: string;
  /** gap between stacked cards / rows */
  stack: string;
  /** base type size */
  fontBase: string;
}

export const DENSITIES: Record<Density, DensityTokens> = {
  /**
   * The doctor's phone, one-handed, at OPD speed (DESIGN.md 11). 44px is the
   * comfortable-thumb target, not the 24px accessibility floor -- a mis-tap
   * here deletes a medication row.
   */
  comfortable: {
    tap: '44px',
    ctlPadY: '10px',
    ctlPadX: '14px',
    cardPad: '12px',
    stack: '10px',
    fontBase: '15px',
  },
  /**
   * The reception desk: a mouse, a big screen, and twenty rows to scan. Every
   * row that fits is a row nobody scrolls for. Still 32px, never below the
   * WCAG 2.2 24px minimum.
   */
  compact: {
    tap: '32px',
    ctlPadY: '6px',
    ctlPadX: '10px',
    cardPad: '9px',
    stack: '7px',
    fontBase: '14px',
  },
};

/**
 * Motion, as two durations and one curve.
 *
 * Small, and small on purpose. An interface a doctor uses two hundred times a
 * day should not animate: the second viewing of a transition is the last one
 * that is charming and the hundredth is a delay. What motion there is exists
 * to say where something CAME FROM -- a sheet rising from the bottom, a row
 * collapsing into the place it went -- and nothing exists to decorate.
 *
 * `prefers-reduced-motion` zeroes both durations rather than removing the
 * rules, so a transition never has to be written twice.
 */
export const MOTION = {
  fast: '110ms',
  base: '180ms',
  ease: 'cubic-bezier(0.2, 0, 0.2, 1)',
} as const;

export const RADII = { r: '8px', rSm: '6px', rPill: '999px' } as const;

// --- generated CSS ---------------------------------------------------------

/**
 * The literal names the existing stylesheet uses, mapped onto the semantic
 * ones. A deprecation shim with a job: 1500 lines of working CSS do not get
 * mass-renamed to buy a naming improvement, but nothing new should reach for
 * `--teal` either.
 */
const LEGACY_ALIASES: Record<string, keyof ThemeTokens> = {
  '--teal': 'accent',
  '--teal-ink': 'accentInk',
  '--teal-wash': 'accentWash',
  '--alert': 'danger',
  '--alert-wash': 'dangerWash',
  '--unvetted': 'caution',
  '--warn-wash': 'cautionWash',
};

const KEBAB: Array<[keyof ThemeTokens, string]> = [
  ['bg', '--bg'],
  ['surface', '--surface'],
  ['surfaceRaised', '--surface-raised'],
  ['ink', '--ink'],
  ['inkSoft', '--ink-soft'],
  ['inkFaint', '--ink-faint'],
  ['line', '--line'],
  ['lineSoft', '--line-soft'],
  ['lineStrong', '--line-strong'],
  ['accent', '--accent'],
  ['accentInk', '--accent-ink'],
  ['accentWash', '--accent-wash'],
  ['onAccent', '--on-accent'],
  ['danger', '--danger'],
  ['dangerInk', '--danger-ink'],
  ['dangerWash', '--danger-wash'],
  ['onDanger', '--on-danger'],
  ['caution', '--caution'],
  ['cautionInk', '--caution-ink'],
  ['cautionWash', '--caution-wash'],
  ['patientTint', '--patient-tint'],
  ['sheet', '--sheet'],
  ['focus', '--focus'],
  ['scrim', '--scrim'],
  ['shadow1', '--shadow'],
  ['shadow2', '--shadow-lifted'],
  ['paper', '--paper'],
  ['paperInk', '--paper-ink'],
];

function block(t: ThemeTokens, indent = '  '): string {
  const lines = KEBAB.map(([key, name]) => `${indent}${name}: ${t[key]};`);
  lines.push(`${indent}color-scheme: ${t.colorScheme};`);
  for (const [name, key] of Object.entries(LEGACY_ALIASES)) {
    lines.push(`${indent}${name}: ${t[key]};`);
  }
  return lines.join('\n');
}

function densityBlock(d: DensityTokens, indent = '  '): string {
  return [
    `${indent}--tap: ${d.tap};`,
    `${indent}--ctl-pad-y: ${d.ctlPadY};`,
    `${indent}--ctl-pad-x: ${d.ctlPadX};`,
    `${indent}--card-pad: ${d.cardPad};`,
    `${indent}--stack: ${d.stack};`,
    `${indent}--font-base: ${d.fontBase};`,
  ].join('\n');
}

export const TOKENS_HEADER = `/* GENERATED FROM src/render/theme.ts -- DO NOT EDIT.
 * Run \`npm run theme:tokens\` after changing the palette.
 * tests/theme.test.ts fails the build if this file drifts, and fails it again
 * if any mode drops a text pair below its WCAG floor. */`;

/** The whole token stylesheet, as a string. Written to `screen/tokens.css`. */
export function tokensCss(): string {
  const out: string[] = [TOKENS_HEADER, ''];

  out.push(':root {', block(LIGHT), '', densityBlock(DENSITIES.comfortable), '');
  out.push(`  --r: ${RADII.r};`);
  out.push(`  --r-sm: ${RADII.rSm};`);
  out.push(`  --r-pill: ${RADII.rPill};`);
  out.push(`  --motion-fast: ${MOTION.fast};`);
  out.push(`  --motion-base: ${MOTION.base};`);
  out.push(`  --ease: ${MOTION.ease};`);
  out.push('}', '');

  // `system` and an explicit choice are two different selectors on purpose: an
  // explicit choice must beat the OS, and the OS must apply when there is none.
  out.push('@media (prefers-color-scheme: dark) {');
  out.push('  :root:not([data-theme]) {', block(DARK, '    '), '  }');
  out.push('}', '');

  out.push('[data-theme="light"] {', block(LIGHT), '}', '');
  out.push('[data-theme="dark"] {', block(DARK), '}', '');
  out.push('[data-theme="contrast"] {', block(CONTRAST), '}', '');

  out.push('[data-density="compact"] {', densityBlock(DENSITIES.compact), '}', '');
  out.push('[data-density="comfortable"] {', densityBlock(DENSITIES.comfortable), '}', '');

  // Honour the OS switch without writing every transition twice.
  out.push('@media (prefers-reduced-motion: reduce) {');
  out.push('  :root {');
  out.push('    --motion-fast: 0ms;');
  out.push('    --motion-base: 0ms;');
  out.push('  }');
  out.push('}', '');

  return out.join('\n');
}
