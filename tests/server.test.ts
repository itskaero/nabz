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
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NABZ_DATA: dataDir,
    },
    stdio: 'ignore',
  });
  await waitForServer();
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
    const res = await fetch(`${BASE}/api/clinic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
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
          },
        ],
      }),
    });
    const merged = await res.json();
    expect(merged.patients).toHaveLength(1);
    expect(merged.queue[0].feeMinor).toBe(150000);
  });

  it('DROPS clinical content rather than storing it', async () => {
    await fetch(`${BASE}/api/clinic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
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
            problems: ['Fever'],
            advice: [{ kind: 3, text: 'rest' }],
          },
        ],
      }),
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
      headers: { 'content-type': 'application/json' },
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
