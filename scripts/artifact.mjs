/**
 * Run one of the artifact tests, which are off by default.
 *
 * They are gated behind an environment variable so `npm test` stays fast and
 * writes nothing, and this wrapper sets that variable in JavaScript rather than
 * in shell syntax -- `FOO=bar cmd` is a bash-ism that fails in PowerShell, and
 * this project is developed on Windows.
 *
 *   npm run artifact:pdf     [outputPath]
 *   npm run artifact:visual  [outputDir]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = {
  pdf: {
    env: 'NABZ_SAMPLE_PDF',
    file: 'tests/sample.pdf.test.ts',
    fallback: 'artifacts/sample.pdf',
    describe: (out) => `sample prescription -> ${out}`,
  },
  visual: {
    env: 'NABZ_VISUAL_DIR',
    file: 'tests/visual.test.ts',
    fallback: 'artifacts/visual',
    describe: (out) => `page images -> ${out}`,
  },
};

const which = process.argv[2];
const target = TARGETS[which];
if (!target) {
  console.error(`usage: node scripts/artifact.mjs <${Object.keys(TARGETS).join('|')}> [output]`);
  process.exit(2);
}

const out = resolve(root, process.argv[3] ?? target.fallback);
console.log(target.describe(out));

// Spawn vitest's own entry with this Node, rather than `npx`: since Node 20,
// spawning a .cmd shim without `shell: true` is blocked outright, and turning
// the shell on would drag shell quoting rules back into a script whose whole
// purpose is to avoid them.
const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', target.file], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, [target.env]: out },
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
