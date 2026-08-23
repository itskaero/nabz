/**
 * Is this page allowed to do cryptography?
 *
 * THE FAILURE THIS EXISTS TO STOP BEING SILENT
 * --------------------------------------------
 * `crypto.subtle` is only exposed in a **secure context**. HTTPS is one;
 * `localhost` and `127.0.0.1` are; a plain-HTTP LAN address is NOT. So a doctor
 * who opens the app at `http://192.168.100.2:8080` -- exactly what a clinic
 * station tells them to do -- gets a `crypto.subtle` of `undefined`, and:
 *
 *   - the encrypted backup throws, and that is the ONLY recovery path this
 *     product has for records that exist nowhere else;
 *   - the PIN gate throws;
 *   - the service worker never registers, so there is no offline.
 *
 * None of it announced itself. The app looked like it was working. A device
 * holding the only copy of every prescription was quietly unable to back up.
 *
 * `crypto.getRandomValues` is available everywhere and is unaffected;
 * `crypto.randomUUID` is secure-context-only but is already guarded where it is
 * used. It is `subtle` that matters here.
 */

/** True when WebCrypto's real primitives are available. */
export function hasWebCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

/**
 * Whether the page is a secure context, tolerating environments that do not
 * define the flag at all (older test runners, some embedded webviews).
 */
export function isSecureContext(): boolean {
  if (typeof globalThis.isSecureContext === 'boolean') return globalThis.isSecureContext;
  return hasWebCrypto();
}

/** What is unavailable, named so a doctor knows what they have lost. */
export const INSECURE_CASUALTIES = [
  'encrypted backup and restore',
  'the doctor’s PIN',
  'working offline',
] as const;

/**
 * A sentence a doctor can act on, or null when everything is fine.
 *
 * Deliberately not "insecure context" -- that phrase means nothing to the person
 * who has to fix it. It names the address to open instead.
 */
export function secureContextProblem(): string | null {
  if (hasWebCrypto()) return null;
  return (
    'This page was opened over a plain connection, so the browser has switched ' +
    'off encrypted backup, the PIN and offline use. Open the address that ' +
    'starts with https:// — the clinic station prints it — or open the app on ' +
    'the computer itself.'
  );
}

/**
 * Guard the entry to anything that needs WebCrypto.
 *
 * Throws a sentence rather than letting the caller die on
 * `Cannot read properties of undefined (reading 'importKey')`, which tells a
 * doctor nothing and tells whoever reads the bug report almost as little.
 */
export function requireWebCrypto(action: string): void {
  if (hasWebCrypto()) return;
  throw new Error(
    `${action} needs a secure connection. ${secureContextProblem() ?? ''}`.trim(),
  );
}
