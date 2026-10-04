/**
 * A QR code, on the station, in about two hundred lines.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * Connecting a phone to the clinic station currently means reading an IP
 * address off a terminal window, typing it into a browser, getting past a
 * certificate warning, reading a six-digit code off the same terminal and
 * typing that in too. Two of those steps look, to a non-technical person,
 * exactly like the things they have been taught to be afraid of. A QR code
 * collapses all four into pointing a camera at a screen.
 *
 * WHY IT IS WRITTEN OUT RATHER THAN INSTALLED
 * -------------------------------------------
 * This runs on the STATION, which is packaged as a single .exe a receptionist
 * double-clicks, and it must never reach the PWA bundle -- the app that a
 * doctor loads over a clinic LAN should not carry an encoder for a picture
 * only the station ever draws. The subset actually needed is small: byte
 * mode, one error-correction level, and enough versions for a URL. Everything
 * outside that subset is deliberately absent rather than half-present.
 *
 * WHY IT IS NOT TAKEN ON TRUST
 * ----------------------------
 * A QR code that is subtly wrong still looks like a QR code. A flipped bit in
 * the Reed-Solomon remainder produces a plausible black-and-white square that
 * no camera will read, and the failure arrives in a clinic rather than here.
 * `tests/qr.test.ts` therefore DECODES what this produces, with a decoder
 * this file had no hand in writing.
 *
 * Structure follows ISO/IEC 18004: encode to codewords, add error correction,
 * interleave, place, mask, pick the mask with the lowest penalty.
 */

/* ------------------------------------------------------------------ GF(256) */

/*
 * The field QR arithmetic happens in: byte values, multiplied modulo the
 * primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d). Logs turn
 * multiplication into addition, which is the only reason this is fast enough
 * to do in a template string.
 */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/**
 * The generator polynomial for `n` error-correction codewords: the product of
 * (x - a^0)(x - a^1)...(x - a^(n-1)).
 *
 * Coefficients run HIGHEST degree first, so `poly[0]` is the leading 1 and
 * `remainder` below can index straight into the tail. Building it the other
 * way round produces the same numbers reversed, which is the kind of mistake
 * that yields a symbol a scanner rejects and a human cannot see.
 */
function generator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      // times x, which keeps a coefficient's place in a descending list ...
      next[j] ^= poly[j];
      // ... and times a^i, which moves it one place down.
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** The remainder of `data` divided by the generator: the EC codewords. */
function remainder(data, ecCount) {
  const gen = generator(ecCount);
  const out = new Array(ecCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift();
    out.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i++) out[i] ^= mul(gen[i + 1], factor);
    }
  }
  return out;
}

/* ------------------------------------------------------- the version tables */

/**
 * Versions 1-10 at error-correction level M, which recovers about 15% of a
 * damaged symbol. L would fit more in the same square; M is what survives a
 * phone camera at an angle across a reception desk, which is the only place
 * this will ever be read.
 *
 * `[ecPerBlock, group1Blocks, group1Data, group2Blocks, group2Data]`.
 */
const VERSIONS = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

/** Row/column centres of the alignment patterns, by version. */
const ALIGNMENT = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const dataCodewords = (v) => {
  const [, b1, d1, b2, d2] = VERSIONS[v];
  return b1 * d1 + b2 * d2;
};

/** Bits available for the payload, after the mode and character count. */
const payloadBits = (v) => dataCodewords(v) * 8 - 4 - (v < 10 ? 8 : 16);

/* --------------------------------------------------------------- the bitstream */

class Bits {
  constructor() {
    this.bits = [];
  }
  push(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  get length() {
    return this.bits.length;
  }
  toBytes() {
    const out = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | (this.bits[i + j] ?? 0);
      out.push(byte);
    }
    return out;
  }
}

/* ------------------------------------------------------------- the matrix */

const FINDER = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

/** The BCH remainder of `value` modulo `poly`, which is the check-bit half. */
function bchRemainder(value, poly) {
  const width = 32 - Math.clz32(poly);
  let rest = value;
  while (32 - Math.clz32(rest) >= width) {
    rest ^= poly << (32 - Math.clz32(rest) - width);
  }
  return rest >>> 0;
}

function formatBits(mask) {
  // 00 is level M. The 0x5412 mask stops an all-zero format -- a real
  // possibility, since 0 is a valid codeword -- from reading as a valid one.
  const data = (0b00 << 3) | mask;
  const rest = bchRemainder(data << 10, 0b10100110111);
  return ((((data << 10) | rest) ^ 0x5412) >>> 0) & 0x7fff;
}

function versionBits(version) {
  return (((version << 12) | bchRemainder(version << 12, 0b1111100100101)) >>> 0) & 0x3ffff;
}

function blankMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserve = (r, c, value) => {
    if (r >= 0 && r < size && c >= 0 && c < size) modules[r][c] = value;
  };

  // Finders, plus the light separator that stops them touching the data.
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r < 7 && c >= 0 && c < 7;
        reserve(top + r, left + c, inside ? FINDER[r][c] : 0);
      }
    }
  }

  for (const r of ALIGNMENT[version]) {
    for (const c of ALIGNMENT[version]) {
      // Not over a finder: the three corners already have their own pattern.
      if (modules[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const edge = Math.max(Math.abs(dr), Math.abs(dc));
          reserve(r + dr, c + dc, edge === 1 ? 0 : 1);
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    if (modules[6][i] === null) modules[6][i] = bit;
    if (modules[i][6] === null) modules[i][6] = bit;
  }

  // The one module that is always dark, for reasons lost to the standard.
  modules[size - 8][8] = 1;

  return modules;
}

/**
 * Where the format bits go: two copies, so one damaged corner is survivable.
 *
 * Both arrays are in bit order, most significant first, so the caller writes
 * `(format >> (14 - index)) & 1` into each. The second copy is SEVEN cells
 * down the left edge and eight along the top-right, not eight and seven: the
 * module at `(size - 8, 8)` is the one that is always dark, and writing a
 * format bit over it is a mistake that still decodes from the other copy --
 * which is exactly why it is worth naming here.
 */
function formatCells(size) {
  const a = [];
  const b = [];
  for (let i = 0; i <= 5; i++) a.push([8, i]);
  a.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i <= 14; i++) a.push([14 - i, 8]);
  for (let i = 0; i <= 6; i++) b.push([size - 1 - i, 8]);
  for (let i = 7; i <= 14; i++) b.push([8, size - 15 + i]);
  return [a, b];
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * How ugly a masked symbol is, by the spec's four rules. Lower is better; the
 * point is to avoid large blank areas and anything that looks like a finder,
 * both of which confuse a scanner rather than a human.
 */
function penalty(m) {
  const size = m.length;
  let score = 0;

  const run = (get) => {
    for (let i = 0; i < size; i++) {
      let last = -1;
      let length = 0;
      for (let j = 0; j < size; j++) {
        const v = get(i, j);
        if (v === last) length++;
        else {
          if (length >= 5) score += 3 + (length - 5);
          last = v;
          length = 1;
        }
      }
      if (length >= 5) score += 3 + (length - 5);
    }
  };
  run((i, j) => m[i][j]);
  run((i, j) => m[j][i]);

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  const FINDER_LIKE = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const matches = (cells) => {
    for (let i = 0; i + 11 <= cells.length; i++) {
      let hit = true;
      let back = true;
      for (let j = 0; j < 11; j++) {
        if (cells[i + j] !== FINDER_LIKE[j]) hit = false;
        if (cells[i + j] !== FINDER_LIKE[10 - j]) back = false;
      }
      if (hit || back) score += 40;
    }
  };
  for (let i = 0; i < size; i++) {
    matches(m[i]);
    matches(m.map((row) => row[i]));
  }

  const dark = m.flat().reduce((n, v) => n + v, 0);
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/* ------------------------------------------------------------------ the API */

/**
 * Encode `text` as a QR matrix.
 *
 * Byte mode: the payload here is a URL, and anything outside Latin-1 is
 * rejected rather than mangled -- a station address with a smart quote in it
 * is a bug, not an encoding problem.
 *
 * Returns `{ version, size, modules }` where `modules[r][c]` is 1 for dark.
 */
export function encodeQr(text) {
  const bytes = [...new TextEncoder().encode(text)];

  const version = Object.keys(VERSIONS)
    .map(Number)
    .find((v) => bytes.length * 8 <= payloadBits(v));
  if (!version) {
    throw new Error(
      `${bytes.length} bytes is more than this encoder carries; it covers ` +
        'versions 1-10 at level M, which is 213 bytes.',
    );
  }

  const [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] = VERSIONS[version];

  const bits = new Bits();
  bits.push(0b0100, 4);
  bits.push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) bits.push(byte, 8);

  const capacity = dataCodewords(version) * 8;
  bits.push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0, 1);
  const data = bits.toBytes();
  // The pad bytes are fixed by the standard, and alternate so a long pad does
  // not become a long blank run.
  for (let i = 0; data.length < dataCodewords(version); i++) {
    data.push(i % 2 === 0 ? 0xec : 0x11);
  }

  const blocks = [];
  let at = 0;
  for (const [count, size] of [
    [g1Blocks, g1Data],
    [g2Blocks, g2Data],
  ]) {
    for (let i = 0; i < count; i++) {
      const slice = data.slice(at, at + size);
      at += size;
      blocks.push({ data: slice, ec: remainder(slice, ecPerBlock) });
    }
  }

  /*
    Interleaved, not concatenated. Spreading each block's codewords through
    the symbol is what makes a coffee ring over one corner recoverable rather
    than fatal -- it turns a burst of damage into a little damage to every
    block.
  */
  const codewords = [];
  for (let i = 0; i < Math.max(g1Data, g2Data); i++) {
    for (const block of blocks) if (i < block.data.length) codewords.push(block.data[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of blocks) codewords.push(block.ec[i]);
  }

  const reserved = blankMatrix(version);
  const size = reserved.length;

  // The format and version areas are not data, so they are reserved before
  // the zigzag runs over them.
  const taken = reserved.map((row) => row.map((v) => v !== null));
  for (const cells of formatCells(size)) for (const [r, c] of cells) taken[r][c] = true;
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      taken[size - 11 + c][r] = true;
      taken[r][size - 11 + c] = true;
    }
  }

  const stream = [];
  for (const byte of codewords) for (let i = 7; i >= 0; i--) stream.push((byte >> i) & 1);

  const placed = reserved.map((row) => row.slice());
  let bit = 0;
  let upward = true;
  for (let right = size - 1; right >= 0; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely, which
    // shifts every pair to its left by one.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (col < 0 || taken[row][col]) continue;
        placed[row][col] = stream[bit++] ?? 0;
      }
    }
    upward = !upward;
  }

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = placed.map((row, r) =>
      row.map((v, c) => (taken[r][c] ? v : MASKS[mask](r, c) ? v ^ 1 : v)),
    );
    const format = formatBits(mask);
    const [a, b] = formatCells(size);
    for (const cells of [a, b]) {
      cells.forEach(([r, c], i) => {
        candidate[r][c] = (format >> (14 - i)) & 1;
      });
    }
    if (version >= 7) {
      const info = versionBits(version);
      for (let i = 0; i < 18; i++) {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const value = (info >> i) & 1;
        candidate[size - 11 + c][r] = value;
        candidate[r][size - 11 + c] = value;
      }
    }
    const score = penalty(candidate);
    if (!best || score < best.score) best = { score, modules: candidate };
  }

  return { version, size, modules: best.modules };
}

/**
 * The same thing as an SVG, sized in CSS pixels.
 *
 * One `<path>` rather than one `<rect>` per module: a version-4 symbol is
 * 1089 modules, and a thousand rects is a page a phone takes a visible moment
 * to lay out. The quiet zone is four modules because a scanner needs it --
 * a QR flush against a card edge is a QR that does not read.
 */
export function qrSvg(text, { size = 220, quiet = 4 } = {}) {
  const { modules, size: count } = encodeQr(text);
  const span = count + quiet * 2;
  let path = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (modules[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="QR code for ${text.replace(/[<>&"]/g, '')}">` +
    `<rect width="${span}" height="${span}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/></svg>`
  );
}
