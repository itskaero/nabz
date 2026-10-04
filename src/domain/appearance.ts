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

/**
 * The drifting colour field behind the app, on or off.
 *
 * A third axis rather than a theme, because it is orthogonal to both of the
 * others: a doctor can want dark AND still not want anything moving on the
 * screen while they read a dose. It is also the one setting here with a cost
 * attached — a full-screen gradient with two animated layers is work a phone
 * does continuously — so somebody on a long OPD list with a tired battery
 * should be able to switch it off without giving up dark mode to do it.
 *
 * `prefers-reduced-motion` already stops the drift on its own; this is the
 * stronger switch, and it removes the field entirely.
 */
export type Ambient = 'on' | 'off';

export interface Appearance {
  theme: ThemeChoice;
  density: Density;
  ambient: Ambient;
}

const THEME_KEY = 'nabz.theme';
const DENSITY_KEY = 'nabz.density';
const AMBIENT_KEY = 'nabz.ambient';

const THEMES: ThemeChoice[] = ['system', 'light', 'dark', 'contrast'];
const DENSITIES: Density[] = ['comfortable', 'compact'];
const AMBIENTS: Ambient[] = ['on', 'off'];

/**
 * `light` is the default, not `system`. The nama system says so, and it gives
 * the reason: Nabz "ships light by default and never auto-switches to dark,
 * because dark murders Nastaʿlīq legibility and trust."
 *
 * That overrules the argument this file used to make — that a doctor who has
 * told their phone they want dark has said it once and should not have to say
 * it again. True of most apps. Not true of this one: the Urdu line on the
 * medication row IS the product, Nastaʿlīq is a high-contrast calligraphic
 * face whose thin strokes bloom and break up as white-on-dark, and a doctor
 * who gets a dark app at 03:00 without asking for it has been handed a
 * legibility problem on the only thing a family can read.
 *
 * Dark is still here, one tap away in Settings, for whoever wants it. It is
 * the OS deciding on their behalf that is wrong.
 */
export function readAppearance(defaults: Partial<Appearance> = {}): Appearance {
  const theme = read(THEME_KEY, THEMES) ?? defaults.theme ?? 'light';
  const density = read(DENSITY_KEY, DENSITIES) ?? defaults.density ?? 'comfortable';
  const ambient = read(AMBIENT_KEY, AMBIENTS) ?? defaults.ambient ?? 'on';
  return { theme, density, ambient };
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
    if (next.ambient) localStorage.setItem(AMBIENT_KEY, next.ambient);
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
  root.setAttribute('data-ambient', appearance.ambient);

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
