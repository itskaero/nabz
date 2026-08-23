/**
 * The server boundary, tested against a real running process.
 *
 * This is the test that makes a two-station clinic defensible. The client is
 * supposed to send only the clinic layer — but a client bug must not be able to
 * write a prescription onto a shared machine, so the server whitelists fields
 * independently. Here we deliberately POST clinical content and assert it is
 * not stored.
 *
 * Also asserts what a Railway deployment is: `serve` mode has no data endpoint
 * at all, so a hosted instance holds nothing.
 *
 * And it asserts the pairing code, which is what stopped this endpoint being
 * readable by every phone on the clinic wifi.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
let child: ChildProcess;
let dataDir: string;
let code: string;

/** POST the clinic layer as a properly paired device would. */
const sync = (body: unknown, query = '') =>
  fetch(`${BASE}/api/clinic${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nabz-pairing': code },
    body: JSON.stringify(body),
  });

const waitForServer = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
};

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'nabz-clinic-'));
  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NABZ_MODE: 'clinic',
      // These tests are about the clinic-layer boundary, not TLS. With HTTPS on
      // the plain port serves only the certificate setup page, so the API would
      // be unreachable here -- which is itself asserted, separately, below.
      NABZ_NO_TLS: 'yes',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NABZ_DATA: dataDir,
    },
    stdio: 'ignore',
  });
  await waitForServer();
  code = JSON.parse(await readFile(join(dataDir, 'pairing.json'), 'utf8')).code;
}, 30000);

afterAll(async () => {
  child?.kill();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

describe('clinic mode', () => {
  it('reports its mode so the client knows whether a queue can be shared', async () => {
    const body = await (await fetch(`${BASE}/api/mode`)).json();
    expect(body).toEqual({ mode: 'clinic', sync: true });
  });

  it('round-trips patients and queue rows', async () => {
    const res = await sync({
        patients: [{ id: 'p1', name: 'Ayesha Khan', sex: 'F', createdAt: '2026-08-22T09:00:00Z' }],
        queue: [
          {
            id: 'q1',
            date: '2026-08-22',
            token: 1,
            name: 'Ayesha Khan',
            status: 'waiting',
            payment: 'unpaid',
            feeMinor: 150000,
            createdAt: '2026-08-22T09:00:00Z',
            updatedAt: '2026-08-22T09:00:00Z',
          },
        ],
    });
    const merged = await res.json();
    expect(merged.patients).toHaveLength(1);
    expect(merged.queue[0].feeMinor).toBe(150000);
  });

  it('DROPS clinical content rather than storing it', async () => {
    await sync({
        patients: [
          {
            id: 'p2',
            name: 'Bilal Ahmed',
            // Everything below is clinical and must not survive the wire.
            diagnosis: ['Community-acquired pneumonia'],
            medications: [{ drug: { brand: 'Amoxil' } }],
            allergies: 'Penicillin',
          },
        ],
        queue: [
          {
            id: 'q2',
            date: '2026-08-22',
            token: 2,
            name: 'Bilal Ahmed',
            status: 'waiting',
            payment: 'unpaid',
            createdAt: '2026-08-22T09:05:00Z',
            updatedAt: '2026-08-22T09:05:00Z',
            problems: ['Fever'],
            advice: [{ kind: 3, text: 'rest' }],
          },
        ],
    });

    const onDisk = JSON.parse(await readFile(join(dataDir, 'clinic.json'), 'utf8'));
    const serialised = JSON.stringify(onDisk);

    for (const leaked of ['pneumonia', 'Amoxil', 'Penicillin', 'Fever', 'rest']) {
      expect(serialised).not.toContain(leaked);
    }
    const patient = onDisk.patients.find((p: { id: string }) => p.id === 'p2');
    expect(Object.keys(patient).sort()).toEqual(['id', 'name']);
    const entry = onDisk.queue.find((q: { id: string }) => q.id === 'q2');
    expect(Object.keys(entry)).not.toContain('problems');
    expect(Object.keys(entry)).not.toContain('advice');
  });

  it('rejects a payload that is not JSON', async () => {
    const res = await fetch(`${BASE}/api/clinic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nabz-pairing': code },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('refuses a path traversal out of the served directory', async () => {
    const res = await fetch(`${BASE}/../package.json`);
    // Either blocked outright, or normalised back into the SPA. Never the file.
    const text = await res.text();
    expect(text).not.toContain('"devDependencies"');
  });
});

/**
 * The four defects a live probe of the first sync implementation demonstrated.
 * Each of these failed before the merge was written; they are here so the
 * failures cannot come back quietly.
 */
describe('two stations disagreeing', () => {
  it('will not hand the queue to a device that has not been paired', async () => {
    const anonymous = await fetch(`${BASE}/api/clinic`);
    expect(anonymous.status).toBe(401);

    const guessed = await fetch(`${BASE}/api/clinic`, {
      headers: { 'x-nabz-pairing': '000000' },
    });
    expect(guessed.status).toBe(401);

    const paired = await fetch(`${BASE}/api/clinic`, {
      headers: { 'x-nabz-pairing': code },
    });
    expect(paired.status).toBe(200);
  });

  it('keeps the payment AND the status when reception and the doctor collide', async () => {
    // 09:00 reception queues Ayesha, unpaid.
    const base = {
      id: 'race1',
      date: '2026-08-22',
      token: 9,
      name: 'Ayesha Khan',
      status: 'waiting',
      payment: 'unpaid',
      feeMinor: 150000,
      createdAt: '2026-08-22T09:00:00.000Z',
      updatedAt: '2026-08-22T09:00:00.000Z',
    };
    await sync({ patients: [], queue: [base] });

    // 09:02 reception takes the money.
    await sync({
      patients: [],
      queue: [
        {
          ...base,
          payment: 'paid',
          paymentAt: '2026-08-22T09:02:00.000Z',
          updatedAt: '2026-08-22T09:02:00.000Z',
        },
      ],
    });

    // 09:05 the doctor -- whose tablet synced BEFORE the payment, so still
    // holds `unpaid` -- marks her done and syncs.
    const after = await (
      await sync({
        patients: [],
        queue: [
          {
            ...base,
            status: 'done',
            doneAt: '2026-08-22T09:05:00.000Z',
            statusAt: '2026-08-22T09:05:00.000Z',
            updatedAt: '2026-08-22T09:05:00.000Z',
          },
        ],
      })
    ).json();

    const row = after.queue.find((q: { id: string }) => q.id === 'race1');
    // Reception owns the money, the doctor owns the room, and the day's
    // takings must not silently disagree with the cash drawer.
    expect(row.payment).toBe('paid');
    expect(row.status).toBe('done');
    expect(row.feeMinor).toBe(150000);
  });

  it('keeps a removed row removed when a stale device syncs it back', async () => {
    const base = {
      id: 'ghost1',
      date: '2026-08-22',
      token: 10,
      name: 'Added by mistake',
      status: 'waiting',
      payment: 'unpaid',
      createdAt: '2026-08-22T10:00:00.000Z',
      updatedAt: '2026-08-22T10:00:00.000Z',
    };
    await sync({ patients: [], queue: [base] });

    // Reception removes it. A soft delete, because a hard one is
    // indistinguishable from "this row has not reached me yet".
    await sync({
      patients: [],
      queue: [
        { ...base, deletedAt: '2026-08-22T10:01:00.000Z', updatedAt: '2026-08-22T10:01:00.000Z' },
      ],
    });

    // The doctor's tablet still holds the live copy and syncs it.
    const after = await (await sync({ patients: [], queue: [base] })).json();
    const row = after.queue.find((q: { id: string }) => q.id === 'ghost1');
    expect(row.deletedAt).toBe('2026-08-22T10:01:00.000Z');
  });

  it('sends only what changed since the caller last synced', async () => {
    const cut = '2026-08-22T12:00:00.000Z';
    await sync({
      patients: [],
      queue: [
        {
          id: 'old1',
          date: '2026-08-22',
          token: 20,
          name: 'Seen this morning',
          status: 'done',
          payment: 'paid',
          createdAt: '2026-08-22T08:00:00.000Z',
          updatedAt: '2026-08-22T08:00:00.000Z',
        },
        {
          id: 'new1',
          date: '2026-08-22',
          token: 21,
          name: 'Just arrived',
          status: 'waiting',
          payment: 'unpaid',
          createdAt: '2026-08-22T13:00:00.000Z',
          updatedAt: '2026-08-22T13:00:00.000Z',
        },
      ],
    });

    const delta = await (
      await sync({ patients: [], queue: [] }, `?since=${encodeURIComponent(cut)}`)
    ).json();
    const ids = delta.queue.map((q: { id: string }) => q.id);
    expect(ids).toContain('new1');
    expect(ids).not.toContain('old1');
    // The watermark comes back from the station's clock, not the device's --
    // a fast local clock would otherwise skip other people's edits.
    expect(typeof delta.serverTime).toBe('string');
  });
});

/**
 * HTTPS, which is what makes a doctor's phone able to hold records at all.
 *
 * Over plain http:// on a LAN address the browser withholds crypto.subtle, so
 * the encrypted backup, the PIN and the service worker all disappear -- on the
 * one device that holds every clinical record. A cert the device has not
 * TRUSTED does not help: a certificate error disqualifies the origin exactly as
 * plain HTTP does. Hence a local CA, and hence these tests.
 */
describe('TLS on the clinic station', () => {
  const TLS_PORT = 8794;
  const HTTP_PORT = 8795;
  let tlsChild: ChildProcess;
  let tlsDir: string;

  beforeAll(async () => {
    tlsDir = await mkdtemp(join(tmpdir(), 'nabz-tls-'));
    tlsChild = spawn(process.execPath, ['server/index.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NABZ_MODE: 'clinic',
        PORT: String(HTTP_PORT),
        NABZ_HTTPS_PORT: String(TLS_PORT),
        HOST: '127.0.0.1',
        NABZ_DATA: tlsDir,
      },
      stdio: 'ignore',
    });
    for (let i = 0; i < 90; i += 1) {
      try {
        if ((await fetch(`http://127.0.0.1:${HTTP_PORT}/healthz`)).ok) break;
      } catch {
        /* not up */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }, 60000);

  afterAll(async () => {
    tlsChild?.kill();
    if (tlsDir) await rm(tlsDir, { recursive: true, force: true });
  });

  it('generates a CA and a leaf that names this machine', async () => {
    const caPem = await readFile(join(tlsDir, 'tls', 'ca.crt'), 'utf8');
    const leafPem = await readFile(join(tlsDir, 'tls', 'station.crt'), 'utf8');
    expect(caPem).toContain('BEGIN CERTIFICATE');
    expect(leafPem).toContain('BEGIN CERTIFICATE');

    const forge = (await import('node-forge')).default;
    const leaf = forge.pki.certificateFromPem(leafPem);
    const san = leaf.extensions.find((e: { name: string }) => e.name === 'subjectAltName');
    const names = san.altNames.map((a: { ip?: string; value?: string }) => a.ip ?? a.value);
    // Browsers ignore commonName and match on SAN, so a cert without these
    // fails outright no matter what the CN says.
    expect(names).toContain('127.0.0.1');
    expect(names).toContain('localhost');

    // And the CA must actually vouch for it, or trusting the CA buys nothing.
    const store = forge.pki.createCaStore([forge.pki.certificateFromPem(caPem)]);
    expect(() => forge.pki.verifyCertificateChain(store, [leaf])).not.toThrow();
  });

  it('serves the app over HTTPS', async () => {
    const caPem = await readFile(join(tlsDir, 'tls', 'ca.crt'), 'utf8');
    const https = await import('node:https');
    const body = await new Promise<string>((resolve, reject) => {
      https
        .get(
          {
            hostname: '127.0.0.1',
            port: TLS_PORT,
            path: '/healthz',
            // Trust ONLY the clinic CA: this proves a real client validates the
            // chain and the address, not that we skipped verification.
            agent: new https.Agent({ ca: caPem }),
          },
          (res) => {
            let b = '';
            res.on('data', (c) => (b += c));
            res.on('end', () => resolve(b));
          },
        )
        .on('error', reject);
    });
    expect(JSON.parse(body)).toMatchObject({ ok: true, mode: 'clinic' });
  });

  it('hands out the certificate on the plain port', async () => {
    const res = await fetch(`http://127.0.0.1:${HTTP_PORT}/ca.crt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('x509');
    expect(await res.text()).toContain('BEGIN CERTIFICATE');
  });

  it('CLOSES the plain port to everything else, including the queue', async () => {
    // The queue carries patient identity. Serving it unencrypted beside an
    // encrypted copy would leave a second door open on the clinic wifi for no
    // reason -- nothing legitimate uses it, because the app is HTTPS-only.
    const api = await fetch(`http://127.0.0.1:${HTTP_PORT}/api/clinic`);
    expect(await api.text()).not.toContain('queue');

    const app = await fetch(`http://127.0.0.1:${HTTP_PORT}/`);
    const html = await app.text();
    expect(html).toContain('Set up this device');
    expect(html).not.toContain('<div id="root">');
  });
});

describe('serve mode — what Railway runs', () => {
  const SERVE_PORT = 8792;
  let serveChild: ChildProcess;

  beforeAll(async () => {
    serveChild = spawn(process.execPath, ['server/index.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, NABZ_MODE: 'serve', PORT: String(SERVE_PORT), HOST: '127.0.0.1' },
      stdio: 'ignore',
    });
    for (let i = 0; i < 60; i += 1) {
      try {
        if ((await fetch(`http://127.0.0.1:${SERVE_PORT}/healthz`)).ok) break;
      } catch {
        /* not up */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }, 30000);

  afterAll(() => serveChild?.kill());

  it('has no data endpoint at all', async () => {
    const res = await fetch(`http://127.0.0.1:${SERVE_PORT}/api/clinic`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/stores nothing/);
  });

  it('tells the client not to expect a shared queue', async () => {
    const body = await (await fetch(`http://127.0.0.1:${SERVE_PORT}/api/mode`)).json();
    expect(body).toEqual({ mode: 'serve', sync: false });
  });
});
