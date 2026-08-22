/**
 * Pack import / export.
 *
 * PLAIN JSON, NOT ENCRYPTED — and that is the opposite of `storage/backup.ts`
 * on purpose. A records backup holds patient data and is encrypted because it
 * must never be readable by anyone but the doctor. A pack holds drug names,
 * chip labels and phrase templates: it contains nothing clinical about anyone,
 * and its whole value is that a specialist can hand it to a colleague. Encrypting
 * it would protect nothing and prevent the one thing it is for.
 *
 * DESIGN.md 12: "Live JSON preview = exactly what the app imports." The string
 * this module produces for the preview is the string it writes to the file.
 */
import type { ContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { APP_CONTENT_VERSION } from '@data/provider.ts';

const MAGIC = 'NABZ-PACK';

export interface PackFile {
  magic: typeof MAGIC;
  version: string;
  exportedAt: string;
  pack: ContentPack;
  phrases: PackRegistry;
}

export function serialisePack(pack: ContentPack, phrases: PackRegistry): string {
  const file: PackFile = {
    magic: MAGIC,
    version: APP_CONTENT_VERSION,
    exportedAt: new Date().toISOString(),
    pack,
    phrases,
  };
  return JSON.stringify(file, null, 2);
}

export function parsePackFile(text: string): PackFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const file = parsed as Partial<PackFile>;
  if (file.magic !== MAGIC) {
    throw new Error('That file is not a Nabz content pack.');
  }
  if (!file.pack || !file.phrases) {
    throw new Error('That pack file is missing its content.');
  }
  // Structural validation is the caller's job -- it holds the live validators
  // and can show the failures in place rather than as one thrown string.
  return file as PackFile;
}

export function packFilename(pack: ContentPack, now = new Date()): string {
  const slug = pack.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `nabz-pack-${slug}-${now.toISOString().slice(0, 10)}.json`;
}

export function downloadPack(pack: ContentPack, phrases: PackRegistry): void {
  const blob = new Blob([serialisePack(pack, phrases)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = packFilename(pack);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
