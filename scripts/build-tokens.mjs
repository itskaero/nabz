/**
 * Writes `src/render/screen/tokens.css` from `src/render/theme.ts`.
 *
 * The same discipline the growth tables get, for the same reason: a value that
 * exists in two files is a value that will disagree with itself. There the
 * risk is a wrong percentile; here it is a preview that stops matching the
 * print, which is this app's other structural promise.
 *
 * `tests/theme.test.ts` re-runs the generator in memory and fails if the file
 * on disk differs, so forgetting to run this is a failing test rather than a
 * colour that is quietly wrong.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, 'src/render/screen/tokens.css');

// theme.ts is TypeScript; compile it to a data URL rather than asking node to
// parse types. esbuild is already a dependency (the .exe build uses it).
const bundled = await build({
  entryPoints: [resolve(root, 'src/render/theme.ts')],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
});
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);

writeFileSync(out, mod.tokensCss(), 'utf8');
console.log(`wrote ${out.replace(root + '/', '')}`);
