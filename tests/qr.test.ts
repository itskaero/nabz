/**
 * The QR code the station draws.
 *
 * A QR code that is subtly wrong still looks like a QR code. A flipped bit in
 * the Reed-Solomon remainder, an off-by-one in the zigzag, the wrong mask
 * penalty — each produces a plausible black-and-white square that no camera
 * will read, and the failure arrives in a clinic rather than here.
 *
 * So this does not inspect the matrix. It DECODES it, with `jsqr`, which is a
 * dev dependency and never ships: the station carries its own encoder (see
 * `server/qr.mjs` for why), and the decoder exists only to disagree with it.
 */
import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
// @ts-expect-error -- plain ESM on the station side, no types and none wanted
import { encodeQr, qrSvg } from '../server/qr.mjs';

/**
 * Paint the modules into the RGBA buffer `jsqr` reads. Scaled up, because a
 * decoder given one pixel per module has no slack for its own thresholding —
 * and a real camera never sees one pixel per module either.
 */
function decode(text: string, scale = 6): string | null {
  const { modules, size } = encodeQr(text) as { modules: number[][]; size: number };
  const quiet = 4;
  const span = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(span * span * 4).fill(255);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r]![c]) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = (((r + quiet) * scale + y) * span + (c + quiet) * scale + x) * 4;
          data[px] = data[px + 1] = data[px + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, span, span)?.data ?? null;
}

describe('what a phone actually reads', () => {
  it('reads back the pairing URL this whole feature exists for', () => {
    const url = 'https://192.168.100.2:8443/#pair=481920';
    expect(decode(url)).toBe(url);
  });

  it('reads back a short one, and a long one, and the versions between', () => {
    // Version selection is the step where a capacity table gets mistyped, and
    // the symptom is a symbol that encodes fine and decodes to nothing.
    for (const text of [
      'https://a.b/',
      'https://192.168.1.5:8443/#pair=123456',
      'https://nabz.clinic.example:8443/#pair=000001',
      `https://192.168.100.200:8443/#pair=999999&note=${'x'.repeat(60)}`,
      'x'.repeat(200),
    ]) {
      expect(decode(text), `${text.length} chars`).toBe(text);
    }
  });

  it('grows the symbol as the payload grows, rather than truncating', () => {
    const small = encodeQr('https://a.b/') as { version: number };
    const large = encodeQr('x'.repeat(200)) as { version: number };
    expect(small.version).toBeLessThan(large.version);
  });

  it('refuses what it cannot carry instead of encoding half of it', () => {
    // Silently dropping the tail would produce a scannable code pointing at
    // the wrong address, which is worse than no code at all.
    expect(() => encodeQr('x'.repeat(400))).toThrow(/versions 1-10/);
  });
});

describe('where it is allowed to run', () => {
  it('never reaches the app bundle', async () => {
    /*
      The station is a single .exe a receptionist double-clicks, and esbuild
      bundles whatever `server/index.mjs` reaches. The PWA is a different
      thing entirely: a doctor loading it over a clinic LAN should not be
      carrying an encoder for a picture only the station ever draws.

      Checked as an import boundary rather than by grepping a build, because
      the build is not what a future change would get wrong -- an innocent
      `import { qrSvg }` in a component is.
    */
    const { readdir, readFile } = await import('node:fs/promises');
    const { join, resolve } = await import('node:path');

    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await walk(full)));
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
      }
      return out;
    };

    const offenders: string[] = [];
    for (const file of await walk(resolve(__dirname, '../src'))) {
      const text = await readFile(file, 'utf8');
      if (/from\s+['"][^'"]*server\//.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('the SVG', () => {
  const svg = qrSvg('https://192.168.1.5:8443/#pair=123456') as string;

  it('carries its quiet zone, without which a scanner finds nothing', () => {
    // 29 modules for this payload plus four each side.
    expect(svg).toContain('viewBox="0 0 37 37"');
  });

  it('is one path, not a thousand rects', () => {
    // A version-4 symbol is 1089 modules, and a thousand elements is a page a
    // phone takes a visible moment to lay out.
    expect((svg.match(/<path/g) ?? []).length).toBe(1);
    expect(svg).not.toContain('<rect x=');
  });

  it('says what it is, for whoever cannot see it', () => {
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="QR code for https://192.168.1.5:8443/#pair=123456"');
  });
});
