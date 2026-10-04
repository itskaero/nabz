/**
 * @vitest-environment jsdom
 *
 * Pairing by scanning, instead of by typing.
 *
 * Connecting a device used to mean reading an IP address off a terminal
 * window, typing it into a browser, getting past a certificate warning,
 * reading a six-digit code off the same terminal and typing that in too. The
 * station's setup page now prints a QR for
 * `https://<station>:8443/#pair=<code>`, which collapses the address and the
 * code into pointing a camera at a screen.
 *
 * The half worth testing is what happens to the code afterwards.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adoptPairingFromUrl, forgetPairing, pairedCode } from '@storage/clinicSync.ts';

const at = (url: string) => window.history.replaceState(null, '', url);

beforeEach(() => {
  forgetPairing();
  at('/');
});
afterEach(() => forgetPairing());

describe('a device that arrived by scanning', () => {
  it('is paired without anybody typing anything', () => {
    at('/#pair=481920');
    expect(adoptPairingFromUrl()).toBe('481920');
    expect(pairedCode()).toBe('481920');
  });

  it('does not leave the code in the address bar', () => {
    /*
      A pairing code left there is a pairing code in the browser history, in
      a screenshot, and in whatever gets pasted into WhatsApp when somebody
      shares "the clinic link".
    */
    at('/#pair=481920');
    adoptPairingFromUrl();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('keeps the rest of the fragment, which may not be ours', () => {
    at('/#pair=481920&tab=queue');
    adoptPairingFromUrl();
    expect(pairedCode()).toBe('481920');
    expect(window.location.hash).toBe('#tab=queue');
  });

  it('finds the code when it is not the first thing in the fragment', () => {
    at('/#tab=queue&pair=481920');
    expect(adoptPairingFromUrl()).toBe('481920');
    expect(window.location.hash).toBe('#tab=queue');
  });
});

describe('a device that arrived any other way', () => {
  it('is left entirely alone', () => {
    at('/#tab=queue');
    expect(adoptPairingFromUrl()).toBeNull();
    expect(pairedCode()).toBeNull();
    expect(window.location.hash).toBe('#tab=queue');
  });

  it('is not un-paired by a visit without a code', () => {
    at('/#pair=481920');
    adoptPairingFromUrl();
    at('/');
    expect(adoptPairingFromUrl()).toBeNull();
    // Still paired: forgetting is something a doctor asks for in Settings.
    expect(pairedCode()).toBe('481920');
  });
});

describe('what it refuses', () => {
  it('takes digits only', () => {
    // Anything else in that parameter did not come from a station this device
    // should be pairing with, and a header built from it would go out on
    // every sync.
    for (const junk of ['abc', '12', '../../etc', '1234567890123', '48 1920']) {
      forgetPairing();
      at(`/#pair=${encodeURIComponent(junk)}`);
      expect(adoptPairingFromUrl(), junk).toBeNull();
      expect(pairedCode(), junk).toBeNull();
    }
  });

  it('does not take a code that is only part of a longer word', () => {
    at('/#repair=481920');
    expect(adoptPairingFromUrl()).toBeNull();
  });
});
