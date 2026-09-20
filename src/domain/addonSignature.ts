/**
 * Who really wrote this addon.
 *
 * An addon can switch on a clinical module and add sentences a patient will
 * read. A clinic taking one from their own paediatric society should be able
 * to tell it apart from the same file after somebody edited it in transit.
 * That is all this does: it proves nothing to a server, because there is no
 * server, and it does not need one.
 *
 * WEBCRYPTO, NOT node-forge. Forge is already a dependency but only the
 * SERVER uses it (`server/tls.mjs`), and pulling it into the PWA would add a
 * couple of hundred kilobytes to a bundle a clinic downloads over a phone
 * connection. `crypto.subtle` is what `storage/backup.ts` already uses.
 *
 * ECDSA P-256, because the public key is something a person may have to read
 * off a page or paste into a message, and an RSA key is four lines of base64
 * where this is one.
 *
 * WHAT HAPPENS WHEN CRYPTO IS NOT THERE
 * -------------------------------------
 * A plain-http LAN origin has no `crypto.subtle` at all -- that is the whole
 * subject of `domain/secureContext.ts`, and the app already says so loudly.
 * So verification has THREE outcomes, not two: valid, invalid, and
 * "could not check". Only `invalid` refuses. Treating "could not check" as a
 * refusal would make an addon uninstallable on exactly the machines this app
 * is designed to run on.
 */
import type { Addon, AddonManifest, AddonContributions, AddonSignature } from './addon.ts';

export type Verdict = 'valid' | 'invalid' | 'unverifiable' | 'unsigned';

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-256' } as const;

function subtle(): SubtleCrypto | null {
  try {
    return globalThis.crypto?.subtle ?? null;
  } catch {
    return null;
  }
}

/** True when this device can check a signature at all. */
export function canVerify(): boolean {
  return subtle() !== null;
}

/**
 * The bytes that get signed.
 *
 * Keys are sorted at every level, so re-serialising an addon that has been
 * parsed and re-stringified produces the same bytes it was signed over. A
 * signature scheme whose input depends on key order is a signature scheme
 * that fails the first time a file goes through a formatter.
 *
 * The signature block itself is excluded, obviously -- it cannot cover itself.
 */
export function canonical(manifest: AddonManifest, contributes: AddonContributions): string {
  return stableStringify({ manifest, contributes });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

const enc = new TextEncoder();

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let s = '';
  for (const b of view) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * `Uint8Array<ArrayBuffer>`, not a bare `Uint8Array`: TypeScript 5.7 made the
 * typed arrays generic over their buffer, and `crypto.subtle` will not accept
 * one that might be backed by a SharedArrayBuffer. Allocating explicitly is
 * what pins it.
 */
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * A new signing identity, for a pack author.
 *
 * The private key never leaves the device that generated it -- it is not in
 * the addon file and it is not in a backup. An author who loses it signs the
 * next version with a new one and tells people, which is the same thing that
 * happens with any other key a person holds.
 */
export async function generateSigningKey(): Promise<{ publicKey: string; privateKey: string }> {
  const api = subtle();
  if (!api) throw new Error('this device has no cryptography available (see secureContext.ts)');
  const pair = await api.generateKey(ALGORITHM, true, ['sign', 'verify']);
  const [pub, priv] = await Promise.all([
    api.exportKey('spki', pair.publicKey),
    api.exportKey('pkcs8', pair.privateKey),
  ]);
  return { publicKey: toBase64(pub), privateKey: toBase64(priv) };
}

export async function signAddon(
  manifest: AddonManifest,
  contributes: AddonContributions,
  privateKeyB64: string,
  publicKeyB64: string,
  now = new Date(),
): Promise<AddonSignature> {
  const api = subtle();
  if (!api) throw new Error('this device has no cryptography available');
  const key = await api.importKey('pkcs8', fromBase64(privateKeyB64), ALGORITHM, false, ['sign']);
  const sig = await api.sign(SIGN_PARAMS, key, enc.encode(canonical(manifest, contributes)));
  return {
    publicKey: publicKeyB64,
    signature: toBase64(sig),
    signedAt: now.toISOString(),
  };
}

/**
 * Check an addon's signature.
 *
 * Note what this does NOT tell you: that the signer is trustworthy. It says
 * the file has not changed since that key signed it. Deciding the key belongs
 * to the society whose name is on the manifest is a human act, which is why
 * the installer shows the key rather than hiding it behind a tick.
 */
export async function verifyAddon(addon: Addon): Promise<Verdict> {
  if (!addon.signature) return 'unsigned';
  const api = subtle();
  if (!api) return 'unverifiable';
  try {
    const key = await api.importKey(
      'spki',
      fromBase64(addon.signature.publicKey),
      ALGORITHM,
      false,
      ['verify'],
    );
    const ok = await api.verify(
      SIGN_PARAMS,
      key,
      fromBase64(addon.signature.signature),
      enc.encode(canonical(addon.manifest, addon.contributes)),
    );
    return ok ? 'valid' : 'invalid';
  } catch {
    // A malformed key or signature is not "cannot check" -- the file claims a
    // signature and the claim does not hold up.
    return 'invalid';
  }
}

/**
 * A short, readable form of a public key, for a person comparing what they
 * installed against what the author published. Not a security boundary on its
 * own; an aid to the human one.
 */
export function keyFingerprint(publicKeyB64: string): string {
  const bytes = fromBase64(publicKeyB64);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const b of bytes) {
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + b, 0x85ebca6b) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return `${hex(h1)}-${hex(h2)}`.toUpperCase();
}
