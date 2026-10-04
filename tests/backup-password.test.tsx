/**
 * @vitest-environment jsdom
 *
 * The password on the backup file, and the sheet that survives it.
 *
 * The backup is the only copy of every record there will ever be, encrypted
 * with something nobody can reset. That is the right design — a password
 * anyone could reset is a password the data is not really protected by — but
 * the app's whole answer to it used to be an eight-character field and a
 * sentence. These cover the two things that make it survivable: a suggestion
 * that can actually be transcribed, and a sheet for the locked drawer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MIN_LENGTH, passwordProblem, suggestPassword } from '@domain/backupPassword.ts';
import { RecoverySheet } from '@render/screen/components/RecoverySheet.tsx';

afterEach(cleanup);

describe('a password worth writing down', () => {
  it('has no character that can be misread off paper', () => {
    // O and 0, I and l and 1, S and 5. Each one is a restore that fails for a
    // reason nobody in the room can see.
    for (let i = 0; i < 200; i++) {
      expect(suggestPassword()).not.toMatch(/[OIL015S2]/i);
    }
  });

  it('comes in groups, because a sixteen-character run is a typo', () => {
    expect(suggestPassword()).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
  });

  it('is different every time, which is the entire point', () => {
    const seen = new Set(Array.from({ length: 200 }, suggestPassword));
    expect(seen.size).toBe(200);
  });

  it('does not lean on the front of the alphabet', () => {
    /*
      `% 27` on a random byte would make the first four letters about 20%
      likelier than the rest, which is a real loss of strength for a file that
      may sit on a memory stick for years. Rejection sampling is what stops it,
      and a distribution test is the only way that mistake ever shows up.
    */
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      for (const ch of suggestPassword().replace(/-/g, '')) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    const values = [...counts.values()];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    // Generous: this is catching a 20% skew, not measuring randomness.
    for (const [ch, n] of counts) {
      expect(Math.abs(n - mean) / mean, ch).toBeLessThan(0.25);
    }
  });

  it('is long enough to be accepted by the app that suggested it', () => {
    expect(passwordProblem(suggestPassword())).toBeNull();
  });
});

describe('what the app refuses', () => {
  it('says what is wrong and why, rather than greying a button out', () => {
    const why = passwordProblem('short');
    expect(why).toContain(String(MIN_LENGTH));
    expect(why).toContain('whoever finds it');
  });

  it('accepts a doctor’s own choice once it is long enough', () => {
    // Not a strength meter: a meter that calls a passphrase "weak" teaches
    // people to add an exclamation mark.
    expect(passwordProblem('correct horse battery staple')).toBeNull();
    expect(passwordProblem('12345678')).toBeNull();
  });
});

describe('the recovery sheet', () => {
  const sheet = () =>
    render(
      <RecoverySheet
        password="ABCD-EFGH-JKMN-PQRT"
        doctorName="Dr A. Tahir"
        clinicName="Shifa Clinic"
        onClose={() => {}}
      />,
    );

  it('puts the password on the page, in full', () => {
    sheet();
    expect(screen.getByText('ABCD-EFGH-JKMN-PQRT')).toBeTruthy();
  });

  it('says whose it is and when it was written', () => {
    // A sheet found in two years needs to say whether it is still the current
    // one, and a clinic with two doctors has two of these.
    sheet();
    const who = screen.getByText(/Shifa Clinic/);
    expect(who.textContent).toContain('Dr A. Tahir');
    expect(who.textContent).toContain(new Date().toISOString().slice(0, 10));
  });

  it('says the two things a person holding it has to know', () => {
    sheet();
    const text = screen.getByRole('dialog').textContent ?? '';
    // Keep it away from the backup file itself ...
    expect(text).toMatch(/not with the\s+backup file/);
    // ... and there is no way back if it is lost.
    expect(text).toMatch(/Nobody can reset it/);
  });

  it('offers to print rather than to download', () => {
    // A PDF of a password in the Downloads folder of the device being backed
    // up protects nothing.
    sheet();
    expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('survives a browser with no print at all', () => {
    // Some webviews have none, and jsdom throws. The sheet is readable on
    // screen either way, so this must not take the app down.
    sheet();
    expect(() => screen.getByRole('button', { name: 'Print' }).click()).not.toThrow();
  });
});
