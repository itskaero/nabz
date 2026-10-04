/**
 * Appearance: two axes, four words each, and no preview swatch.
 *
 * The swatch is deliberately absent. The app IS the preview — every choice
 * here takes effect on the surface the doctor is looking at while they choose,
 * which is both more honest than a thumbnail and one less thing to keep in
 * step with the palette.
 *
 * Kept per-device, not in the profile (`domain/appearance.ts` says why): one
 * doctor with a tablet in the room and a desktop in the office genuinely wants
 * two different answers, and the reception station wants a third.
 */
import type { AppearanceControl } from '../useAppearance.ts';
import type { Ambient, Density, ThemeChoice } from '@domain/appearance.ts';

const THEMES: Array<{ id: ThemeChoice; title: string; note: string }> = [
  {
    id: 'system',
    title: 'Match this device',
    note: 'Follows the phone or computer, including when it switches at dusk.',
  },
  { id: 'light', title: 'Light', note: 'The clinical default. Near-white, quiet.' },
  {
    id: 'dark',
    title: 'Dark',
    note: 'For a ward round at night. The printed preview stays on white paper.',
  },
  {
    id: 'contrast',
    title: 'High contrast',
    note: 'Heavier ink and stronger borders, for direct sunlight or tired eyes.',
  },
];

const DENSITIES: Array<{ id: Density; title: string; note: string }> = [
  {
    id: 'comfortable',
    title: 'Comfortable',
    note: 'Bigger targets. For a phone or tablet used one-handed during a consultation.',
  },
  {
    id: 'compact',
    title: 'Compact',
    note: 'More rows on screen. For a desk with a mouse — a front desk scanning a queue.',
  },
];

const AMBIENTS: Array<{ id: Ambient; title: string; note: string }> = [
  {
    id: 'on',
    title: 'Ambient colour',
    note: 'A slow drift of green, gold and amber light behind the app. Nothing on it is clickable.',
  },
  {
    id: 'off',
    title: 'Plain background',
    note: 'No gradient, nothing moving. Costs a phone less on a long list.',
  },
];

export function AppearanceSection({ appearance }: { appearance: AppearanceControl }) {
  return (
    <section className="card settings-section">
      <h3>Appearance on this device</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Kept on this machine only — it is not part of your backup, so the
        tablet in the room and the computer at the desk can differ.
      </p>

      <div className="mode-list" style={{ marginTop: 10 }}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            className="mode"
            aria-pressed={appearance.theme === t.id}
            onClick={() => appearance.setTheme(t.id)}
          >
            <span>
              {t.title}
              <small>{t.note}</small>
            </span>
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: 16 }}>Spacing</h3>
      <div className="mode-list">
        {DENSITIES.map((d) => (
          <button
            key={d.id}
            className="mode"
            aria-pressed={appearance.density === d.id}
            onClick={() => appearance.setDensity(d.id)}
          >
            <span>
              {d.title}
              <small>{d.note}</small>
            </span>
          </button>
        ))}
      </div>

      {/*
        Hidden under High contrast rather than shown disabled.

        That mode turns the field off by making every one of its stops the
        page colour, so the switch would control nothing. A greyed-out control
        with no explanation is the thing this codebase keeps saying it does
        not want; a control that is simply not offered because the mode it
        belongs to is not running is honest.
      */}
      {appearance.theme !== 'contrast' && (
        <>
          <h3 style={{ marginTop: 16 }}>Background</h3>
          <div className="mode-list">
            {AMBIENTS.map((a) => (
              <button
                key={a.id}
                className="mode"
                aria-pressed={appearance.ambient === a.id}
                onClick={() => appearance.setAmbient(a.id)}
              >
                <span>
                  {a.title}
                  <small>{a.note}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
