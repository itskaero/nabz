/**
 * @vitest-environment jsdom
 *
 * The doctor's screen theme -- light, dark, or "follow the OS" -- mirrors
 * device-role.test.ts's own reasoning almost exactly: this is a per-device
 * localStorage fact, and without a real Storage (tests/setup.ts installs
 * one) every write would be silently swallowed and these tests would pass
 * while asserting nothing.
 *
 * jsdom does not implement window.matchMedia, so 'system' resolution is
 * tested against an explicit stub rather than a real OS signal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyColorScheme,
  colorScheme,
  resolvedColorScheme,
  setColorScheme,
} from '@domain/colorScheme.ts';

function stubMatchMedia(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: dark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

beforeEach(() => {
  localStorage.removeItem('nabz.colorScheme');
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  localStorage.removeItem('nabz.colorScheme');
  delete document.documentElement.dataset.theme;
});

describe('choosing', () => {
  it('defaults to system when nobody has chosen', () => {
    // Unlike deviceRole(), which returns null and gates a first-run picker,
    // this defaults to 'system' -- there is no reason to interrupt a doctor
    // with a theme picker before they have written a single script.
    expect(colorScheme()).toBe('system');
  });

  it('remembers an explicit choice', () => {
    setColorScheme('dark');
    expect(colorScheme()).toBe('dark');
    setColorScheme('light');
    expect(colorScheme()).toBe('light');
  });

  it('ignores a value it did not write', () => {
    localStorage.setItem('nabz.colorScheme', 'solarized');
    expect(colorScheme()).toBe('system');
  });
});

describe('resolving system', () => {
  it("'light' and 'dark' pass through regardless of the OS signal", () => {
    stubMatchMedia(true);
    expect(resolvedColorScheme('light')).toBe('light');
    expect(resolvedColorScheme('dark')).toBe('dark');
  });

  it("'system' follows a dark OS signal", () => {
    stubMatchMedia(true);
    expect(resolvedColorScheme('system')).toBe('dark');
  });

  it("'system' follows a light OS signal", () => {
    stubMatchMedia(false);
    expect(resolvedColorScheme('system')).toBe('light');
  });

  it('falls back to light -- the mandatory base register -- when matchMedia is unavailable', () => {
    const original = window.matchMedia;
    // @ts-expect-error -- deliberately simulating an environment without it
    delete window.matchMedia;
    expect(resolvedColorScheme('system')).toBe('light');
    window.matchMedia = original;
  });
});

describe('applying', () => {
  it('sets data-theme on <html> for each resolved value', () => {
    stubMatchMedia(false);
    applyColorScheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyColorScheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it("resolves 'system' before applying", () => {
    stubMatchMedia(true);
    applyColorScheme('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
