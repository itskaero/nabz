/**
 * Serialise a shipped pack (paediatrics, medicine, ...) to a `.nabzpack.json`
 * file, without opening the app: `npm run pack:export -- <packId> [outputPath]`.
 *
 * Same trick as `artifact.mjs`: rather than duplicating Vite's path-alias
 * resolution in a standalone Node script, this drives the real export code
 * through a vitest file gated by an env var. Env vars, not shell syntax --
 * `FOO=bar cmd` is a bash-ism that breaks in PowerShell, and this project is
 * developed on Windows.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const packId = process.argv[2];
if (!packId) {
  console.error('usage: npm run pack:export -- <packId> [outputPath]');
  console.error('  e.g. npm run pack:export -- medicine');
  process.exit(2);
}

const out = resolve(root, process.argv[3] ?? `artifacts/packs/nabz-pack-${packId}.json`);
console.log(`exporting "${packId}" -> ${out}`);

const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', 'tests/pack.export.test.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NABZ_PACK_EXPORT_ID: packId, NABZ_PACK_EXPORT_OUT: out },
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
