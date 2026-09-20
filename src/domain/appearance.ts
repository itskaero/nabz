/**
 * How this machine looks, and why it is not in the doctor profile.
 *
 * Same reasoning as `deviceRole.ts`: appearance is a fact about a DEVICE, not
 * about a doctor. The profile travels inside the encrypted backup, so a theme
 * stored there would mean restoring a backup onto the reception PC also
 * re-themes it — and worse, the density axis exists precisely because the
 * reception desk and the doctor's phone want different answers. One doctor,
 * two machines, two settings, and no sync: that is the correct behaviour here,
 * not a limitation.
 *
 * Framework-free on purpose (CLAUDE.md 6d's discipline, applied to a smaller
 * thing): `render/screen/useAppearance.ts` is the React half.
 */
import type { Density, ThemeChoice, ThemeMode } from '@render/theme.ts';
import { resolveMode } from '@render/theme.ts';

export type { Density, ThemeChoice, ThemeMode };

export interface Appearance {
  theme: ThemeChoice;
  density: Density;
}

const THEME_KEY = 'nabz.theme';
const DENSITY_KEY = 'nabz.density';

const THEMES: ThemeChoice[] = ['system', 'light', 'dark', 'contrast'];
const DENSITIES: Density[] = ['comfortable', 'compact'];

/**
 * `system` is the default, not `light`.
 *
 * A doctor who has already told their phone they want dark mode has said the
 * thing once; asking them to say it again in every app is how an app ends up
 * being the one white rectangle in a dark room at 3am.
 */
export function readAppearance(defaults: Partial<Appearance> = {}): Appearance {
  const theme = read(THEME_KEY, THEMES) ?? defaults.theme ?? 'system';
  const density = read(DENSITY_KEY, DENSITIES) ?? defaults.density ?? 'comfortable';
  return { theme, density };
}

function read<T extends string>(key: string, allowed: T[]): T | null {
  try {
    const raw = localStorage.getItem(key);
    return allowed.includes(raw as T) ? (raw as T) : null;
  } catch {
    // Private mode, or storage blocked. Falling back to the default is safe
    // here in a way it is not for deviceRole: the worst case is the wrong
    // colours, not the wrong data on the wrong machine.
    return null;
  }
}

export function writeAppearance(next: Partial<Appearance>): void {
  try {
    if (next.theme) localStorage.setItem(THEME_KEY, next.theme);
    if (next.density) localStorage.setItem(DENSITY_KEY, next.density);
  } catch {
    /* the setting simply does not survive a reload */
  }
}

/**
 * The density a device should start at, before anyone chooses.
 *
 * A reception station is a desk with a mouse and twenty rows to scan; a
 * doctor's tablet is one-handed at OPD speed. Guessing from the device role is
 * better than guessing from the screen width, because a receptionist on a
 * laptop and a doctor on a laptop want different things from the same pixels.
 */
export function defaultDensityFor(role: 'consulting' | 'reception' | null): Density {
  return role === 'reception' ? 'compact' : 'comfortable';
}

/**
 * Apply an appearance to a document. Idempotent, and the ONLY place that
 * touches the DOM for theming.
 *
 * `data-theme` is left OFF for `system` rather than being set to the resolved
 * mode: the generated stylesheet keys its `prefers-color-scheme` rule on
 * `:root:not([data-theme])`, so an absent attribute is what lets the OS win,
 * and a present one is what lets an explicit choice beat it. Writing the
 * resolved value would freeze the app at whatever the OS said on load.
 */
export function applyAppearance(
  doc: Document,
  appearance: Appearance,
  prefersDark: boolean,
): ThemeMode {
  const root = doc.documentElement;
  if (appearance.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', appearance.theme);
  root.setAttribute('data-density', appearance.density);

  const mode = resolveMode(appearance.theme, prefersDark);
  syncThemeColor(doc, mode);
  return mode;
}

/**
 * The browser chrome around the app -- the Android status bar, the iOS
 * standalone title area. A fixed teal `theme-color` in the HTML meant a dark
 * phone got a bright teal bar above a dark app.
 */
function syncThemeColor(doc: Document, mode: ThemeMode): void {
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  // Read the resolved token rather than importing the palette again: whatever
  // the stylesheet decided IS the answer, including when the OS decided it.
  const bg = doc.defaultView
    ?.getComputedStyle(doc.documentElement)
    .getPropertyValue('--surface')
    .trim();
  if (bg) meta.setAttribute('content', bg);
  else meta.setAttribute('content', mode === 'dark' ? '#141e1d' : '#0f766e');
}
