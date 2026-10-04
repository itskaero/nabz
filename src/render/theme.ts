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
   * The same idea at a card's alpha rather than a bar's.
   *
   * A card carries clinical values, so it is less transparent than the shell
   * — enough to pick up the aurora moving behind it, not enough for what is
   * behind to decide whether a dose is readable. Both alphas are chosen so
   * that the WORST composite (this fill over the most saturated aurora stop
   * over the page) still clears the body-text floor, which is what
   * `tests/theme.test.ts` actually measures rather than assuming.
   */
  glassCard: string;

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
   * The aurora: three stops, drifting, behind everything.
   *
   * Green, light yellow and a warm orange — and the warm two are the reason
   * this needed care rather than taste. Amber and red are ALARMS in this app
   * (`caution` is "the doctor's own words, not vetted"; `danger` is an
   * allergy), and the whole discipline rests on the eye learning that warm
   * means stop. A warm gradient could undo that in an afternoon.
   *
   * What keeps the two apart is not hue, it is GRAMMAR. An alarm is a small
   * saturated object inside the content — a 4px stripe, a filled pill, a word
   * in coloured text. The aurora is only ever a large soft field BEHIND the
   * content, never a fill, never a border, never text, and never inside a card
   * that carries a clinical value. Those two things do not look alike even
   * when they share a hue, in the way that a sunset and a warning light do
   * not look alike.
   */
  auroraA: string;
  auroraB: string;
  auroraC: string;
  /**
   * How much of the aurora reaches the page, as a number in a string.
   *
   * This is the single knob that decides whether every piece of text in the
   * app still clears its contrast floor, because the page ground becomes a mix
   * of `bg` and whichever stop is overhead. Raising it is not a styling
   * change; `tests/theme.test.ts` recomputes every pair against the composite
   * and will say so.
   */
  auroraOpacity: string;

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

/**
 * THE CLINICAL REGISTER OF THE NAMA DESIGN SYSTEM.
 *
 * Nabz is a member of the `nama` family (itskaero.github.io/nama) alongside
 * MeritNama, medNAMA, Antibiome and Antibiotogram. The family shares one
 * skeleton -- ground, ink ramp, type, spacing, radii, one easing curve -- and
 * members differ by a single accent. Nabz's is the teal `#19a06d`, which
 * becomes `#0f8055` in the clinical register, and `data-register="clinical"`
 * is the light ground the system mandates for this member: "a doctor must
 * never meet neon."
 *
 * THIS IS A CORRECTION. The screen palette had drifted onto a botanical
 * system -- keylime grounds, Forest Ink, cream cards -- that is not the
 * family's. The PRINT palette above never drifted (`#eef1f2`, `#14201f`,
 * `#55635f`, `#dfe4e3`, `#eceeed` are the nama clinical values, exactly), so
 * the two had quietly come apart on the one product whose structural promise
 * is that the preview IS the print. They agree again.
 *
 * WHERE THIS DEPARTS FROM THE PUBLISHED FILE, AND WHY. nama.css is a design
 * system with a marketing site attached, and three of its clinical values are
 * display values that fail WCAG at the sizes an app actually uses:
 *
 *   `--nama-ink-3: #8a9691`  2.70:1 on the ground. It is every field label
 *                            here. This codebase already caught that value
 *                            once; `inkFaint` is the darkest step that clears
 *                            4.5 on all four surfaces AND under the aurora.
 *   `--nama-amber: #d9a24a`  2.28:1 on white as text.
 *   `--nama-alert: #e0716a`  3.12:1 on white as text.
 *
 * The two alarms are darkened for this register in exactly the way nama itself
 * darkens its own accent from `#19a06d` to `#0f8055` when the ground inverts
 * -- the hue and the role are the system's, the luminance is this register's.
 * Everything else is taken as published.
 */
const LIGHT: ThemeTokens = {
  /*
    nama void / deep / panel, as the shell / page / card ladder.

    nama publishes three clinical surfaces and no "sunken", because a
    marketing page has no rail. `#e1e7e8` is that step, derived one tone below
    the ground so the chrome sits under the content rather than beside it.
  */
  surfaceSunken: '#e1e7e8',
  bg: '#eef1f2',
  surface: '#ffffff',
  /*
    Also white, which is nama's own answer: in the clinical register a modal
    does not get a brighter surface, it gets `--lift-3`. There is nowhere
    above white to go, and inventing an off-white for "raised" would make the
    brightest thing on screen the thing furthest from the page.
  */
  surfaceRaised: '#ffffff',
  ink: '#14201f',
  inkSoft: '#55635f',
  // nama's `--nama-ink-3` is #8a9691 and measures 2.70:1 here. See the header.
  inkFaint: '#5e6966',
  line: '#dfe4e3',
  lineSoft: '#eceeed',
  // The border of a control whose edge is its only affordance. nama has no
  // token for this case; 3.43:1 at its worst, against WCAG 1.4.11's 3.
  lineStrong: '#707d78',

  // `[data-accent="nabz"]` under `[data-register="clinical"]`, verbatim.
  accent: '#0f8055',
  // nama's clinical `--accent-2`, which is what reads as text on the wash.
  accentInk: '#0b6b3f',
  accentWash: '#e3f2ea',
  onAccent: '#ffffff',

  // nama's `--nama-alert` hue, at this register's luminance.
  danger: '#a8332c',
  dangerInk: '#8a241f',
  dangerWash: '#fbeceb',
  onDanger: '#ffffff',

  // nama's `--nama-amber` hue, likewise.
  caution: '#8a6220',
  cautionInk: '#6d4a1b',
  cautionWash: '#f6eddf',

  // nama's `--nama-deep`, the family's alternating band: the patient block is
  // a step off the card rather than a different colour from it.
  patientTint: '#f6f8f8',
  sheet: '#e1e7e8',

  focus: '#0f8055',
  scrim: 'rgba(4, 7, 14, 0.42)',
  // nama `--lift-1` and `--lift-2`, which are cool rather than warm because
  // the family's ground is a near-black blue.
  shadow1: '0 1px 2px rgba(20, 32, 31, 0.06)',
  shadow2: '0 8px 24px -10px rgba(20, 32, 31, 0.14)',

  glass: 'rgba(255, 255, 255, 0.58)',
  glassLine: 'rgba(20, 32, 31, 0.1)',
  glassCard: 'rgba(255, 255, 255, 0.7)',

  heroFrom: '#e3f2ea',
  heroTo: '#eef1f2',

  /*
    The aurora, in the family's own signals.

    nama names eight colours and says what each is FOR, which settles the
    question the last pass had to argue from first principles: `--nama-amber`
    is "caution, unverified" and `--nama-alert` is "danger only -- never
    decorative", so neither may appear in a background. The four that are free
    are teal, mint, sky and peach, and these are those four at this register's
    luminance.
  */
  auroraA: '#95f5c5',
  auroraB: '#b2e8fb',
  auroraC: '#f7e2ca',
  auroraOpacity: '0.62',

  paper: '#ffffff',
  // The print palette's own ink -- and now the same value as `ink`, because
  // both are nama clinical. The preview matches the page by construction
  // rather than by two files happening to agree.
  paperInk: '#14201f',
  colorScheme: 'light',
};

/**
 * THE VOID REGISTER, which is the family's default everywhere but here.
 *
 * nama's ground is a near-black BLUE -- the midpoint of MeritNama's #04060c
 * and medNAMA's #000912 -- not the green-grey this file used to invent. Four
 * surfaces, published: void, deep, panel, raised.
 *
 * Nabz still ships light and `readAppearance` still defaults to it, because
 * nama is explicit that this member never auto-switches: dark murders
 * Nastaʿlīq legibility, and the Urdu line is the product. This register is
 * here for the doctor who asks for it at 03:00, not for the OS to impose.
 *
 * `--accent-ink` departs from the published `#f4fbf7`: that measures 3.18:1 on
 * `#19a06d`, which is a label on a button nobody can read. The other four
 * family members all use `#04070e` for the same slot, and it measures 6.04.
 */
const DARK: ThemeTokens = {
  surfaceSunken: '#04070e',
  bg: '#080d16',
  surface: '#0d1420',
  surfaceRaised: '#121b29',
  ink: '#eef3f4',
  // nama's ink-2 and ink-3 are alphas of `ink`; these are those composites
  // over the panel, resolved to solids -- with ink-3 lifted from 4.02:1 to
  // 6.19 because a field label is text, not decoration.
  inkSoft: '#aab0b4',
  inkFaint: '#949ca0',
  line: '#262d36',
  lineSoft: '#1a212c',
  lineStrong: '#8e9699',

  accent: '#19a06d',
  // nama's `[data-accent="nabz"] --accent-2`.
  accentInk: '#7fd1a8',
  accentWash: '#0f2a28',
  onAccent: '#04070e',

  danger: '#e0716a',
  dangerInk: '#eb948e',
  dangerWash: '#2b1512',
  onDanger: '#04070e',

  caution: '#d9a24a',
  cautionInk: '#e6bb7c',
  cautionWash: '#2a2013',

  patientTint: '#121b29',
  sheet: '#04070e',

  focus: '#7fd1a8',
  scrim: 'rgba(4, 7, 14, 0.72)',
  // nama `--lift-1` / `--lift-2` for the void: depth, not shine.
  shadow1: '0 1px 2px rgba(0, 0, 0, 0.4)',
  shadow2: '0 10px 30px -10px rgba(0, 0, 0, 0.6)',

  glass: 'rgba(13, 20, 32, 0.58)',
  glassLine: 'rgba(238, 243, 244, 0.1)',
  glassCard: 'rgba(13, 20, 32, 0.7)',

  heroFrom: '#0f2a28',
  heroTo: '#080d16',

  // Teal, mint and sky — the free signals, at void luminance. Peach is left
  // out here: at this darkness it reads as the amber that means unverified.
  auroraA: '#0a4a32',
  auroraB: '#0e4a3c',
  auroraC: '#17405e',
  auroraOpacity: '0.6',

  paper: '#ffffff',
  paperInk: '#14201f',
  colorScheme: 'dark',
};

/**
 * High contrast, and deliberately built on WHITE rather than as a darker
 * light mode: the case it serves is direct sunlight on a phone, where the
 * screen's own black point is the limit and the only lever left is ink.
 *
 * Not a nama register. nama has two, and this is an accessibility mode that
 * overrides both -- which is why it is the one place the family's accent is
 * allowed to be driven past its published luminance.
 */
const CONTRAST: ThemeTokens = {
  bg: '#ffffff',
  /*
    FLAT, on purpose, and the one mode that takes none of this.

    Layering, translucency and gradients all work by making surfaces differ by
    a little. This mode exists for a phone in direct sunlight and for a doctor
    who is sixty, where "a little" is nothing at all -- so the shell is the
    page is the card, every boundary is a hard 3:1 line, and the glass and the
    aurora below resolve to flat white.
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

  // nama's clinical teal, driven darker: at 12.2:1 on white this mode needs no
  // second step for the accent, only a deeper one for text on the wash.
  accent: '#0a5c37',
  accentInk: '#073f26',
  accentWash: '#e3f2ea',
  onAccent: '#ffffff',

  danger: '#8e0f17',
  dangerInk: '#6d0b11',
  dangerWash: '#fbeceb',
  onDanger: '#ffffff',

  caution: '#6d4a1b',
  cautionInk: '#4a3011',
  cautionWash: '#f6eddf',

  patientTint: '#f6f8f8',
  sheet: '#e1e7e8',

  focus: '#0a5c37',
  scrim: 'rgba(0, 0, 0, 0.5)',
  shadow1: '0 0 0 1px #31403c',
  shadow2: '0 0 0 1px #31403c',

  glass: '#ffffff',
  glassLine: '#31403c',
  glassCard: '#ffffff',

  heroFrom: '#ffffff',
  heroTo: '#ffffff',

  // Off. Not dimmed, not subtle — off. Every stop is the page colour and the
  // opacity is zero, so there is no composite to reason about at all.
  auroraA: '#ffffff',
  auroraB: '#ffffff',
  auroraC: '#ffffff',
  auroraOpacity: '0',

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
  /*
    nama's four durations and its one curve.
    
    The family's note on the curve is the interesting part: all three original
    repos had independently converged on `cubic-bezier(.2, .8, .2, 1)`, which
    is what made it the signature rather than a choice. It arrives early and
    decelerates long, so it reads as weight. This file had `(0.2, 0, 0.2, 1)`
    -- the same endpoints, no overshoot of the midpoint, and therefore the
    mechanical feel the system explicitly rules out for position.
  */
  fast: '160ms',
  base: '260ms',
  slow: '440ms',
  cine: '900ms',
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
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
export const RADII = { r: '14px', rSm: '8px', rLg: '22px', rPill: '999px' } as const;

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
  ['glassCard', '--glass-card'],
  ['heroFrom', '--hero-from'],
  ['heroTo', '--hero-to'],
  ['auroraA', '--aurora-a'],
  ['auroraB', '--aurora-b'],
  ['auroraC', '--aurora-c'],
  ['auroraOpacity', '--aurora-opacity'],
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
  out.push(`  --r-lg: ${RADII.rLg};`);
  out.push(`  --r-pill: ${RADII.rPill};`);
  out.push(`  --motion-fast: ${MOTION.fast};`);
  out.push(`  --motion-base: ${MOTION.base};`);
  out.push(`  --motion-slow: ${MOTION.slow};`);
  out.push(`  --motion-cine: ${MOTION.cine};`);
  out.push(`  --ease: ${MOTION.ease};`);
  out.push(`  --ease-out: ${MOTION.easeOut};`);
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
