/**
 * The doctor's screen theme -- light, dark, or "follow the OS".
 *
 * WHY THIS IS NOT IN THE DOCTOR PROFILE
 * ------------------------------------
 * Same reasoning as `deviceRole.ts`, in the same place: it lives in
 * localStorage because it is a fact about THIS SCREEN, not about the doctor.
 * The profile rides inside the encrypted cross-device backup -- a theme
 * choice restored onto a different machine, in a different room, under
 * different lighting, would be wrong on arrival.
 *
 * WHAT THIS DOES NOT TOUCH
 * ------------------------
 * Print is unaffected, always. `src/render/theme.ts` (the PDF/canvas
 * palette) has no dark variant and never reads this module -- a printed page
 * has no screen to prefer a theme on. See DESIGN.md 14a.
 */

export type ColorScheme = 'light' | 'dark' | 'system';

const KEY = 'nabz.colorScheme';

/**
 * Defaults to 'system' when nobody has chosen, not null-and-a-first-run-gate
 * the way `deviceRole` does -- there is no reason to interrupt a doctor with
 * a theme picker before they have written a single script. Following the OS
 * signal until they explicitly override it in Settings is a fine default.
 */
export function colorScheme(): ColorScheme {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    // Private mode, or storage blocked. 'system' behaves the same as unset.
    return 'system';
  }
}

export function setColorScheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(KEY, scheme);
  } catch {
    /* the toggle will simply not persist across reloads */
  }
}

/** Resolves 'system' against the OS/browser signal; 'light'/'dark' pass through. */
export function resolvedColorScheme(pref: ColorScheme = colorScheme()): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    // No matchMedia (very old browser, or a non-DOM test context). Light is
    // the mandatory base register (DESIGN.md 1.2), so it is also the safe
    // fallback when the OS cannot be asked.
    return 'light';
  }
}

/**
 * Applies the resolved theme to <html>, which is what styles.css's
 * `:root[data-theme='dark']` block selects on. Call once on mount, and again
 * whenever the stored preference or the OS signal changes.
 */
export function applyColorScheme(pref: ColorScheme = colorScheme()): void {
  try {
    document.documentElement.dataset.theme = resolvedColorScheme(pref);
  } catch {
    /* no document (a non-DOM test context) -- nothing to apply */
  }
}
