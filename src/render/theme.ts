/**
 * Colour, in one place, for the printed document AND the screen.
 *
 * Colour discipline (DESIGN.md 3): exactly three roles get colour.
 *   accent (forest green) = interactive actions AND "vetted / approved / safe"
 *   caution (amber) = "the doctor's own words, not vetted" (advice tier 3)
 *   danger (red)  = danger only -- allergy, red-flag advice
 * Everything else is neutral ink. Because red is never decorative, the eye
 * learns that red means danger.
 *
 * THE SCREEN PALETTE IS THE EASE HEALTH BOTANICAL SYSTEM.
 *
 * Its five surfaces are taken literally -- Cream Paper #fffefc, Keylime Wash
 * #e1f4df, Mint #cfe7d3, Sage #b1dbb8, Slate #b6ced5 -- with Forest Ink
 * #0f3e17 as the ONE action colour and Charcoal #222222 as body ink. That
 * system has no danger colour and no caution colour, and says not to introduce
 * new accent hues; red and amber are therefore kept as ALARMS rather than
 * accents, which is why they are allowed to be foreign to it. Slate is the one
 * surface the app does not use: it is a cool note, and every tinted zone in
 * here sits inside the same green family on purpose (DESIGN.md 7).
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
  /**
   * The shell BEHIND the page: the nav rail, the bottom bar, the window chrome.
   *
   * The third tonal step, and the one that was missing. Every reference app
   * worth looking at gets its depth from three surfaces -- shell, page, card --
   * rather than from borders, and nabz had two. On a dark ground the shell is
   * the darkest of the three; on a light one it is the most tinted, because
   * the card has nowhere brighter to go than white.
   */
  surfaceSunken: string;
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
   * The fill of a bar that floats OVER scrolling content.
   *
   * Translucent, with `backdrop-filter` behind it, so the content scrolling
   * under the sticky action bar is visible as movement rather than being cut
   * off at a hard edge. Deliberately NOT used for anything carrying text that
   * must be read against unknown content -- a dose, a warning, a name -- since
   * translucency makes the contrast of that text a function of whatever
   * happens to be underneath, which is not a thing that can be tested.
   *
   * In `contrast` mode this is opaque, which is how the mode stays a
   * guarantee rather than a preference.
   */
  glass: string;
  glassLine: string;

  /**
   * The one gradient, as two stops.
   *
   * One per screen and no more: the references each use a single luminous
   * field to carry the eye to the thing that matters, and a product that put a
   * gradient behind every card would have none. Stays inside the botanical
   * family -- the references' cyan and lilac are their brands, not ours.
   */
  heroFrom: string;
  heroTo: string;

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
  /*
    The ground is Keylime Wash, the design system's own hero-panel tint, used
    full-bleed as the page. Cards are Cream Paper on top of it.

    That ordering is deliberate and is the opposite of a marketing site, which
    puts cream behind and tints the panels: a marketing page has four panels
    and this screen has twenty cards, so tinting each one would leave no
    quiet ground anywhere. Tinting the GROUND instead gives the same botanical
    character with the cards still reading as the thing you work in.
  */
  bg: '#e1f4df',
  /*
    Mint, a step DEEPER than the keylime ground.

    On a light ground the card is already as bright as a card can be, so the
    third tone has to come from below: the rail and the bottom bar sink into
    Mint while the page stays Keylime and the cards stay Cream. Same three-step
    structure as a dark shell, built the only way round that works in light.
  */
  surfaceSunken: '#c7e2cb',
  surface: '#fffefc',
  surfaceRaised: '#ffffff',
  ink: '#222222',
  // Desaturated green-greys rather than neutrals, so the secondary text stays
  // in the family while body ink is the system's own Charcoal.
  inkSoft: '#41503f',
  // 6.04:1 at its worst (on the keylime ground), against a 4.5 floor. This is
  // every field label in the app; it was #8a9691 and below the floor
  // everywhere before tokens existed.
  inkFaint: '#4f5d50',
  line: '#d4e6d6',
  // Border Mist, exactly as the system specifies -- 1.15:1 on cream, which is
  // a hairline and must never be the only thing marking a boundary.
  lineSoft: '#efeeeb',
  /*
    Darkened a step with the shell.

    This is the border of a control whose boundary is its only affordance, and
    WCAG 1.4.11 wants 3:1 against whatever it sits on. #6f8273 cleared that on
    the page and the card but measured 2.96 on the new sunken shell -- which is
    exactly where the segmented control's selected segment lives. 3.27 there,
    and still only a hairline's weight.
  */
  lineStrong: '#687b6c',

  // Forest Ink, and nothing else, is the action colour. `accentInk` is the
  // same value rather than a darker step: the system has one green, and at
  // 9.31:1 on Mint it does not need a second.
  accent: '#0f3e17',
  accentInk: '#0f3e17',
  accentWash: '#cfe7d3',
  onAccent: '#ffffff',

  /*
    The alarms. Derived to sit in the same desaturated ink register as Forest
    Ink so they read as part of the palette rather than as web red and web
    amber, and measured against all five of the system's surfaces: the danger
    ink clears 6.32:1 at its worst (on Sage), the caution ink 4.83:1.

    The washes are ~1.2:1 against cream, so a wash is never the signal -- the
    left rail and the word carry it (DESIGN.md 8), which is also the system's
    own "depth comes from fill contrast" rule.
  */
  danger: '#7a1d1d',
  dangerInk: '#5c1515',
  dangerWash: '#f6e7e4',
  onDanger: '#ffffff',

  caution: '#a8722a',
  cautionInk: '#6d4a1b',
  cautionWash: '#f3ecdd',

  /**
   * DESIGN.md 7: NOT the cream-paper cliche, and not the cool Slate either.
   * The patient block is paper lying on the desk -- lighter and warmer than
   * the keylime ground, a faint step off the card it sits in, so the jump from
   * workspace to document is a gradient within one family rather than a change
   * of app. Sage is the desk underneath (`sheet`).
   */
  patientTint: '#eef8ec',
  sheet: '#b1dbb8',

  focus: '#0f3e17',
  scrim: 'rgba(18, 38, 24, 0.35)',
  /*
    Kept, against the design system's "never add box-shadow". On a desk monitor
    layered tints read as depth; on a 390px phone in direct sunlight they do
    not, and this app is used in both places. Warm-cast and wide rather than
    grey and tight, so it reads as light falling across the card.
  */
  shadow1: '0 1px 2px rgba(18, 38, 24, 0.05), 0 4px 12px rgba(18, 38, 24, 0.05)',
  shadow2: '0 1px 3px rgba(18, 38, 24, 0.1), 0 10px 28px rgba(18, 38, 24, 0.09)',

  glass: 'rgba(255, 254, 252, 0.82)',
  glassLine: 'rgba(15, 62, 23, 0.1)',

  // Sage through Mint: the desk the paper lies on, lifting into the panel
  // tint. A sweep with real luminosity in it, and no hue the palette does not
  // already own.
  heroFrom: '#b1dbb8',
  heroTo: '#e1f4df',

  paper: '#ffffff',
  // NOT Charcoal. This is a picture of what the printer produces, and the
  // print palette is frozen -- `palette.ink` is the value a clinician signed
  // off on. The preview matches the page or it is not a preview.
  paperInk: '#14201f',
  colorScheme: 'light',
};

/**
 * Not black. A pure-black field makes white Nastaliq bloom, and this app draws
 * a lot of Nastaliq; the surfaces are a deep desaturated green-grey so the
 * whole thing stays recognisably the same product with the lights off.
 */
const DARK: ThemeTokens = {
  /*
    OPENED UP, against measurements rather than taste.

    The four surfaces used to run #0c1413 / #141e1d / #1c2827, which is a 1.10
    contrast step between each -- near enough to flat that the layering was a
    fact about the hex codes rather than something an eye could see, and the
    whole mode read as one dark field with hairlines drawn on it.

    Sampling a dark app UI that does read as layered gives steps of 1.27-1.29,
    which is a luminance roughly doubling each time. These four are built to
    that separation (1.17 / 1.22 / 1.25, at luminances 2.3x, 1.8x and 1.6x
    apart) and are correspondingly lighter overall -- still a dark room's
    screen, no longer a black one.

    The green-grey cast is unchanged. A product whose hue family changes when
    the lights go out is a product with two brands.
  */
  surfaceSunken: '#131615',
  bg: '#212524',
  surface: '#2e3432',
  surfaceRaised: '#3b4341',
  ink: '#eef3f1',
  inkSoft: '#b8c6c1',
  // Raised with the surfaces. #8b9a96 measured 3.86:1 on the new raised
  // surface -- under the 4.5 body floor, and this token is every field label.
  inkFaint: '#a3b2ad',
  line: '#444d4a',
  lineSoft: '#39413f',
  lineStrong: '#7d8c87',

  /*
    Light accent carrying dark ink -- a #0f3e17 button on a #141e1d card is a
    1.6:1 shape you cannot find, and no amount of white text fixes that. So
    Forest Ink inverts here rather than being used literally.

    It is still GREEN. The design system does not describe a dark mode, but a
    product whose brand hue changes when the lights go out is a product with
    two brands, and the doctor switching to dark at 03:00 is the same doctor.
  */
  /*
    More chroma, for the same reason the surfaces opened up.

    #86d196 is a sage that goes grey against a lifted surface. The reference
    accent carries real saturation and is what makes a dark shell read as
    designed rather than as absent -- so this one does too, without leaving
    green.
  */
  accent: '#6edc8c',
  accentInk: '#8ee9a5',
  accentWash: '#1d3a26',
  onAccent: '#07280f',

  danger: '#ff938c',
  dangerInk: '#ffb0aa',
  dangerWash: '#452220',
  onDanger: '#2b0b09',

  caution: '#eab470',
  cautionInk: '#f5cf9c',
  cautionWash: '#3d3019',

  patientTint: '#263230',
  sheet: '#161a19',

  focus: '#8ee9a5',
  scrim: 'rgba(0, 0, 0, 0.6)',
  // Deeper, now that the surfaces they separate are lighter: a shadow that was
  // readable under a near-black card is invisible under a lifted one.
  shadow1: '0 1px 2px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.4)',
  shadow2: '0 1px 3px rgba(0, 0, 0, 0.65), 0 12px 32px rgba(0, 0, 0, 0.5)',

  glass: 'rgba(46, 52, 50, 0.78)',
  glassLine: 'rgba(238, 243, 241, 0.1)',

  heroFrom: '#1d3a26',
  heroTo: '#212524',

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
  /*
    FLAT, on purpose, and the one mode that takes none of this.

    Layering, translucency and gradients all work by making surfaces differ by
    a little. This mode exists for a phone in direct sunlight and for a doctor
    who is sixty, where "a little" is nothing at all -- so the shell is the
    page is the card, every boundary is a hard 3:1 line, and the glass and the
    gradient below resolve to flat white.
  */
  surfaceSunken: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  ink: '#000000',
  inkSoft: '#1d2726',
  inkFaint: '#394643',
  line: '#5c6c68',
  lineStrong: '#31403c',
  lineSoft: '#8d9b97',

  // Forest Ink unchanged from the design system: at 12.20:1 on white it is
  // already a high-contrast ink, so this mode needs no darker step invented
  // for it -- only a deeper one for text sitting on the wash.
  accent: '#0f3e17',
  accentInk: '#0a2b10',
  accentWash: '#e1f4df',
  onAccent: '#ffffff',

  danger: '#8e0f17',
  dangerInk: '#6d0b11',
  dangerWash: '#fbeceb',
  onDanger: '#ffffff',

  caution: '#6d4a1b',
  cautionInk: '#4a3011',
  cautionWash: '#f6eddf',

  patientTint: '#eef8ec',
  sheet: '#dfeadd',

  focus: '#0f3e17',
  scrim: 'rgba(0, 0, 0, 0.5)',
  shadow1: '0 0 0 1px #31403c',
  shadow2: '0 0 0 1px #31403c',

  glass: '#ffffff',
  glassLine: '#31403c',

  heroFrom: '#ffffff',
  heroTo: '#ffffff',

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
    /*
      The design system asks for 28-42px. Not taken literally, and the density
      axis is exactly why: 28px is lovely behind four panels on a desk monitor
      and ruinous behind twenty cards on a 390px phone, where it would eat 56px
      of vertical per card and push the third card off the screen. 20px is the
      move toward it that a one-handed OPD screen can actually afford -- and
      4px of it is what the 14px radius costs, since a tighter pad leaves the
      corner eating the first character of the first row.
    */
    cardPad: '20px',
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
    cardPad: '12px',
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

/**
 * Corner radius, in three steps.
 *
 * 8px was a compromise from when every surface was a bordered box. Cards and
 * sheets now carry their edge with a shadow and a tint, and at that weight 8px
 * reads as a rounded rectangle rather than a rounded card. 14px is the Ease
 * Health card radius, taken as given; `rSm` follows it up so a chip inside a
 * card still nests visually instead of matching it.
 */
export const RADII = { r: '14px', rSm: '10px', rPill: '999px' } as const;

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
  ['surfaceSunken', '--surface-sunken'],
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
  ['glass', '--glass'],
  ['glassLine', '--glass-line'],
  ['heroFrom', '--hero-from'],
  ['heroTo', '--hero-to'],
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
