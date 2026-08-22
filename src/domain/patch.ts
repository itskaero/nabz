/**
 * Partial updates that can also CLEAR a field.
 *
 * `exactOptionalPropertyTypes` is on, and deliberately: for clinical data,
 * "this field was never filled in" and "this field was set to nothing" are
 * different facts and the compiler should not let them blur. The cost is that a
 * UI cannot simply assign `undefined` to clear an input, which is exactly what
 * a UI needs to do. This is the seam.
 *
 * Lives on its own rather than inside prescription.ts because it is not about
 * prescriptions: the pack builder clears an optional strength on a formulary
 * row and an optional age band on a dosing row through the same helper.
 */

export type Patch<T> = { [K in keyof T]?: T[K] | undefined };

/**
 * Apply a patch, treating `undefined` as "remove this field".
 *
 * Deleting the key rather than storing an explicit `undefined` keeps the record
 * and its JSON export saying the same thing — `{"timing": undefined}` does not
 * survive `JSON.stringify`, so a stored object and its exported form would
 * otherwise disagree about whether the field was ever there.
 */
export function applyPatch<T extends object>(base: T, patch: Patch<T>): T {
  const next = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as T;
}
