/**
 * The image backup: a second encrypted file, written one picture at a time.
 *
 * WHY THIS EXISTS RATHER THAN A FIELD IN THE RECORDS BACKUP
 * ---------------------------------------------------------
 * `backup.ts` builds one JSON file and holds three copies of it in memory on
 * the way -- the JSON string, the ciphertext and the base64. That is fine for
 * kilobytes of clinical text and ruinous for megabytes of photographs: five
 * hundred patients with two images each would run the tab out of memory while
 * a doctor watched a Back up button do nothing.
 *
 * So this file never assembles the whole thing. Each image is encrypted on its
 * own, with its own IV, and pushed into a Blob as it goes; only one image is
 * in memory at a time, whatever the library size. The key is derived ONCE --
 * PBKDF2 at 310,000 iterations is about a second, and doing it per image would
 * turn a five-hundred-image export into an eight-minute one.
 *
 * SAME PASSWORD, DIFFERENT FILE. A doctor has one password to lose, not two.
 * The two files are independent: restoring the records without the images
 * leaves a chart whose studies say "image not on this device", which is
 * honest, and restoring images without records leaves blobs that are attached
 * to studies that will arrive.
 *
 * THE FORMAT
 * ----------
 * A line-delimited envelope. One JSON header line, then one JSON line per
 * image. Line-delimited rather than a single JSON array for exactly the reason
 * above: a parser can take it a line at a time, so a restore does not have to
 * hold the file in memory either.
 */
import { requireWebCrypto } from '@domain/secureContext.ts';
import type { Attachment } from '@domain/imaging.ts';
import { db, markImagesBackedUp } from './db.ts';

const MAGIC = 'NABZ-IMAGES';
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;

const enc = new TextEncoder();

export interface ImageBundleHeader {
  magic: typeof MAGIC;
  version: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; saltB64: string };
  cipher: { name: 'AES-GCM' };
  exportedAt: string;
  /** how many images follow, so a restore can show progress rather than a spinner */
  count: number;
}

interface ImageLine {
  id: string;
  patientId: string;
  studyId: string;
  mime: string;
  bytes: number;
  longEdge: number;
  addedOn: string;
  ivB64: string;
  /** base64 ciphertext of the image bytes */
  dataB64: string;
}

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Chunked: String.fromCharCode(...view) on a 2MB image blows the argument
  // limit, which is a crash that only appears once somebody uploads a big one.
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) {
    s += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Export every stored image as one encrypted file.
 *
 * `onProgress` is called per image, because this is the one operation in the
 * app that can take a minute and a doctor needs to see it moving.
 */
export async function exportImages(
  password: string,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  requireWebCrypto('Backing up images');
  if (password.length < 8) {
    throw new Error('Use a password of at least 8 characters. This file holds patient images.');
  }

  const database = await db();
  const ids = await database.getAllKeys('attachments');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);

  const header: ImageBundleHeader = {
    magic: MAGIC,
    version: FORMAT_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, saltB64: toB64(salt) },
    cipher: { name: 'AES-GCM' },
    exportedAt: new Date().toISOString(),
    count: ids.length,
  };

  // An array of Blob parts, never a concatenated string. The browser keeps the
  // parts on disk rather than in the heap, which is the whole point.
  const parts: BlobPart[] = [`${JSON.stringify(header)}\n`];

  let done = 0;
  for (const id of ids) {
    const row = await database.get('attachments', id);
    if (!row) continue;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new Uint8Array(await row.blob.arrayBuffer());
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      plain as BufferSource,
    );
    const line: ImageLine = {
      id: row.id,
      patientId: row.patientId,
      studyId: row.studyId,
      mime: row.mime,
      bytes: row.bytes,
      longEdge: row.longEdge,
      addedOn: row.addedOn,
      ivB64: toB64(iv),
      dataB64: toB64(ciphertext),
    };
    parts.push(`${JSON.stringify(line)}\n`);
    done += 1;
    onProgress?.(done, ids.length);
  }

  await markImagesBackedUp();
  return new Blob(parts, { type: 'application/x-ndjson' });
}

export interface ImageImportSummary {
  restored: number;
  skipped: number;
}

/**
 * Restore an image bundle.
 *
 * Reads the file as text once -- a restore has the whole file on disk already
 * and the browser gives it back as a string -- then writes one image at a time,
 * so the database never sees a batch it has to hold.
 *
 * A merge skips any image id already present: the one on this device is the
 * one the doctor has been looking at.
 */
export async function importImages(
  fileText: string,
  password: string,
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (done: number, total: number) => void,
): Promise<ImageImportSummary> {
  requireWebCrypto('Restoring images');

  const lines = fileText.split('\n').filter((l) => l.trim());
  const first = lines.shift();
  if (!first) throw new Error('That file is empty.');

  let header: ImageBundleHeader;
  try {
    header = JSON.parse(first) as ImageBundleHeader;
  } catch {
    throw new Error('That file is not a Nabz image backup.');
  }
  if (header.magic !== MAGIC) throw new Error('That file is not a Nabz image backup.');
  if (header.version > FORMAT_VERSION) {
    throw new Error('This image backup was made by a newer version of the app. Update first.');
  }

  const key = await deriveKey(password, fromB64(header.kdf.saltB64));
  const database = await db();
  if (mode === 'replace') await database.clear('attachments');

  const summary: ImageImportSummary = { restored: 0, skipped: 0 };
  let seen = 0;
  for (const raw of lines) {
    seen += 1;
    const line = JSON.parse(raw) as ImageLine;
    if (mode === 'merge' && (await database.get('attachments', line.id))) {
      summary.skipped += 1;
      onProgress?.(seen, lines.length);
      continue;
    }
    let plain: ArrayBuffer;
    try {
      plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromB64(line.ivB64) as BufferSource },
        key,
        fromB64(line.dataB64) as BufferSource,
      );
    } catch {
      // AES-GCM authenticates, so this is a wrong password or a damaged file
      // -- never plausible-looking wrong pixels.
      throw new Error('Wrong password, or the file is damaged.');
    }
    const attachment: Attachment = {
      id: line.id,
      patientId: line.patientId,
      studyId: line.studyId,
      mime: line.mime,
      bytes: line.bytes,
      longEdge: line.longEdge,
      addedOn: line.addedOn,
      blob: new Blob([plain], { type: line.mime }),
    };
    await database.put('attachments', attachment);
    summary.restored += 1;
    onProgress?.(seen, lines.length);
  }
  return summary;
}

/** Read a bundle's header without decrypting anything, to show what is in a file. */
export function peekImageBundle(fileText: string): ImageBundleHeader | null {
  const first = fileText.split('\n', 1)[0];
  if (!first) return null;
  try {
    const header = JSON.parse(first) as ImageBundleHeader;
    return header.magic === MAGIC ? header : null;
  } catch {
    return null;
  }
}

export { MAGIC as IMAGE_BUNDLE_MAGIC };
