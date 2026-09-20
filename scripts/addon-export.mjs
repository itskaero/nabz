/**
 * Write a shipped addon out as the file a clinic would actually install.
 *
 * An addon that only exists as a TypeScript module is not an addon -- it is a
 * hardcoded default wearing the word. This produces the artifact: a single
 * JSON file that goes in an email, onto a USB stick, or into a society's
 * download page, and that `installAddon` accepts or refuses on its own merits.
 *
 * Usage:  npm run addon:export [id]     (default: who-wasting-2023)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const id = process.argv[2] ?? 'who-wasting-2023';
const out = join(root, 'artifacts');

const bundled = await build({
  entryPoints: [join(root, 'src', 'data', 'addons', `${id}.ts`)],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
  // The addon modules import types only, but the alias has to resolve anyway.
  alias: { '@domain': join(root, 'src', 'domain') },
});
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);
const addon = Object.values(mod)[0];
if (!addon?.manifest) throw new Error(`${id}.ts does not export an addon`);

await mkdir(out, { recursive: true });
const file = join(out, `${addon.manifest.id}.nabzaddon.json`);
// Pretty-printed: somebody is going to open this in a text editor to see what
// they are about to install, and they should be able to read it.
await writeFile(file, JSON.stringify(addon, null, 2) + '\n', 'utf8');
console.log(`wrote ${file.replace(root + '/', '')}`);
console.log(`  ${addon.manifest.title} — ${addon.manifest.summary}`);
console.log(`  unsigned. A distributor signs their own copy.`);
