/**
 * Manual encrypted export / import. The doctor owns the file; we stay
 * non-custodial (PRODUCT.md 12).
 *
 * Crypto: AES-GCM 256, key derived from the doctor's passphrase with PBKDF2-
 * SHA-256 at 310,000 iterations, random 16-byte salt and 12-byte IV per export.
 * WebCrypto only -- no dependency, nothing to keep patched.
 *
 * A wrong passphrase fails as an authentication error rather than producing
 * plausible-looking garbage, because AES-GCM authenticates. That matters: a
 * silently corrupted restore of clinical records is worse than a failed one.
 */
import type { Prescription } from '@domain/prescription.ts';
import type { DoctorProfile } from '@config/doctorProfile.ts';
import type { GrowthPoint } from '@domain/prescription.ts';
import type { LearnedTerm } from './db.ts';
import { db, markBackedUp } from './db.ts';

const MAGIC = 'NABZ-BACKUP';
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;

export interface BackupPayload {
  magic: typeof MAGIC;
  version: number;
  exportedAt: string;
  prescriptions: Prescription[];
  growth: Array<{ patientKey: string; patientName: string; points: GrowthPoint[]; updatedAt: string }>;
  learned: LearnedTerm[];
  profile?: DoctorProfile;
}

/** The on-disk envelope. Only `payload` is ciphertext; the rest is parameters. */
export interface BackupFile {
  magic: typeof MAGIC;
  version: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; saltB64: string };
  cipher: { name: 'AES-GCM'; ivB64: string };
  exportedAt: string;
  /** base64 ciphertext of the JSON-encoded BackupPayload */
  payloadB64: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const byte of view) s += String.fromCharCode(byte);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function collectBackup(includeProfile = true): Promise<BackupPayload> {
  const database = await db();
  const [prescriptions, growth, learned, profile] = await Promise.all([
    database.getAll('prescriptions'),
    database.getAll('growth'),
    database.getAll('learned'),
    database.get('profile', 'current'),
  ]);
  const payload: BackupPayload = {
    magic: MAGIC,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    prescriptions,
    growth,
    learned,
  };
  if (includeProfile && profile) payload.profile = profile;
  return payload;
}

export async function exportEncrypted(
  passphrase: string,
  includeProfile = true,
): Promise<Blob> {
  if (passphrase.length < 8) {
    throw new Error('Use a passphrase of at least 8 characters. This file holds patient records.');
  }
  const payload = await collectBackup(includeProfile);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(payload)),
  );

  const file: BackupFile = {
    magic: MAGIC,
    version: FORMAT_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, saltB64: toB64(salt) },
    cipher: { name: 'AES-GCM', ivB64: toB64(iv) },
    exportedAt: payload.exportedAt,
    payloadB64: toB64(ciphertext),
  };
  await markBackedUp();
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
}

export async function decryptBackup(
  fileText: string,
  passphrase: string,
): Promise<BackupPayload> {
  let file: BackupFile;
  try {
    file = JSON.parse(fileText) as BackupFile;
  } catch {
    throw new Error('That file is not a Nabz backup.');
  }
  if (file.magic !== MAGIC) throw new Error('That file is not a Nabz backup.');
  if (file.version > FORMAT_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update first.');
  }
  const key = await deriveKey(passphrase, fromB64(file.kdf.saltB64), file.kdf.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(file.cipher.ivB64) as BufferSource },
      key,
      fromB64(file.payloadB64) as BufferSource,
    );
  } catch {
    // AES-GCM authenticates, so this is "wrong passphrase or damaged file" and
    // never "here is some plausible-looking wrong data".
    throw new Error('Wrong passphrase, or the file is damaged.');
  }
  return JSON.parse(dec.decode(plain)) as BackupPayload;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  prescriptions: number;
  growthSeries: number;
  learnedTerms: number;
  profileRestored: boolean;
  skipped: number;
}

/**
 * Restore a backup.
 *
 * `merge` keeps anything already on this device and skips records whose id is
 * already present; it never overwrites a local record with an older one from a
 * file. `replace` is destructive and the UI must confirm it in as many words.
 */
export async function importBackup(
  payload: BackupPayload,
  mode: ImportMode = 'merge',
): Promise<ImportSummary> {
  const database = await db();
  const summary: ImportSummary = {
    prescriptions: 0,
    growthSeries: 0,
    learnedTerms: 0,
    profileRestored: false,
    skipped: 0,
  };

  if (mode === 'replace') {
    await Promise.all([
      database.clear('prescriptions'),
      database.clear('growth'),
      database.clear('learned'),
    ]);
  }

  for (const rx of payload.prescriptions) {
    if (mode === 'merge' && (await database.get('prescriptions', rx.id))) {
      summary.skipped += 1;
      continue;
    }
    await database.put('prescriptions', rx);
    summary.prescriptions += 1;
  }

  for (const series of payload.growth) {
    const existing = mode === 'merge' ? await database.get('growth', series.patientKey) : undefined;
    if (existing) {
      // Union by point id, so restoring an older file cannot delete newer visits.
      const byId = new Map(existing.points.map((p) => [p.id, p]));
      for (const p of series.points) if (!byId.has(p.id)) byId.set(p.id, p);
      await database.put('growth', { ...existing, points: [...byId.values()] });
    } else {
      await database.put('growth', series);
    }
    summary.growthSeries += 1;
  }

  for (const term of payload.learned) {
    const existing = mode === 'merge' ? await database.get('learned', term.key) : undefined;
    await database.put(
      'learned',
      existing ? { ...term, count: Math.max(term.count, existing.count) } : term,
    );
    summary.learnedTerms += 1;
  }

  if (payload.profile) {
    await database.put('profile', payload.profile, 'current');
    summary.profileRestored = true;
  }

  return summary;
}

export function backupFilename(now = new Date()): string {
  return `nabz-backup-${now.toISOString().slice(0, 10)}.nabz.json`;
}
