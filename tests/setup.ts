/**
 * Shared test setup.
 *
 * Neither the node environment nor this jsdom build provides a usable
 * `localStorage` -- jsdom hands back an empty object with no methods. The app
 * stores two per-device facts there (the clinic pairing code and the device
 * role), and both modules guard their access with try/catch, so without a real
 * Storage every write is silently swallowed and tests pass while asserting
 * nothing.
 *
 * Installed only when the environment has not supplied a working one, so a
 * future jsdom that does implement Storage wins over this.
 */
const working =
  typeof globalThis.localStorage === 'object' &&
  globalThis.localStorage !== null &&
  typeof globalThis.localStorage.setItem === 'function';

if (!working) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
}
