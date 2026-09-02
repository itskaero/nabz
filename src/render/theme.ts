/**
 * The palette from DESIGN.md 2-3, in one place, for the CSS and the printed
 * document alike.
 *
 * Colour discipline (DESIGN.md 3): exactly three roles get colour.
 *   teal    = interactive actions AND "vetted / approved / safe"
 *   amber   = "the doctor's own words, not vetted" (advice tier 3)
 *   red     = danger only -- allergy, red-flag advice
 * Everything else is neutral ink. Because red is never decorative, the eye
 * learns that red means danger.
 *
 * On paper, colour is a REINFORCEMENT and never the signal: a cheap mono laser
 * renders all of this as grey. Every safety state also carries a border and a
 * word (DESIGN.md 8, PRODUCT.md 10).
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

export const palette = {
  bg: '#eef1f2',
  surface: '#ffffff',
  ink: '#14201f',
  inkSoft: '#55635f',
  inkFaint: '#8a9691',
  line: '#dfe4e3',
  lineSoft: '#eceeed',

  teal: '#0f8055',
  tealInk: '#0b6b3f',
  tealWash: '#e3f2ea',

  alert: '#b4232a',
  alertWash: '#fbeceb',

  unvetted: '#a8722a',
  warnWash: '#f6eddf',

  /**
   * DESIGN.md 7: NOT the cream-paper cliche. The patient block is a faint
   * in-palette teal tint so the jump from workspace to document is a gradient
   * within one family rather than a change of app.
   *
   * This palette is the printed artifact's ONLY palette (DESIGN.md 14a) --
   * there is no dark variant here, ever. A printed page has no screen theme;
   * src/render/screen/styles.css's [data-theme='dark'] block has no
   * counterpart in this file by design.
   */
  patientTint: '#f1f8f4',
  sheet: '#f5f9f7',
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
