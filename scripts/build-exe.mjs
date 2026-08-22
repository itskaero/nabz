/**
 * Build the clinic station as a single Windows executable.
 *
 * WHY A SINGLE FILE
 * -----------------
 * The person installing this is a receptionist or a doctor, not an
 * administrator. "Copy this one file onto the reception PC and double-click it"
 * is an instruction that survives contact with a real clinic; "install Node,
 * clone a repo, run npm ci" is not. So the whole built app -- HTML, JS, the
 * HarfBuzz WASM, the Nastaliq font -- is embedded inside the binary as Node SEA
 * assets, and the .exe is self-contained.
 *
 * WHAT IT IS NOT
 * --------------
 * Not Electron. There is no bundled browser: the machine's own browser opens
 * the app. That keeps the download to the Node runtime rather than the Node
 * runtime plus Chromium, and means the PWA behaves exactly as it does anywhere
 * else -- same service worker, same IndexedDB, same install prompt.
 *
 * Usage:  npm run build:exe
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative as rel } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(root, 'dist');
const WORK = join(root, '.exe-build');
const OUT = join(root, 'release');
const EXE_NAME = 'nabz-clinic.exe';

const run = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false, ...opts });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${res.status}`);
  }
};

async function walk(dir, base = dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(rel(base, full).split('\\').join('/'));
  }
  return out;
}

async function main() {
  if (process.platform !== 'win32') {
    console.warn(
      'Building a .exe on a non-Windows host produces a binary for THIS platform.\n' +
        'Run this on Windows for a Windows executable.',
    );
  }

  if (!existsSync(DIST)) {
    throw new Error('dist/ is missing — run `npm run build` first.');
  }

  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  await mkdir(OUT, { recursive: true });

  // 1. Bundle the server to a single CommonJS file. SEA takes one entry point,
  //    and the server only imports node: builtins, so this is a flat bundle.
  console.log('bundling the server…');
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [join(root, 'server', 'index.mjs')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: join(WORK, 'clinic.cjs'),
    external: ['node:sea'],
    banner: {
      // esbuild's CJS output has no import.meta; the server only uses it to find
      // dist/ on disk, which the packaged build never does.
      js: 'const import_meta = { url: "file:///packaged" };',
    },
    define: { 'import.meta.url': 'import_meta.url' },
    logLevel: 'warning',
  });

  // 2. Every file of the built app becomes an embedded asset, keyed by the path
  //    the browser will ask for.
  const files = await walk(DIST);
  const assets = {};
  for (const file of files) assets[file] = join(DIST, file);
  console.log(`embedding ${files.length} app files…`);

  const seaConfig = join(WORK, 'sea-config.json');
  await writeFile(
    seaConfig,
    JSON.stringify(
      {
        main: join(WORK, 'clinic.cjs'),
        output: join(WORK, 'sea-prep.blob'),
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: false,
        assets,
      },
      null,
      2,
    ),
    'utf8',
  );

  // 3. Generate the blob, copy the node binary, inject.
  console.log('generating the SEA blob…');
  run(process.execPath, ['--experimental-sea-config', seaConfig]);

  const exePath = join(OUT, EXE_NAME);
  await cp(process.execPath, exePath);
  console.log('injecting…');
  run(process.execPath, [
    join(root, 'node_modules', 'postject', 'dist', 'cli.js'),
    exePath,
    'NODE_SEA_BLOB',
    join(WORK, 'sea-prep.blob'),
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ]);

  await writeFile(join(OUT, 'README.txt'), READ_ME, 'utf8');
  await rm(WORK, { recursive: true, force: true });

  const size = (await stat(exePath)).size;
  console.log('');
  console.log(`  ${rel(root, exePath)}  ${(size / 1024 / 1024).toFixed(0)} MB`);
  console.log('  Self-contained: the app is inside the binary. Copy it and run it.');
}

const READ_ME = `Nabz - clinic station
=====================

Double-click nabz-clinic.exe. It prints two addresses:

  http://localhost:8080          this computer
  http://<this-pc-ip>:8080       any tablet or phone on the same wi-fi

WHAT THIS MACHINE HOLDS
  The queue: names, ages, tokens, and whether each person has paid.

WHAT IT DOES NOT HOLD
  Prescriptions, examinations, growth records. Those stay on the doctor's own
  device and are never sent here. The server refuses to store them even if
  something asks it to.

The queue is written to a folder called .clinic-data next to this file. Back it
up like any other clinic record. Closing the window stops the server; anyone
mid-consultation keeps working, because the prescription itself lives in their
own browser.

To use a different port:  set PORT=9000 before running.
`;

main().catch((err) => {
  console.error('\nbuild:exe failed:', err.message);
  process.exit(1);
});
