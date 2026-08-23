/**
 * What this machine is for.
 *
 * WHY THIS IS NOT IN THE DOCTOR PROFILE
 * ------------------------------------
 * It lives in localStorage, alongside the pairing code, for the same reason
 * that does: it is a fact about this DEVICE, not about the doctor. The profile
 * travels inside the encrypted backup, so a role stored there would mean
 * restoring the doctor's backup onto the reception PC silently turns it into a
 * consulting device — defeating the entire point of having a role.
 *
 * WHAT IT ACTUALLY BUYS
 * --------------------
 * Until now a reception PC was a doctor's PC with a PIN over the clinical
 * views, and `roles.ts` is honest that a PIN in a browser is "a curiosity gate,
 * not security". The README's claim — that a receptionist cannot read clinical
 * content *because it is not on their machine* — was therefore only true while
 * nobody happened to write a script there.
 *
 * A reception device makes it true by construction: the clinical views are not
 * rendered at all, and `savePrescription` refuses. A clinical record cannot
 * land on that machine by accident, by habit, or by a bug in a view.
 *
 * The PIN stays for the case this does not cover: a solo doctor on one machine
 * who genuinely needs both roles on the same box.
 */

export type DeviceRole = 'consulting' | 'reception';

const KEY = 'nabz.deviceRole';

/** Null when nobody has chosen yet, which is what triggers the first-run picker. */
export function deviceRole(): DeviceRole | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'consulting' || raw === 'reception' ? raw : null;
  } catch {
    // Private mode, or storage blocked. Treat as unchosen rather than guessing:
    // guessing 'consulting' would quietly re-enable the clinical side.
    return null;
  }
}

export function setDeviceRole(role: DeviceRole): void {
  try {
    localStorage.setItem(KEY, role);
  } catch {
    /* the picker will simply ask again next time */
  }
}

export function clearDeviceRole(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * A device nobody has classified is treated as consulting.
 *
 * The permissive default is deliberate and safe in this direction: every
 * existing install predates this setting and must keep working, and the failure
 * mode is "the doctor sees their own records", not "the receptionist sees
 * someone else's". The restrictive default would silently hide a doctor's
 * entire history behind a setting they never knew existed.
 */
export function isReceptionDevice(): boolean {
  return deviceRole() === 'reception';
}

/** Views a reception device may reach. Everything else is not rendered at all. */
export const RECEPTION_VIEWS = ['clinic', 'settings'] as const;

export function deviceAllows(view: string): boolean {
  if (!isReceptionDevice()) return true;
  return (RECEPTION_VIEWS as readonly string[]).includes(view);
}

/** Thrown when clinical content is asked to persist on a reception machine. */
export class ReceptionDeviceError extends Error {
  constructor() {
    super(
      'This computer is set up as a reception station, so prescriptions are ' +
        'not stored here. Write the script on the doctor’s own device.',
    );
    this.name = 'ReceptionDeviceError';
  }
}
