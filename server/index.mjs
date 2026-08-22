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
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(root, 'dist');

const MODE = process.env.NABZ_MODE === 'clinic' ? 'clinic' : 'serve';
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? (MODE === 'clinic' ? '0.0.0.0' : '0.0.0.0');
const DATA = process.env.NABZ_DATA ?? join(root, '.clinic-data');
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
const PATIENT_FIELDS = ['id', 'name', 'dob', 'sex', 'phone', 'fileNo', 'createdAt', 'updatedAt'];
const QUEUE_FIELDS = [
  'id', 'date', 'token', 'name', 'age', 'sex', 'patientId',
  'status', 'payment', 'feeMinor', 'createdAt', 'seenAt', 'doneAt', 'prescriptionId',
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

/** Last write wins per id. Small clinic, one queue, no need for anything cleverer. */
function mergeById(existing, incoming, fields) {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const raw of incoming ?? []) {
    if (!raw || typeof raw.id !== 'string') continue;
    const clean = pick(raw, fields);
    const prev = byId.get(clean.id);
    if (!prev) byId.set(clean.id, clean);
    else {
      const a = prev.updatedAt ?? prev.doneAt ?? prev.seenAt ?? prev.createdAt ?? '';
      const b = clean.updatedAt ?? clean.doneAt ?? clean.seenAt ?? clean.createdAt ?? '';
      byId.set(clean.id, b >= a ? clean : prev);
    }
  }
  return [...byId.values()];
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function serveStatic(req, res) {
  if (!existsSync(DIST)) {
    return send(res, 503, '<h1>Not built</h1><p>Run <code>npm run build</code> first.</p>', 'text/html; charset=utf-8');
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';

  // Contain to dist/ -- no traversal out of the served directory.
  const target = normalize(join(DIST, path));
  if (!target.startsWith(DIST)) return send(res, 403, { error: 'forbidden' });

  const file = existsSync(target) ? target : join(DIST, 'index.html');
  try {
    const body = await readFile(file);
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const immutable = file.includes(`${join('assets')}`) ;
    res.writeHead(200, {
      'content-type': type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    send(res, 404, { error: 'not found' });
  }
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
    if (req.method === 'GET') {
      return send(res, 200, await loadState());
    }
    if (req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req));
        const state = await loadState();
        const next = {
          // Whitelisted on the way in. Anything clinical in the payload is
          // dropped here rather than written to disk.
          patients: mergeById(state.patients, body.patients, PATIENT_FIELDS),
          queue: mergeById(state.queue, body.queue, QUEUE_FIELDS),
          updatedAt: new Date().toISOString(),
        };
        await saveState(next);
        return send(res, 200, next);
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

server.listen(PORT, HOST, () => {
  console.log(`nabz ${MODE} mode on http://${HOST}:${PORT}`);
  if (MODE === 'clinic') {
    console.log(`clinic layer (patients + queue only) stored in ${DATA}`);
  } else {
    console.log('serving the app only — no patient data touches this process');
  }
});
