/**
 * Fetch the embedded font files into public/fonts/.
 *
 * These are not optional decoration. The PDF renderer EMBEDS them:
 *   - Noto Nastaliq Urdu carries the entire patient-facing wedge. Without a real
 *     Nastaliq face the Urdu block is unreadable or renders as tofu.
 *   - IBM Plex Sans / Mono are the Latin clinical faces (DESIGN.md 4); Mono is a
 *     safety property on dose values, not styling.
 *
 * All three are SIL OFL 1.1, which permits embedding and redistribution.
 *
 * Usage:  npm run assets:fonts
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fonts');
const GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl';

const FONTS = [
  {
    out: 'NotoNastaliqUrdu.ttf',
    url: GF + '/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf',
    role: 'Urdu (Nastaliq) - screen + PDF',
    license: 'SIL OFL 1.1',
  },
  {
    out: 'IBMPlexSans.ttf',
    url: GF + '/ibmplexsans/IBMPlexSans%5Bwdth%2Cwght%5D.ttf',
    role: 'Latin UI + clinical text',
    license: 'SIL OFL 1.1',
  },
  {
    out: 'IBMPlexMono-Regular.ttf',
    url: GF + '/ibmplexmono/IBMPlexMono-Regular.ttf',
    role: 'Clinical values (dose, strength, reg no.)',
    license: 'SIL OFL 1.1',
  },
  {
    out: 'IBMPlexMono-SemiBold.ttf',
    url: GF + '/ibmplexmono/IBMPlexMono-SemiBold.ttf',
    role: 'Emphasised clinical values',
    license: 'SIL OFL 1.1',
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifest = [];

  for (const f of FONTS) {
    process.stdout.write(f.out.padEnd(28));
    const res = await fetch(f.url, { redirect: 'follow' });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText + ' - ' + f.url);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) throw new Error('suspiciously small font file: ' + buf.length + ' bytes');
    await writeFile(join(OUT, f.out), buf);
    const sha = createHash('sha256').update(buf).digest('hex').slice(0, 16);
    manifest.push({ file: f.out, role: f.role, license: f.license, source: f.url, bytes: buf.length, sha256: sha });
    console.log((buf.length / 1024).toFixed(0) + ' KB  ' + sha);
  }

  await writeFile(join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Ship the licence text alongside the binaries, as OFL 1.1 requires.
  const ofl = await fetch(GF + '/notonastaliqurdu/OFL.txt').then((r) => (r.ok ? r.text() : null));
  if (ofl) await writeFile(join(OUT, 'OFL.txt'), ofl, 'utf8');

  console.log('\nwrote public/fonts/ (' + manifest.length + ' faces + MANIFEST.json' + (ofl ? ' + OFL.txt' : '') + ')');
  await readFile(join(OUT, 'MANIFEST.json'), 'utf8');
}

main().catch((err) => {
  console.error('\nfetch-fonts failed:', err.message);
  process.exit(1);
});
