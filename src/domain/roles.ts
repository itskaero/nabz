/**
 * Who is at the machine.
 *
 * A shared reception PC means whoever is sitting at it can see whatever the app
 * will show them. Paper handled this better: files live in a cabinet and you
 * hand over one. So a shared station needs some notion of who is asking.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a security boundary and it does not pretend to be. A PIN in a
 * browser stops a receptionist opening a chart out of curiosity; it does not
 * stop anyone determined, and nothing in a client-side app could. The REAL
 * boundary is the layer split: on a two-station setup the clinical records are
 * not on the reception machine at all, so there is nothing there to protect.
 * This gate is for the single-machine case, where they are.
 *
 * The PIN is stored as a salted SHA-256 digest rather than in the clear —
 * not because that defeats an attacker with the device, but because a plain PIN
 * sitting in IndexedDB is the kind of thing that ends up in an exported backup.
 */

import { requireWebCrypto } from './secureContext.ts';

export type Role = 'doctor' | 'receptionist';

export interface RoleGate {
  /** salted digest; empty when no PIN has been set and the gate is open */
  pinHash: string;
  salt: string;
  /** ISO timestamps of the last few unlocks, for the activity log */
  recentUnlocks: string[];
}

export const openGate: RoleGate = { pinHash: '', salt: '', recentUnlocks: [] };

/** What a receptionist may reach. Everything absent is doctor-only. */
export const RECEPTIONIST_VIEWS = ['clinic', 'settings'] as const;

export function canAccess(role: Role, view: string): boolean {
  if (role === 'doctor') return true;
  return (RECEPTIONIST_VIEWS as readonly string[]).includes(view);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function digest(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

export async function setPin(pin: string): Promise<RoleGate> {
  // The digest needs WebCrypto, which a plain-HTTP LAN origin does not have.
  // Better to refuse to SET a PIN than to set one that cannot be checked later.
  requireWebCrypto('Setting a PIN');
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('The PIN must be 4 to 8 digits.');
  }
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { pinHash: await digest(pin, salt), salt, recentUnlocks: [] };
}

export async function checkPin(gate: RoleGate, pin: string): Promise<boolean> {
  if (!gate.pinHash) return true;
  // A gate that cannot be opened is worse than no gate: the doctor would be
  // locked out of their own records by an address change. Say why.
  requireWebCrypto('Checking the PIN');
  return (await digest(pin, gate.salt)) === gate.pinHash;
}

export function hasPin(gate: RoleGate): boolean {
  return gate.pinHash !== '';
}

/** Keep a short tail only. This is a hint for the doctor, not an audit system. */
export function recordUnlock(gate: RoleGate, at = new Date().toISOString()): RoleGate {
  return { ...gate, recentUnlocks: [at, ...gate.recentUnlocks].slice(0, 20) };
}
