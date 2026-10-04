/**
 * The deployment config, as a test.
 *
 * Four hazards live here, and every one of them fails SILENTLY — the site
 * builds, deploys, and looks fine until somebody tries the thing that broke.
 * A comment cannot stop any of them, and `vercel.json` is strict JSON so it
 * cannot even hold a comment. So they are assertions instead.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEMES } from '@render/theme.ts';

const root = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const vercel = JSON.parse(read('vercel.json')) as {
  buildCommand?: string;
  outputDirectory?: string;
  rewrites?: unknown;
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

describe('vercel.json', () => {
  it('has NO catch-all rewrite, because one would break the sync probe', () => {
    /*
      `detectSyncMode()` fetches `/api/mode`. On a static host that 404s,
      `res.ok` is false, and the app correctly concludes "no shared queue".

      With the reflex SPA rewrite every Vite project gets, `/api/mode` returns
      index.html with status 200 — so `res.ok` is TRUE, `JSON.parse` fails on
      HTML, and clinicSync throws SyncMisconfigured: "Something other than the
      Nabz station answered at this address." An error banner, in a demo,
      caused entirely by hosting config.

      The app has no client-side router, so no rewrite is needed. If one is
      ever genuinely required, it must exclude /api/.
    */
    expect(vercel.rewrites).toBeUndefined();
  });

  it('builds with build:deploy, because the fonts are not in git', () => {
    // public/fonts/*.ttf and src/data/growth/tables/ are gitignored and
    // fetched from their publishers at build time. Plain `npm run build`
    // ships an app with no Noto Nastaliq — no Urdu on the printed sheet,
    // which is the product — and nothing anywhere says so.
    expect(vercel.buildCommand).toBe('npm run build:deploy');
    expect(vercel.outputDirectory).toBe('dist');
  });

  it('never lets the service worker be cached', () => {
    // sw.js and the manifest are unhashed. Cached, an update never lands and
    // the deploy silently serves yesterday's build. registerType is 'prompt',
    // so the worker has to be fetched fresh for the update prompt to appear
    // at all.
    const sources = (vercel.headers ?? []).filter((h) =>
      h.headers.some((x) => x.key === 'Cache-Control' && /max-age=0/.test(x.value)),
    );
    expect(sources.map((h) => h.source).sort()).toEqual(['/manifest.webmanifest', '/sw.js']);
  });
});

describe('.vercelignore', () => {
  it('does not exclude tests/, which the type-check needs', () => {
    // `npm run build` runs `tsc -b --noEmit`, and tsconfig.json includes
    // "tests". Excluding them from the upload to save a few KB breaks the
    // build with missing-file errors that read like a TypeScript problem.
    const ignore = read('.vercelignore');
    const lines = ignore
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    expect(lines).not.toContain('tests');
    expect(lines).not.toContain('tests/');

    const tsconfig = read('tsconfig.json');
    expect(tsconfig).toContain('"tests"');
  });
});

describe('the PWA manifest', () => {
  /*
    This is the drift that already happened. The botanical swap moved every
    screen to Forest Ink on Keylime Wash, but the manifest is the one place
    the palette is written out BY HAND rather than generated from theme.ts —
    so it kept the old teal, and an installed app showed a teal splash around
    a green product. Nothing failed; it just looked wrong on a phone.
  */
  const config = read('vite.config.ts');

  it('uses the same accent the app generates', () => {
    expect(config).toContain(`theme_color: '${THEMES.light.accent}'`);
    expect(read('index.html')).toContain(`content="${THEMES.light.accent}"`);
  });

  it('uses the same ground the app generates', () => {
    expect(config).toContain(`background_color: '${THEMES.light.bg}'`);
  });

  it('carries no leftover teal', () => {
    expect(config).not.toContain('#0f766e');
    expect(read('index.html')).not.toContain('#0f766e');
  });
});
