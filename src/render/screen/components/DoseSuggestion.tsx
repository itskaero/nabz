/**
 * What `domain/dose.ts` worked out, in words.
 *
 * One component, used by the medication row and by the dose calculator, so the
 * two can never word the same arithmetic differently -- which is the failure
 * mode that makes a doctor stop trusting both.
 *
 * THE RULE THIS COMPONENT EXISTS TO HOLD. A millilitre figure appears only
 * when a structured `concentration` produced it. There is no fallback, no
 * default strength, no "probably 125 mg/5 ml". When the volume cannot be
 * computed the screen says which fact is missing, because a parent who is told
 * "give 3 ml" of the wrong bottle gets a different dose than the one on the
 * script.
 */
import type { DosingEntry } from '@domain/pack.ts';
import type { Concentration } from '@domain/dose.ts';
import { bandFits, doseFor, mgText, mlText, suggestRounded, volumeFor } from '@domain/dose.ts';

export interface DoseSuggestionProps {
  entry: DosingEntry;
  // `| undefined` for the same reason `DoseInput` spells it out: a patient
  // with no weight recorded is the ordinary case this has to render.
  weightKg?: number | undefined;
  ageDays?: number | undefined;
  /** the strength the patient actually has, if one has been chosen */
  concentration?: Concentration;
  /** that strength as it reads on the bottle, for the sentence */
  strengthLabel?: string;
}

export function DoseSuggestion({
  entry,
  weightKg,
  ageDays,
  concentration,
  strengthLabel,
}: DoseSuggestionProps) {
  const result = doseFor(entry, { weightKg, ageDays });
  const fits = bandFits(entry, { weightKg, ageDays });

  if (!result.ok) {
    // 'not-weight-based' is not a failure: the row states a fixed regimen, and
    // the caller is already printing it. Saying "no dose" under it would be a
    // contradiction on the same line.
    if (result.why === 'not-weight-based') return null;
    return (
      <span className="dose-calc">
        Enter a weight to see this in milligrams.
      </span>
    );
  }

  const { dose } = result;
  const range =
    dose.mgLow === dose.mgHigh
      ? mgText(dose.mgHigh)
      : `${mgText(dose.mgLow).replace(/ mg$/, '')}–${mgText(dose.mgHigh)}`;

  const low = volumeFor(dose.mgLow, concentration);
  const high = volumeFor(dose.mgHigh, concentration);
  const volume =
    low.ok && high.ok ? { low: low.ml, high: high.ml, rounded: suggestRounded(low.ml, high.ml) } : null;

  return (
    <span className="dose-calc">
      <strong className="mono">{range}</strong> at {weightKg} kg
      {dose.mgPerDayHigh !== undefined && (
        <>
          {' '}
          ·{' '}
          {dose.mgPerDayLow === dose.mgPerDayHigh
            ? mgText(dose.mgPerDayHigh)
            : `${mgText(dose.mgPerDayLow ?? 0).replace(/ mg$/, '')}–${mgText(dose.mgPerDayHigh)}`}{' '}
          a day
        </>
      )}
      {volume && (
        <>
          {' — '}
          <strong className="mono">{mlText(volume.rounded.ml)}</strong>
          {strengthLabel ? ` of ${strengthLabel}` : ''}
          {volume.rounded.approximate ? (
            // An exact figure no graduation hits. Saying "about" is the whole
            // difference between a rounding and a number somebody published.
            <span className="src">
              {' '}
              about {mlText(volume.rounded.ml)} — the exact figure is{' '}
              {mlText(volume.high)}
            </span>
          ) : (
            <span className="src">
              {' '}
              anywhere from {mlText(volume.low)} to {mlText(volume.high)}
            </span>
          )}
        </>
      )}
      {/*
        Two different silences, and they must not wear the same words.

        "No bottle chosen yet" is a prompt; "this bottle has no concentration"
        is a refusal. Saying the second when the first is true tells a doctor
        the catalogue is broken, and they stop looking for the control that
        would have answered them.
      */}
      {!volume && !strengthLabel && (
        <span className="src">Choose a strength to see this in millilitres.</span>
      )}
      {!volume && strengthLabel && (
        <span className="src">
          No millilitre figure for {strengthLabel}: it is not a mass per
          millilitre, so there is nothing to divide by.
        </span>
      )}
      {dose.cappedBy && (
        // Never silent. A capped dose the prescriber cannot explain is one
        // they cannot tell apart from the dose they were expecting.
        <span className="src">Capped by {dose.cappedBy}.</span>
      )}
      {entry.drafted && (
        // Louder than "not yet verified", because it is a different claim:
        // nobody has opened the source this row names.
        <span className="src unverified">
          Drafted from standard practice — nobody has checked it against{' '}
          {entry.reference.split(/[—–-]/)[0]?.trim() || 'the reference'} yet.
        </span>
      )}
      {fits === false && (
        <span className="src unverified">
          This row is for {entry.ageBand?.label ?? 'a different band'} — check it
          applies to this patient.
        </span>
      )}
    </span>
  );
}
