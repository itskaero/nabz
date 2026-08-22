/**
 * The Nabz server. Two modes, and the difference between them is the whole
 * privacy story.
 *
 *   MODE `serve`  (default, and what Railway runs)
 *     Serves the built PWA and NOTHING else. No storage, no endpoints, no
 *     database. It is a web host: it hands over an app, and the app keeps every
 *     record in the browser on the doctor's device. A Railway deployment holds
 *     no patient data because there is nowhere for it to go.
 *
 *   MODE `clinic`  (a clinic runs this on its own reception PC)
 *     The same static app, plus a sync endpoint for the CLINIC LAYER ONLY --
 *     patients, queue rows and fees. Prescriptions, examinations, growth series
 *     and advice are never sent, never received and never stored here. That is
 *     what keeps PRODUCT.md rule 3.1's sentence literally true: "Server stores
 *     NOTHING clinical."
 *
 * WHY NOT A CLOUD RELAY FOR THE CLINIC LAYER
 * ------------------------------------------
 * Rule 3.1 does not only forbid clinical content, it says "never patient
 * identity". A shared patient list IS patient identity. A machine standing in
 * the clinic, owned by the clinic, is a materially different claim to make to a
 * patient than a server in someone else's data centre -- so clinic mode is
 * meant for a LAN, and refuses to start on a public interface without the
 * operator saying so explicitly.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { mergeCollection, purgeTombstones, changedSince, QUEUE_CONTESTED } from './merge.mjs';

/**
 * Where this file lives -- when it lives anywhere.
 *
 * Inside the packaged executable there is no source path to resolve, so
 * `fileURLToPath` has nothing meaningful to convert. The packaged build never
 * reads from disk anyway (the app is embedded and the data sits beside the
 * .exe), so falling back to the executable's own folder is both safe and the
 * right answer.
 */
const here = (() => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return dirname(process.execPath);
  }
})();
const root = join(here, '..');
const DIST = join(root, 'dist');

/**
 * Where the built app comes from.
 *
 * Two homes, one server. Run from a checkout it reads `dist/` off disk; run as
 * the packaged clinic .exe the whole app is embedded inside the executable, so
 * a clinic copies ONE file onto the reception PC and is done. Keeping both
 * behind the same reader means there is one server implementation to reason
 * about rather than a desktop fork that quietly drifts.
 */
let sea = null;
try {
  // Synchronous on purpose: Node's single-executable format requires a
  // CommonJS entry, and CommonJS has no top-level await. `createRequire` works
  // unchanged in both the ESM source and the bundled CJS build.
  // Resolved from the executable's own path, which is always absolute and
  // valid. `import.meta.url` is not usable here: inside the packaged build it
  // is a synthetic value, and createRequire rejects it.
  const mod = createRequire(pathToFileURL(process.execPath))('node:sea');
  if (mod.isSea()) sea = mod;
} catch {
  sea = null;
}

export const PACKAGED = sea !== null;

/** Read a file from the built app. Returns null when it is not there. */
async function readAppFile(relative) {
  const key = relative;
  if (sea) {
    try {
      return Buffer.from(sea.getRawAsset(key));
    } catch {
      return null;
    }
  }
  const target = normalize(join(DIST, key));
  if (!target.startsWith(DIST) || !existsSync(target)) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

// The packaged station IS a clinic station -- that is the only reason to ship
// an executable -- and its data belongs beside the .exe where a clinic can see
// and back it up, not beside a source tree that does not exist there.
const MODE = PACKAGED || process.env.NABZ_MODE === 'clinic' ? 'clinic' : 'serve';
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA =
  process.env.NABZ_DATA ?? join(PACKAGED ? dirname(process.execPath) : root, '.clinic-data');
const ALLOW_PUBLIC = process.env.NABZ_ALLOW_PUBLIC === 'yes';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * The only shapes clinic mode will store. Anything else in the payload is
 * dropped rather than persisted -- a whitelist, so a future client bug cannot
 * start posting prescriptions to a machine that promises not to hold them.
 */
const PATIENT_FIELDS = [
  'id', 'name', 'dob', 'sex', 'phone', 'fileNo', 'createdAt', 'updatedAt', 'deletedAt',
];
const QUEUE_FIELDS = [
  'id', 'date', 'token', 'name', 'age', 'sex', 'patientId',
  'status', 'payment', 'feeMinor', 'createdAt', 'seenAt', 'doneAt', 'prescriptionId',
  'updatedAt', 'paymentAt', 'statusAt', 'deletedAt',
];

const pick = (obj, fields) => {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
};

async function loadState() {
  const file = join(DATA, 'clinic.json');
  if (!existsSync(file)) return { patients: [], queue: [], updatedAt: null };
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return { patients: [], queue: [], updatedAt: null };
  }
}

async function saveState(state) {
  await mkdir(DATA, { recursive: true });
  await writeFile(join(DATA, 'clinic.json'), JSON.stringify(state), 'utf8');
}

/**
 * The pairing code.
 *
 * Not a password and not encryption -- the LAN traffic is plain HTTP and this
 * does nothing about that. What it stops is the ordinary case: any phone on the
 * clinic wifi being able to fetch the whole patient list by guessing a URL.
 * Generated once, printed on startup, typed into each doctor's device the first
 * time it connects.
 */
async function pairingCode() {
  const file = join(DATA, 'pairing.json');
  if (existsSync(file)) {
    try {
      return JSON.parse(await readFile(file, 'utf8')).code;
    } catch {
      /* regenerate below */
    }
  }
  const code = String(randomInt(100000, 1000000));
  await mkdir(DATA, { recursive: true });
  await writeFile(file, JSON.stringify({ code, createdAt: new Date().toISOString() }), 'utf8');
  return code;
}

let PAIRING = null;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function serveStatic(req, res) {
  if (!PACKAGED && !existsSync(DIST)) {
    return send(res, 503, '<h1>Not built</h1><p>Run <code>npm run build</code> first.</p>', 'text/html; charset=utf-8');
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  // No traversal out of the app, whether it lives on disk or inside the binary.
  if (path.includes('..')) return send(res, 403, { error: 'forbidden' });

  const relative = path.replace(/^\/+/, '');
  // Fall back to index.html so the PWA's own routing works on a deep link.
  const body = (await readAppFile(relative)) ?? (await readAppFile('index.html'));
  if (!body) return send(res, 404, { error: 'not found' });

  const type = TYPES[extname(relative)] ?? TYPES['.html'];
  res.writeHead(200, {
    'content-type': relative.startsWith('assets/') ? type : (TYPES[extname(relative)] ?? TYPES['.html']),
    'cache-control': relative.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  res.end(body);
}

function readBody(req, limitBytes = 4_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/healthz') {
    return send(res, 200, { ok: true, mode: MODE });
  }

  // Tells the client whether a queue can be shared from this origin at all.
  if (url.pathname === '/api/mode') {
    return send(res, 200, { mode: MODE, sync: MODE === 'clinic' });
  }

  if (url.pathname === '/api/clinic') {
    if (MODE !== 'clinic') {
      return send(res, 404, {
        error: 'this server serves the app only and stores nothing',
      });
    }

    // Nothing about the queue is readable without the code the station printed.
    if (req.headers['x-nabz-pairing'] !== PAIRING) {
      return send(res, 401, {
        error: 'pair this device first — the code is shown on the clinic station',
      });
    }

    // `since` makes a sync carry the day's changes rather than the whole
    // history, which matters once a clinic has thousands of past visits.
    const since = url.searchParams.get('since') ?? '';
    const shape = (state) => ({
      patients: changedSince(state.patients, since),
      queue: changedSince(state.queue, since),
      updatedAt: state.updatedAt,
      serverTime: new Date().toISOString(),
    });

    if (req.method === 'GET') {
      return send(res, 200, shape(await loadState()));
    }
    if (req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req));
        const state = await loadState();
        const pickPatient = (r) => pick(r, PATIENT_FIELDS);
        const pickQueue = (r) => pick(r, QUEUE_FIELDS);
        const next = {
          // Whitelisted on the way in. Anything clinical in the payload is
          // dropped here rather than written to disk.
          patients: purgeTombstones(mergeCollection(state.patients, body.patients, pickPatient)),
          queue: purgeTombstones(
            mergeCollection(state.queue, body.queue, pickQueue, QUEUE_CONTESTED),
          ),
          updatedAt: new Date().toISOString(),
        };
        await saveState(next);
        return send(res, 200, shape(next));
      } catch (err) {
        return send(res, 400, { error: err instanceof Error ? err.message : 'bad request' });
      }
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, { error: 'method not allowed' });
  }
  return serveStatic(req, res);
});

if (MODE === 'clinic' && HOST === '0.0.0.0' && !ALLOW_PUBLIC && process.env.RAILWAY_ENVIRONMENT) {
  console.error(
    'Refusing to run clinic mode on a public host.\n' +
      'The clinic layer holds patient identity, which PRODUCT.md rule 3.1 keeps off\n' +
      'servers we operate. Run it on the clinic LAN, or set NABZ_ALLOW_PUBLIC=yes if\n' +
      'you have decided otherwise and told your patients.',
  );
  process.exit(1);
}

// Resolved with `.then` rather than top-level await: Node's single-executable
// format needs a CommonJS entry, and CommonJS has no top-level await.
const ready = MODE === 'clinic' ? pairingCode().then((code) => { PAIRING = code; }) : Promise.resolve();

ready.then(() => server.listen(PORT, HOST, () => {
  if (PACKAGED) return announceStation();
  console.log(`nabz ${MODE} mode on http://${HOST}:${PORT}`);
  if (MODE === 'clinic') {
    console.log(`clinic layer (patients + queue only) stored in ${DATA}`);
    console.log(`pairing code: ${PAIRING}`);
  } else {
    console.log('serving the app only - no patient data touches this process');
  }
}));

/**
 * What the .exe prints when someone double-clicks it.
 *
 * Written for a receptionist, not an operator: the LAN address a tablet should
 * open, and a plain statement of what this machine does and does not hold.
 * Printed on `listen` rather than before it, so an address only appears once it
 * genuinely works.
 */
function announceStation() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);

  console.log('');
  console.log('  Nabz - clinic station');
  console.log('  ---------------------');
  console.log('');
  console.log('  On this computer:      http://localhost:' + PORT);
  for (const address of addresses) {
    console.log('  From a tablet/phone:   http://' + address + ':' + PORT);
  }
  console.log('');
  console.log('  This machine holds the queue: names, ages, tokens, payment.');
  console.log('  It does NOT hold prescriptions, examinations or growth records');
  console.log("  - those stay on the doctor's own device.");
  console.log('');
  console.log('  Pairing code for a new device:  ' + PAIRING);
  console.log('');
  console.log('  Queue data: ' + DATA);
  console.log('  Close this window to stop.');
  console.log('');

  // Cosmetic: the address is printed above, so a failure here costs nothing.
  try {
    const url = `http://localhost:${PORT}`;
    const [cmd, args] =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin'
          ? ['open', [url]]
          : ['xdg-open', [url]];
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* printed address is enough */
  }
}
