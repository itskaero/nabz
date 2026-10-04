/**
 * The dose calculator: weight, drug, bottle, millilitres.
 *
 * Same two rules as every other module panel. Everything numeric comes from
 * `domain/dose.ts`, and this panel shows a number and stops -- it never writes
 * a medication line, never sets a frequency, and never picks a drug for
 * anybody. A doctor who wants it on the script taps the button that records
 * it, and the record carries the weight and the strength it was computed from
 * so that a figure read back an hour later can be checked rather than trusted.
 *
 * WHY IT EXISTS SEPARATELY FROM THE MEDICATION ROW. The row answers "what am I
 * prescribing"; this answers "how much of the bottle in your hand". The second
 * question gets asked about drugs that are not on this script at all -- the
 * paracetamol the mother already has at home, the dose a colleague is asking
 * about down the corridor -- and making it a tool rather than a field is what
 * keeps that from requiring a fake prescription to answer.
 */
import { useMemo, useState } from 'react';
import type { FormularyEntry } from '@domain/pack.ts';
import { doseFor, mlText, suggestRounded, volumeFor } from '@domain/dose.ts';
import { packIndex } from '@data/packs/index.ts';
import { useStore, newId } from '../store.tsx';
import { DoseSuggestion } from './DoseSuggestion.tsx';

export function DoseCalcPanel() {
  const { rx, pack, setCalculations } = useStore();
  const index = useMemo(() => packIndex(pack), [pack]);

  const generics = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of pack.dosing) names.set(row.generic.toLowerCase(), row.generic);
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [pack.dosing]);

  /*
    Open on something that computes.

    Alphabetical order puts Albendazole first, and albendazole is a fixed
    single dose -- so the calculator opened showing a drug it has nothing to
    calculate for, which reads as a broken tool rather than as a correct
    refusal. The default is the first generic that is actually weight-based.
  */
  const [generic, setGeneric] = useState(
    generics.find((g) =>
      (pack.dosing.find((r) => r.generic === g && r.mgPerKg !== undefined) ? true : false),
    ) ??
      generics[0] ??
      '',
  );
  const [weight, setWeight] = useState(rx.patient.weightKg ? String(rx.patient.weightKg) : '');
  const [strength, setStrength] = useState<string>('');

  const rows = index.dosingByGeneric.get(generic.toLowerCase()) ?? [];
  const strengths: FormularyEntry[] = index.strengthsByGeneric.get(generic.toLowerCase()) ?? [];
  const chosen = strengths.find((e) => e.strength === strength);
  const weightKg = Number(weight) > 0 ? Number(weight) : undefined;

  const record = (rowIndex: number) => {
    const entry = rows[rowIndex];
    if (!entry || weightKg === undefined) return;
    const result = doseFor(entry, { weightKg, ageDays: rx.patient.ageDays });
    if (!result.ok) return;
    const ml = chosen?.concentration
      ? volumeFor(result.dose.mgHigh, chosen.concentration)
      : { ok: false as const, why: 'no-concentration' as const };
    const low = chosen?.concentration
      ? volumeFor(result.dose.mgLow, chosen.concentration)
      : { ok: false as const, why: 'no-concentration' as const };
    const rounded = ml.ok && low.ok ? suggestRounded(low.ml, ml.ml) : null;

    /*
      Recorded in MILLIGRAMS, with the millilitres in the method line.

      Milligrams are the dose; millilitres are how this particular bottle
      delivers it. Storing the volume as the value would make the number
      meaningless the moment the family comes back with a different strength,
      and a stale volume reads exactly like a current one.
    */
    setCalculations([
      ...(rx.calculations ?? []),
      {
        id: newId(),
        moduleId: 'dosecalc',
        label: `${entry.generic}${entry.indication ? ` (${entry.indication})` : ''}`,
        value: Math.round(result.dose.mgHigh),
        unit: 'mg per dose',
        method: [
          `${entry.mgPerKg}${entry.mgPerKgHigh !== undefined ? `–${entry.mgPerKgHigh}` : ''} mg/kg`,
          rounded ? `${mlText(rounded.ml)} of ${chosen?.strength}` : 'no volume — strength not set',
          entry.reference,
        ].join(' · '),
        inputs: {
          weightKg,
          strength: chosen?.strength ?? 'none chosen',
          ...(rx.patient.ageDays !== undefined ? { ageDays: rx.patient.ageDays } : {}),
        },
        computedAt: new Date().toISOString(),
      },
    ]);
  };

  if (generics.length === 0) {
    return <p className="empty">This pack carries no dosing rows to calculate from.</p>;
  }

  return (
    <section className="card">
      <h2>Dose calculator</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Milligrams from the weight, millilitres from the bottle. Every figure is
        a suggestion with its source attached — confirm it before you write it.
      </p>

      <div className="num-row" style={{ margin: '12px 0 10px' }}>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="dc-generic">Medicine</label>
          <select
            id="dc-generic"
            value={generic}
            onChange={(e) => {
              setGeneric(e.target.value);
              // The strength belongs to the old drug. Carrying it over would
              // divide this dose by the last drug's concentration.
              setStrength('');
            }}
          >
            {generics.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="field num" style={{ flex: 1 }}>
          <label htmlFor="dc-weight">Weight (kg)</label>
          <input
            id="dc-weight"
            inputMode="decimal"
            value={weight}
            placeholder="e.g. 10"
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>

      {strengths.length > 0 && (
        <div className="strength-switch" style={{ marginBottom: 10 }}>
          <span className="track-label">which bottle</span>
          {strengths.map((e) => (
            <button
              key={e.strength}
              className="chip"
              aria-pressed={strength === e.strength}
              onClick={() => setStrength(strength === e.strength ? '' : (e.strength ?? ''))}
            >
              {e.strength}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 && <p className="empty">No cited dose for {generic} in this pack.</p>}

      {rows.map((entry, i) => (
        <div className="cite" key={`${entry.indication ?? ''}-${entry.ageBand?.label ?? ''}-${i}`}>
          <div>
            {entry.indication ? <strong>{entry.indication}</strong> : null}
            {entry.ageBand ? <span className="meta"> · {entry.ageBand.label}</span> : null}
            <span className="meta"> · {entry.route}</span>
            <br />
            <DoseSuggestion
              entry={entry}
              weightKg={weightKg}
              ageDays={rx.patient.ageDays}
              {...(chosen?.concentration ? { concentration: chosen.concentration } : {})}
              {...(chosen?.strength ? { strengthLabel: chosen.strength } : {})}
            />
            {entry.fixedDose && <span className="src">{entry.fixedDose}</span>}
            {entry.maxPerDay && <span className="src">Maximum: {entry.maxPerDay}</span>}
            {entry.note && <span className="src">{entry.note}</span>}
            <span className="src">
              {entry.reference}
              {!entry.verified && (
                <>
                  {' · '}
                  <span className="unverified">not yet signed off</span>
                </>
              )}
            </span>
          </div>
          {/*
            Nothing to record for a fixed-dose row: there is no arithmetic,
            and a button that would only ever copy the row's own text onto the
            script is a prescription wearing a calculator's clothes. A greyed
            button with no reason is the other failure, so the one that does
            appear says why it is off.
          */}
          {entry.mgPerKg !== undefined && (
            <button
              className="icon-btn"
              disabled={weightKg === undefined}
              title={weightKg === undefined ? 'Enter a weight first' : undefined}
              onClick={() => record(i)}
            >
              Record on this script
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
