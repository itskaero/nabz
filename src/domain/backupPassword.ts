/**
 * The password on the backup file, and how to survive having one.
 *
 * WHAT THIS IS ACTUALLY FOR
 * -------------------------
 * The backup is the only copy of every record there will ever be, and it is
 * encrypted with something the doctor invents and nobody can reset. That is
 * the correct design -- a password anyone could reset is a password the
 * clinic's data is not really protected by -- but it puts a real burden on
 * one person's memory, and the app has so far responded by asking them to
 * type eight characters and wishing them luck.
 *
 * Two small things make that survivable. A suggestion, so the password is not
 * the name of a child or the clinic's phone number; and a printed sheet, so
 * the answer lives in the drawer the clinic already locks rather than in a
 * head that is also running an OPD.
 *
 * WHY THE ALPHABET IS SHORT
 * -------------------------
 * This password will be READ OFF PAPER and typed back in, possibly months
 * later, possibly by somebody else, possibly in bad light. Every character
 * that can be confused for another -- O and 0, I and l and 1, S and 5 -- is a
 * restore that fails for a reason nobody can see. Dropping them costs about
 * half a bit per character and buys a password that can actually be
 * transcribed.
 */

/** 31 characters: the Latin alphabet and the digits, minus the lookalikes. */
const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY346789';

/** Groups of four, because a 16-character run is a 16-character typo. */
const GROUP = 4;
const GROUPS = 4;

/**
 * A password worth writing on a sheet of paper.
 *
 * 16 characters from a 27-character alphabet is about 76 bits, which is far
 * past anything that matters for a file on a memory stick. `getRandomValues`
 * rather than `Math.random`: it is available in every context, including the
 * plain-HTTP origin where `crypto.subtle` is not, and a backup password from
 * a predictable generator is not a backup password.
 *
 * Rejection sampling, not modulo: 256 is not a multiple of 27, so `% 27`
 * would make the first few letters of the alphabet measurably likelier.
 */
export function suggestPassword(): string {
  const out: string[] = [];
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const bytes = new Uint8Array(64);
  let at = bytes.length;
  const next = () => {
    for (;;) {
      if (at >= bytes.length) {
        crypto.getRandomValues(bytes);
        at = 0;
      }
      const b = bytes[at++]!;
      if (b < limit) return ALPHABET[b % ALPHABET.length]!;
    }
  };
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    for (let i = 0; i < GROUP; i++) group += next();
    out.push(group);
  }
  return out.join('-');
}

/** The app's floor. Short, because refusing a doctor's own choice is worse. */
export const MIN_LENGTH = 8;

/**
 * Whether a password is long enough to use, and what to say if not.
 *
 * Deliberately not a strength meter. A meter that calls a passphrase "weak"
 * teaches people to add an exclamation mark, and the thing that actually
 * protects this file is that it never leaves the doctor's own possession.
 */
export function passwordProblem(password: string): string | null {
  if (password.length >= MIN_LENGTH) return null;
  return `At least ${MIN_LENGTH} characters. This is the only thing standing between the backup file and whoever finds it.`;
}
