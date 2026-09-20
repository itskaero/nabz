/**
 * What this device still needs before it is safe to rely on.
 *
 * WHY A CHECKLIST AND NOT MORE PROMPTS
 * ------------------------------------
 * Setting this app up is a sequence of things a doctor is asked about at the
 * worst possible moment, one at a time, by whatever happens to notice:
 *
 *   - the device role is asked on first run and never again;
 *   - the name and registration are a Settings field nothing insists on, and
 *     the first sign they are missing is a printed script with a blank top;
 *   - the first backup is prompted by `backupReminderDays` firing SEVEN DAYS
 *     AFTER records already exist -- i.e. the moment you discover that the
 *     password you have to invent is unrecoverable is the moment you have
 *     something to lose;
 *   - the pairing code is only mentioned by the screen that already failed.
 *
 * Each of those is a nag. Together they are a setup procedure nobody wrote
 * down. This writes it down, in one place, before there is anything to lose.
 *
 * WHY `why` IS NOT OPTIONAL
 * -------------------------
 * A checklist of "required field" is a form. "So a pharmacist can check who
 * prescribed" is a reason, and a doctor who has read the reason does not need
 * to be reminded again. Every step carries one.
 *
 * Framework-free and pure: given the facts, the steps. Which makes the two
 * things that actually matter testable -- that a blocking step cannot be
 * satisfied by a name made of spaces, and that a reception station is never
 * asked for a PMDC number it has no use for.
 */
import type { DeviceRole } from './deviceRole.ts';

export type StepId =
  | 'device-role'
  | 'doctor-identity'
  | 'content-pack'
  | 'encryption'
  | 'clinic-pairing'
  | 'first-backup';

/**
 * How hard to push.
 *
 * `blocking` means the app should not open on a blank script yet -- not that
 * anything is disabled. `attention` is a real gap that must stay visible and
 * must never stand between a doctor and a prescription. `done-by-default` is
 * a row that is already green and is here to say so: a checklist that only
 * lists problems reads as a list of failures.
 */
export type Severity = 'blocking' | 'attention' | 'done-by-default';

/** Where the fix lives. Named here so this file need not know about views. */
export type SetupDestination = 'settings' | 'clinic' | 'builder';

export interface SetupStep {
  id: StepId;
  title: string;
  /** Why it matters, in the doctor's terms. Never "required field". */
  why: string;
  done: boolean;
  severity: Severity;
  action?: { label: string; go: SetupDestination };
}

export interface SetupFacts {
  /** Null until somebody says what this machine is for. */
  deviceRole: DeviceRole | null;
  /**
   * Whether any prescription has ever been saved here.
   *
   * It settles the device-role question for an install that predates the
   * setting: a machine with records on it is obviously the doctor's, and
   * `deviceRole.ts` already treats an unclassified device as consulting for
   * exactly that reason. Without this, everyone who updates the app would be
   * sent to a checklist demanding an answer their records already gave.
   */
  hasRecords: boolean;
  doctorName: string;
  registrationNumber: string;
  /** The pack in use. Every install ships one, so this is normally set. */
  packId: string;
  /** When a backup was last WRITTEN. Not when a password was typed. */
  lastBackupAt: string | undefined;
  /** `profile.clinic.enabled` */
  clinicMode: boolean;
  /** The stored pairing code, or null. */
  pairedCode: string | null;
  /** `hasWebCrypto()` -- false on a plain-HTTP LAN origin. */
  canEncrypt: boolean;
  /**
   * `secureContextProblem()`, quoted rather than reworded: it is already the
   * best sentence in the product about what a plain origin costs, and two
   * wordings of one fact is how they drift.
   */
  cryptoProblem: string | null;
}

/** Non-empty after trimming. A name of spaces is not a name. */
const filled = (s: string) => s.trim().length > 0;

/**
 * The steps, in the order they are worth doing.
 *
 * Deliberately NOT sorted by severity or by whether they are done: a list
 * that rearranges itself as you tick it off is a list you have to re-read
 * every time you look at it. Severity is said in colour and in words.
 */
export function setupSteps(facts: SetupFacts): SetupStep[] {
  const steps: SetupStep[] = [];
  const reception = facts.deviceRole === 'reception';

  steps.push({
    id: 'device-role',
    title: 'What this computer is for',
    why:
      'A front-desk computer is never allowed to hold a prescription, an ' +
      'examination or a growth record. Saying which this machine is decides ' +
      'what can be stored on it at all.',
    done: facts.deviceRole !== null || facts.hasRecords,
    severity: 'blocking',
    /*
      Settings, not a picker: this row is only ever outstanding on a fresh
      install, where the full-screen question is already in front of the
      doctor. Afterwards the answer is changed in Settings like any other
      setting, and there is nothing to send them back to.
    */
    action: { label: 'Change', go: 'settings' },
  });

  /*
    Skipped at the front desk, which writes no scripts: asking a receptionist
    for the doctor's registration number is asking for a number they have no
    use for and may not have.
  */
  if (!reception) {
    steps.push({
      id: 'doctor-identity',
      title: 'Your name and registration',
      why:
        'Both print at the top of every script. The registration number is ' +
        'how a pharmacist checks who prescribed, and a script without one is ' +
        'a script they are entitled to refuse.',
      done: filled(facts.doctorName) && filled(facts.registrationNumber),
      severity: 'blocking',
      action: { label: 'Fill in', go: 'settings' },
    });

    steps.push({
      id: 'content-pack',
      title: 'A content pack is active',
      why:
        'The medicines, advice sentences and examination chips you prescribe ' +
        'from. One ships with the app, so this is already done — you can edit ' +
        'it or install another whenever you like.',
      done: filled(facts.packId),
      severity: 'done-by-default',
      action: { label: 'Open builder', go: 'builder' },
    });
  }

  /*
    Shown only when it FAILS. On a normal install this is a fact about the
    browser that nobody needs told, and a permanently green "your browser
    supports cryptography" row is the kind of thing that teaches people to
    stop reading checklists.
  */
  if (!facts.canEncrypt) {
    steps.push({
      id: 'encryption',
      title: 'This device cannot encrypt anything',
      why:
        facts.cryptoProblem ??
        'The browser has switched off encrypted backup, the PIN and offline use.',
      done: false,
      severity: 'attention',
    });
  }

  if (facts.clinicMode) {
    steps.push({
      id: 'clinic-pairing',
      title: 'Connected to the clinic station',
      why: reception
        ? 'The queue lives on the station. Until this computer is paired to ' +
          'it, the front desk has nothing to show and nothing to add to.'
        : 'Today’s queue comes from the station. Unpaired, this device sees ' +
          'an empty waiting list rather than an error.',
      done: facts.pairedCode !== null,
      /*
        Blocking at the front desk, where an unpaired machine does literally
        nothing; an ordinary gap on the doctor's device, where it costs the
        queue and not the consultation. Standing between a doctor and a
        prescription because a queue is not connected would be worse than the
        problem it is complaining about.
      */
      severity: reception ? 'blocking' : 'attention',
      action: { label: 'Pair', go: 'clinic' },
    });
  }

  /*
    The doctor's device only. At the front desk the queue is the station's
    copy as much as this one's; on the consulting device the records exist
    here and nowhere else in the world.
  */
  if (!reception) {
    steps.push({
      id: 'first-backup',
      title: 'A first backup, written',
      why:
        'Every prescription, patient and growth chart lives on this device ' +
        'and nowhere else. Nobody can recover them for you — not the clinic, ' +
        'not us. Do this before there is anything to lose.',
      // Written, not configured. A password that has been typed but never
      // used to produce a file has protected nothing.
      done: facts.lastBackupAt !== undefined,
      severity: 'attention',
      action: { label: 'Back up now', go: 'settings' },
    });
  }

  return steps;
}

/** The ones still outstanding, in the same order. */
export function outstanding(steps: SetupStep[]): SetupStep[] {
  return steps.filter((s) => !s.done);
}

/**
 * Whether the app may open straight onto a blank script.
 *
 * Only the blocking steps count. An unwritten backup keeps its row red for as
 * long as it takes, but it never stands between a doctor and a patient.
 */
export function setupComplete(steps: SetupStep[]): boolean {
  return steps.every((s) => s.done || s.severity !== 'blocking');
}
