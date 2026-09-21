/**
 * The React half of `domain/appearance.ts`.
 *
 * Its whole job is to keep three things in step: the stored choice, the
 * document's attributes, and the OS's own `prefers-color-scheme` — which can
 * change while the app is open, because phones switch theme on a schedule and
 * a doctor on a ward round at dusk is exactly who that happens to.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Appearance, Density, ThemeChoice } from '@domain/appearance.ts';
import {
  applyAppearance,
  defaultDensityFor,
  readAppearance,
  writeAppearance,
} from '@domain/appearance.ts';
import { deviceRole } from '@domain/deviceRole.ts';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function prefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export interface AppearanceControl extends Appearance {
  setTheme: (theme: ThemeChoice) => void;
  setDensity: (density: Density) => void;
}

export function useAppearance(): AppearanceControl {
  const [appearance, setAppearance] = useState<Appearance>(() =>
    readAppearance({ density: defaultDensityFor(deviceRole()) }),
  );

  useEffect(() => {
    applyAppearance(document, appearance, prefersDark());
  }, [appearance]);

  // The OS can change its mind with the app open. Re-apply rather than
  // re-render: with theme === 'system' the stylesheet has already switched, and
  // only the browser-chrome colour needs catching up.
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(DARK_QUERY);
    } catch {
      return;
    }
    const onChange = () => applyAppearance(document, appearance, mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [appearance]);

  const setTheme = useCallback((theme: ThemeChoice) => {
    writeAppearance({ theme });
    setAppearance((a) => ({ ...a, theme }));
  }, []);

  const setDensity = useCallback((density: Density) => {
    writeAppearance({ density });
    setAppearance((a) => ({ ...a, density }));
  }, []);

  return { ...appearance, setTheme, setDensity };
}
