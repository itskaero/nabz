/**
 * The hero section: the bilingual medication row (DESIGN.md 5).
 *
 * This is the only screen in the app that is allowed to be bold, because the
 * EN|UR row locked to one drug is the only thing this product does that nothing
 * else does. Everything around it stays quiet.
 *
 * Three rules visible in this file:
 *  - the drug search autocompletes the NAME, and offers a strength as a
 *    suggestion, but writes no clinical value by itself (PRODUCT.md 11);
 *  - an unknown drug is typed and accepted -- the doctor is never blocked;
 *  - a cited dose appears as a suggestion WITH its source, and unverified seed
 *    rows say so, because a citation the pack author has not checked must not
 *    wear the same authority as one they have (PRODUCT.md 11a).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MedicationLine } from '@domain/prescription.ts';
import { composeSig, weeklyOnlyViolation } from '@domain/sig.ts';
import type { DosingEntry } from '@domain/pack.ts';
import { packIndex } from '@data/packs/index.ts';
import type { RepertoireEntry } from '@domain/repertoire.ts';
import { suggestDrugs } from '@domain/repertoire.ts';
import * as db from '@storage/db.ts';
import { languageFor } from '@config/doctorProfile.ts';
import { useStore, newId } from '../store.tsx';
import { SigEditor } from '../components/SigEditor.tsx';
import { DoseSuggestion } from '../components/DoseSuggestion.tsx';
import { StrengthSelect } from '../components/StrengthSelect.tsx';

/**
 * The dose text a citation shows. `mgPerKg` (weight-based, mostly paediatric)
 * takes priority; `fixedDose` (a fixed adult regimen -- or, for a row like
 * warfarin or insulin, a plainly-worded refusal to suggest one) is next;
 * `maxPerDay` alone is the rare case of a true ceiling with no starting dose.
 * One function so the on-screen text and the printed citation can never drift
 * apart from each other.
 */
function citedDoseText(cited: DosingEntry): string {
  if (cited.mgPerKg) {
    // The band where the row has one. Printing only the bottom of 10-15 mg/kg
    // under-doses on paper and is not what any source actually says.
    const perKg =
      cited.mgPerKgHigh !== undefined
        ? `${cited.mgPerKg}–${cited.mgPerKgHigh}`
        : `${cited.mgPerKg}`;
    return `${perKg} mg/kg per dose${cited.perDoses ? `, ${cited.perDoses}× a day` : ''}`;
  }
  return cited.fixedDose ?? cited.maxPerDay ?? '';
}

export function MedicationsSection() {
  const { rx, pack, phrases: packs, profile, setMedications } = useStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  /** which card is swiped open, and the pointer that is dragging one */
  const [swiped, setSwiped] = useState<string | null>(null);
  /** which suggestion the arrows are on; -1 means "none, Enter adds as typed" */
  const [cursor, setCursor] = useState(-1);
  const drag = useRef<{ id: string; x: number } | null>(null);
  const [repertoire, setRepertoire] = useState<RepertoireEntry[]>([]);

  // The doctor's own prescribing, ranked by how often they actually write it.
  // This is the real answer to a rival's 75,000-row catalogue: relevance beats
  // volume when the task is finding a drug in two keystrokes.
  useEffect(() => {
    void db.suggest('drug', '', 500).then((rows) =>
      setRepertoire(rows.map((r) => ({ text: r.text, count: r.count, lastUsed: r.lastUsed }))),
    );
  }, []);
  const index = useMemo(() => packIndex(pack), [pack]);
  const lang = languageFor(profile, 'medications');

  const matches = useMemo(
    () => suggestDrugs(query, pack.formularySeed, repertoire),
    [pack.formularySeed, repertoire, query],
  );

  const addLine = (drug: MedicationLine['drug']) => {
    const line: MedicationLine = {
      id: newId(),
      drug,
      sig: {
        templateId: drug.form === 'tablet' || drug.form === 'capsule'
          ? 'sig.oral.solid'
          : 'sig.oral.liquid',
        // Zero dose with no frequency: the row renders as incomplete until the
        // doctor fills it. This is the "never silently fill" rule made visible.
        dose: { value: 0, unit: drug.form === 'tablet' ? 'tablet' : 'ml' },
        frequency: '',
        slots: { ...(pack.sigDefaults?.slots ?? {}) },
      },
    };
    setMedications([...rx.medications, line]);
    setQuery('');
    setEditing(line.id);
  };

  /**
   * Take a suggestion, whole.
   *
   * One function for the click and the Enter key, because the two used to be
   * different code and only one of them carried the strength, the form and the
   * DRAP number across.
   */
  const addHit = (hit: (typeof matches)[number]) => {
    setCursor(-1);
    addLine(
      hit.entry
        ? {
            brand: hit.entry.brand,
            generic: hit.entry.generic,
            ...(hit.entry.strength ? { strength: hit.entry.strength } : {}),
            ...(hit.entry.form ? { form: hit.entry.form } : {}),
            ...(hit.entry.drapRegNo ? { drapRegNo: hit.entry.drapRegNo } : {}),
          }
        : { raw: hit.label },
    );
  };

  const update = (id: string, patch: Partial<MedicationLine>) =>
    setMedications(rx.medications.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const editingLine = rx.medications.find((m) => m.id === editing) ?? null;

  return (
    <section>
      <div className="card">
        <h2>Add a medicine</h2>
        <div className="compose">
          {/*
            A COMBOBOX, which it was not.

            It was a plain input with a list of buttons under it. The list was
            unreachable from the keyboard in any useful way — Tab went to "Add
            as typed" first and then into eight suggestions one at a time — and
            Enter added the TYPED TEXT as a raw drug even when the right
            catalogue row was sitting first in the list. A raw drug carries no
            generic, and the dosing table joins on generic, so the fastest path
            through this field produced the one record that can never get a
            dose suggestion.

            Arrow keys now walk the list, Enter takes whatever is highlighted,
            and Enter with nothing highlighted still adds as typed — because an
            unknown medicine must stay one keystroke away (PRODUCT.md: the
            doctor is never blocked).
          */}
          <input
            value={query}
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls="drug-suggestions"
            aria-autocomplete="list"
            {...(cursor >= 0 && matches[cursor]
              ? { 'aria-activedescendant': `drug-opt-${cursor}` }
              : {})}
            placeholder="Brand or generic — type anything"
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && matches.length > 0) {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, matches.length - 1));
              } else if (e.key === 'ArrowUp' && matches.length > 0) {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, -1));
              } else if (e.key === 'Escape') {
                setCursor(-1);
              } else if (e.key === 'Enter') {
                const hit = cursor >= 0 ? matches[cursor] : undefined;
                if (hit) {
                  e.preventDefault();
                  addHit(hit);
                } else if (query.trim()) {
                  e.preventDefault();
                  addLine({ raw: query.trim() });
                }
              }
            }}
          />
          <button
            className="btn"
            disabled={!query.trim()}
            onClick={() => addLine({ raw: query.trim() })}
          >
            Add as typed
          </button>
          {matches.length > 0 && (
            <div className="suggestions" id="drug-suggestions" role="listbox" aria-label="Medicines">
              <ul>
                {matches.map((hit, i) => (
                  <li key={`${hit.label}-${hit.entry?.strength ?? ''}-${i}`}>
                    <button
                      id={`drug-opt-${i}`}
                      role="option"
                      aria-selected={i === cursor}
                      data-cursor={i === cursor ? 'true' : undefined}
                      className="suggestion"
                      // The pointer and the arrow keys drive the same highlight,
                      // so there is never more than one highlighted row.
                      onPointerEnter={() => setCursor(i)}
                      onClick={() => addHit(hit)}
                    >
                      <span className="prov">
                        {hit.source === 'repertoire'
                          ? `yours · ${hit.used}×`
                          : (hit.entry?.provenance ?? '')}
                      </span>
                      <strong>{hit.label}</strong>{' '}
                      {hit.entry && (
                        <span className="generic">
                          ({hit.entry.generic}
                          {hit.entry.strength ? ` ${hit.entry.strength}` : ''})
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="hint">
          {matches.length > 0 && (
            <>
              <kbd>↓</kbd> to pick from the catalogue, <kbd>↵</kbd> to add what
              you typed.{' '}
            </>
          )}
          Every medicine works — type anything and press Add. The list shows what
          you prescribe most first, then the checked catalogue.
        </p>
      </div>

      {rx.medications.length === 0 && (
        <p className="empty">No medicines on this script yet.</p>
      )}

      {rx.medications.map((line, i) => {
        const primary = composeSig(line, lang.primary, packs);
        const secondary = lang.secondary ? composeSig(line, lang.secondary, packs) : null;
        const dosing: DosingEntry[] =
          index.dosingByGeneric.get((line.drug.generic ?? '').toLowerCase()) ?? [];
        const cited = dosing[0];
        const weeklyWarning = weeklyOnlyViolation(line, index.dosingByGeneric);
        /*
          Which bottle is in the room.

          One generic is dispensed at several strengths -- paracetamol at 100,
          120, 200 and 250 mg per 5 ml in this catalogue alone -- and 150 mg is
          7 ml of the weakest and 3 ml of the strongest. Offering the strengths
          here, on the row, is the single most useful thing on a paediatric
          script: it is the difference between a number the parent can measure
          and one they have to work out from a bottle they are holding and a
          sheet they are not.
        */
        const strengths = index.strengthsByGeneric.get((line.drug.generic ?? '').toLowerCase()) ?? [];
        const chosenStrength = strengths.find((e) => e.strength === line.drug.strength);

        return (
          /*
            SWIPE TO REVEAL REMOVE.

            The × sits in the top-right corner of the card, which on a 390px
            phone held one-handed is the furthest point from the thumb and a
            20px target. React Bits' Swipe Row is the answer the whole mobile
            world already settled on: drag the card aside and a full-height
            Remove appears under it.

            It reveals a BUTTON rather than removing on release. A swipe that
            deletes is a swipe that deletes by accident, and this is a
            prescription — two deliberate actions, or none. The × stays for the
            mouse and the keyboard, so nothing is reachable only by gesture.
          */
          <article
            className="med"
            key={line.id}
            data-swiped={swiped === line.id ? 'true' : undefined}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') return;
              drag.current = { id: line.id, x: e.clientX };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.id !== line.id) return;
              const dx = e.clientX - d.x;
              if (dx < -44) {
                setSwiped(line.id);
                drag.current = null;
              } else if (dx > 20) {
                setSwiped(null);
                drag.current = null;
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <div className="med-reveal" aria-hidden={swiped !== line.id}>
              <button
                className="btn danger"
                tabIndex={swiped === line.id ? 0 : -1}
                onClick={() => {
                  setSwiped(null);
                  setMedications(rx.medications.filter((m) => m.id !== line.id));
                }}
              >
                Remove
              </button>
            </div>
            <div className="med-head">
              <span className="brand-name">
                {line.drug.brand || line.drug.generic || line.drug.raw}
              </span>
              {line.drug.brand && line.drug.generic && (
                <span className="generic">{line.drug.generic}</span>
              )}
              {line.drug.strength && <span className="strength">{line.drug.strength}</span>}
              <button
                className="mini"
                aria-label="Remove medicine"
                onClick={() => setMedications(rx.medications.filter((m) => m.id !== line.id))}
              >
                ×
              </button>
            </div>

            {weeklyWarning && (
              <div className="warn-box weekly-warn" role="alert">
                <strong>Stop and check the frequency.</strong> {weeklyWarning}
              </div>
            )}

            <div className="med-tracks">
              <div className="track en">
                <span className="track-label">{lang.primary}</span>
                {primary.complete ? (
                  primary.plain
                ) : (
                  <span className="incomplete">
                    Tap below to set {primary.missing.join(', ') || 'the instructions'}
                  </span>
                )}
              </div>
              {secondary && (
                <div className="track ur" dir="rtl" lang="ur">
                  <span className="track-label">{lang.secondary}</span>
                  {secondary.complete ? (
                    secondary.plain
                  ) : (
                    <span className="incomplete">—</span>
                  )}
                </div>
              )}
            </div>

            {strengths.length > 1 && (
              <StrengthSelect
                options={strengths}
                value={line.drug.strength}
                onChange={(strength) => update(line.id, { drug: { ...line.drug, strength } })}
                entry={cited}
                weightKg={rx.patient.weightKg}
                ageDays={rx.patient.ageDays}
              />
            )}

            <div className="med-slots">
              <button className="slot" data-empty={!line.sig.dose.value} onClick={() => setEditing(line.id)}>
                dose{' '}
                <span className="val">
                  {line.sig.dose.value ? `${line.sig.dose.value} ${line.sig.dose.unit}` : '—'}
                </span>
              </button>
              <button className="slot" data-empty={!line.sig.frequency} onClick={() => setEditing(line.id)}>
                how often{' '}
                <span className="val">
                  {packs.en.vocab.frequency?.[line.sig.frequency] ?? '—'}
                </span>
              </button>
              <button className="slot" data-empty={!line.sig.timing} onClick={() => setEditing(line.id)}>
                when{' '}
                <span className="val">{packs.en.vocab.timing?.[line.sig.timing ?? ''] ?? '—'}</span>
              </button>
              <button className="slot" data-empty={!line.sig.duration} onClick={() => setEditing(line.id)}>
                days{' '}
                <span className="val">
                  {line.sig.duration ? `${line.sig.duration.value} ${line.sig.duration.unit}` : '—'}
                </span>
              </button>
            </div>

            {cited && (
              <div className="cite">
                <div>
                  {citedDoseText(cited)}
                  {cited.indication ? ` — ${cited.indication}` : ''}
                  {/*
                    The arithmetic used to be `cited.mgPerKg * weightKg` right
                    here, printing milligrams and stopping -- leaving the
                    millilitres, which is the number a parent measures, to be
                    done in somebody's head. It now comes from `domain/dose.ts`
                    through one shared component, so the dose calculator and
                    this row cannot word the same sum two ways.
                  */}
                  <DoseSuggestion
                    entry={cited}
                    weightKg={rx.patient.weightKg}
                    ageDays={rx.patient.ageDays}
                    {...(chosenStrength?.concentration
                      ? { concentration: chosenStrength.concentration }
                      : {})}
                    {...(line.drug.strength ? { strengthLabel: line.drug.strength } : {})}
                  />
                  <span className="src">
                    {cited.reference}
                    {!cited.verified && (
                      <>
                        {' · '}
                        <span className="unverified">seed entry, not yet verified</span>
                      </>
                    )}
                  </span>
                  <span className="src">Suggestion — confirm before signing.</span>
                </div>
                <button
                  className="icon-btn"
                  onClick={() =>
                    update(line.id, {
                      citedSuggestion: {
                        text: citedDoseText(cited),
                        reference: cited.reference,
                      },
                    })
                  }
                  aria-pressed={Boolean(line.citedSuggestion)}
                >
                  {line.citedSuggestion ? 'On the script' : 'Print this citation'}
                </button>
              </div>
            )}
            <span className="mono" style={{ display: 'none' }}>
              {i}
            </span>
          </article>
        );
      })}

      {editingLine && (
        <SigEditor
          line={editingLine}
          pack={pack}
          packs={packs}
          onClose={() => setEditing(null)}
          onSave={(sig) => {
            update(editingLine.id, { sig });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
