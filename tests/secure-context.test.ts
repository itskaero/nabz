/**
 * What happens when the browser takes WebCrypto away.
 *
 * This is not a hypothetical. A clinic station tells the doctor to open
 * `http://192.168.100.2:8080`, and that address is not a secure context, so
 * `crypto.subtle` is `undefined` there. The encrypted backup is the only
 * recovery path for records that exist on exactly one device — and it used to
 * fail with `Cannot read properties of undefined (reading 'importKey')`, which
 * tells a doctor nothing.
 *
 * These tests deliberately delete `crypto.subtle` to reproduce that browser,
 * because no amount of testing on `127.0.0.1` ever will: localhost IS a secure
 * context, which is exactly how this stayed hidden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  hasWebCrypto,
  requireWebCrypto,
  secureContextProblem,
} from '@domain/secureContext.ts';
import { setPin, checkPin, openGate } from '@domain/roles.ts';
import { exportEncrypted, decryptBackup } from '@storage/backup.ts';

/**
 * Reproduce a plain-HTTP origin: same `crypto`, no `subtle`.
 *
 * `subtle` is an accessor on `Crypto.prototype`, not an own property of the
 * instance, so there is usually no own descriptor to put back. Defining one
 * SHADOWS the prototype getter, and the shadow has to be deleted rather than
 * reassigned or every later test in the file inherits a crippled `crypto`.
 *
 * Async-aware on purpose: restoring in a `finally` around a bare `run()` would
 * put `subtle` back the instant the callback returned its promise, long before
 * the code under test had run.
 */
function suppressWebCrypto(): () => void {
  const own = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: undefined,
    configurable: true,
  });
  return () => {
    if (own) Object.defineProperty(globalThis.crypto, 'subtle', own);
    else delete (globalThis.crypto as unknown as { subtle?: unknown }).subtle;
  };
}

async function withoutWebCrypto<T>(run: () => T | Promise<T>): Promise<T> {
  const restore = suppressWebCrypto();
  try {
    return await run();
  } finally {
    restore();
  }
}

afterEach(() => {
  // Guard against a failed test leaving the stub in place and poisoning the rest.
  expect(hasWebCrypto()).toBe(true);
});

describe('detection', () => {
  it('knows the difference between the two origins', async () => {
    expect(hasWebCrypto()).toBe(true);
    expect(secureContextProblem()).toBeNull();

    await withoutWebCrypto(() => {
      expect(hasWebCrypto()).toBe(false);
      expect(secureContextProblem()).toBeTruthy();
    });
  });

  it('tells the doctor the address to open, not the words "secure context"', async () => {
    await withoutWebCrypto(() => {
      const message = secureContextProblem()!;
      // The person who has to fix this does not know what an origin is. They do
      // know how to open a different address.
      expect(message).toContain('https://');
      expect(message.toLowerCase()).not.toContain('secure context');
      expect(message.toLowerCase()).not.toContain('crypto.subtle');
    });
  });
});

describe('requireWebCrypto', () => {
  it('passes silently when crypto is real', () => {
    expect(() => requireWebCrypto('Backing up')).not.toThrow();
  });

  it('throws a sentence, naming what was being attempted', async () => {
    await withoutWebCrypto(() => {
      let caught: unknown;
      try {
        requireWebCrypto('Backing up');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain('Backing up');
      expect(message).toContain('https://');
      // The failure this replaces.
      expect(message).not.toContain('undefined');
    });
  });
});

describe('backup on a plain-HTTP address', () => {
  it('refuses BEFORE it looks at the passphrase', async () => {
    // Ordering matters. A doctor sent away to think about their password would
    // never discover that the address is the problem.
    await withoutWebCrypto(async () => {
      await expect(exportEncrypted('short')).rejects.toThrow(/https:\/\//);
    });
  });

  it('fails a restore with something actionable', async () => {
    await withoutWebCrypto(async () => {
      await expect(decryptBackup('{}', 'a-long-enough-passphrase')).rejects.toThrow(
        /Restoring a backup/,
      );
    });
  });

  it('still works normally when crypto is available', async () => {
    const blob = await exportEncrypted('a-long-enough-passphrase');
    expect(blob.size).toBeGreaterThan(0);
    const round = await decryptBackup(await blob.text(), 'a-long-enough-passphrase');
    expect(round.magic).toBe('NABZ-BACKUP');
  });
});

describe('the PIN on a plain-HTTP address', () => {
  it('refuses to set a gate that could never be opened', async () => {
    await withoutWebCrypto(async () => {
      await expect(setPin('1234')).rejects.toThrow(/Setting a PIN/);
    });
  });

  it('says why it cannot check an existing PIN', async () => {
    const gate = await setPin('4321');
    await withoutWebCrypto(async () => {
      await expect(checkPin(gate, '4321')).rejects.toThrow(/Checking the PIN/);
    });
    // And is unaffected where crypto is real.
    expect(await checkPin(gate, '4321')).toBe(true);
    expect(await checkPin(gate, '0000')).toBe(false);
  });

  it('leaves an open gate open — there is nothing to check', async () => {
    // No PIN set means no digest, so this must not throw even on a bad origin.
    await withoutWebCrypto(async () => {
      expect(await checkPin(openGate, 'anything')).toBe(true);
    });
  });
});
