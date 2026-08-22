/**
 * Bidi isolation helpers.
 *
 * THIS FILE IS A SAFETY FILE, NOT A FORMATTING FILE.
 *
 * An Urdu instruction line contains Latin/numeric tokens: a drug name, "250mg",
 * "7.5 ml". Left un-isolated, the Unicode bidi algorithm reorders those tokens
 * against the surrounding RTL run and the dose can land next to the wrong word,
 * or a trailing unit can jump to the other end of the number. A misplaced dose
 * is a dosing error. See PRODUCT.md 7 and DESIGN.md 6.
 *
 * Every LTR token that ends up inside an RTL line goes through `isolateLtr`.
 *
 * The control characters are written as escapes on purpose: they are invisible,
 * and an invisible literal in source is a bug nobody can see in review.
 */

/** U+2066 LEFT-TO-RIGHT ISOLATE */
export const LRI = '\u2066';
/** U+2067 RIGHT-TO-LEFT ISOLATE */
export const RLI = '\u2067';
/** U+2068 FIRST STRONG ISOLATE */
export const FSI = '\u2068';
/** U+2069 POP DIRECTIONAL ISOLATE */
export const PDI = '\u2069';

const ISOLATE_CHARS = /[\u2066-\u2069]/g;

/**
 * Strong RTL: Hebrew, Arabic (incl. Urdu), Syriac, Thaana, NKo, Arabic Extended-A,
 * and the Arabic presentation-form blocks.
 * Arabic-Indic DIGITS are deliberately absent -- they are weak, not strong RTL.
 */
const RTL_STRONG =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0860-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** Strong LTR: Latin letter blocks (basic, Latin-1/Extended, Latin Extended Additional). */
const LTR_STRONG = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

export function containsRtl(text: string): boolean {
  return RTL_STRONG.test(text);
}

export function containsLtr(text: string): boolean {
  return LTR_STRONG.test(text);
}

/**
 * True when `text` has no strong direction of its own -- a bare number, a unit
 * symbol, punctuation. These are the tokens most likely to be dragged around by
 * a neighbouring run, so they get isolated too.
 */
export function isDirectionallyNeutral(text: string): boolean {
  return !containsRtl(text) && !containsLtr(text);
}

/** Wrap an LTR token so surrounding RTL text cannot reorder its insides. */
export function isolateLtr(text: string): string {
  return LRI + text + PDI;
}

/** Wrap an RTL token so surrounding LTR text cannot reorder its insides. */
export function isolateRtl(text: string): string {
  return RLI + text + PDI;
}

/** Isolate by the token's own first strong character; safe for mixed tokens. */
export function isolateAuto(text: string): string {
  return FSI + text + PDI;
}

/**
 * Isolate `token` for embedding inside a line rendered in `hostDirection`.
 * Returns the token untouched when isolation would be pure noise (same
 * direction, nothing neutral to protect).
 */
export function isolateForHost(token: string, hostDirection: 'ltr' | 'rtl'): string {
  if (token.length === 0) return token;
  if (hostDirection === 'rtl') {
    // Latin drug names and bare doses both need protecting inside Urdu.
    return containsLtr(token) || isDirectionallyNeutral(token) ? isolateLtr(token) : token;
  }
  return containsRtl(token) ? isolateRtl(token) : token;
}

/** Remove isolate controls. For assertions and for plain-text export. */
export function stripIsolates(text: string): string {
  return text.replace(ISOLATE_CHARS, '');
}

/** True if every isolate opened in `text` is popped, and none pops early. */
export function isolatesBalanced(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === LRI || ch === RLI || ch === FSI) depth += 1;
    else if (ch === PDI) {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}
