/**
 * Serialises a shipped pack to a standalone `.nabzpack.json` file -- the
 * install artifact Settings' "Install a pack from a file" loads (CLAUDE.md
 * 11). Skipped unless `NABZ_PACK_EXPORT_ID`/`NABZ_PACK_EXPORT_OUT` are set;
 * driven by `npm run pack:export -- <packId> [outputPath]`, not part of the
 * normal `npm test` run.
 *
 * Goes through the exact same `PackFile` shape `serialisePack` (the pack
 * builder's own export) produces, so the file this writes installs through
 * Settings exactly the way a doctor's hand-exported one does. This is the
 * step that makes authoring stay TypeScript -- which is how `fixedDose` was
 * caught as a schema gap instead of shipping as a silently-dropped field --
 * while still handing out the plain JSON a pack is actually installed from.
 */
import { describe, it, expect } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { contentPacks, phrasesForShippedPack } from '@data/packs/index.ts';
import { serialisePack } from '@render/screen/builder/packFile.ts';

const packId = process.env.NABZ_PACK_EXPORT_ID;
const outPath = process.env.NABZ_PACK_EXPORT_OUT;

describe.runIf(packId && outPath)('pack export', () => {
  it('writes the requested pack to a file', async () => {
    const pack = contentPacks[packId!];
    if (!pack) {
      throw new Error(
        `Unknown pack id "${packId}". Known: ${Object.keys(contentPacks).join(', ')}`,
      );
    }
    const json = serialisePack(pack, phrasesForShippedPack(pack.id));
    await mkdir(dirname(outPath!), { recursive: true });
    await writeFile(outPath!, json, 'utf8');
    expect(json).toContain('"magic": "NABZ-PACK"');
    // eslint-disable-next-line no-console
    console.log(`wrote ${outPath}`);
  });
});
