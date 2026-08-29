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
import { useEffect, useMemo, useState } from 'react';
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
    return `${cited.mgPerKg} mg/kg per dose${cited.perDoses ? `, ${cited.perDoses}× a day` : ''}`;
  }
  return cited.fixedDose ?? cited.maxPerDay ?? '';
}

export function MedicationsSection() {
  const { rx, pack, phrases: packs, profile, setMedications } = useStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
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

  const update = (id: string, patch: Partial<MedicationLine>) =>
    setMedications(rx.medications.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const editingLine = rx.medications.find((m) => m.id === editing) ?? null;

  return (
    <section>
      <div className="card">
        <h2>Add a medicine</h2>
        <div className="compose">
          <input
            value={query}
            placeholder="Brand or generic — type anything"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                addLine({ raw: query.trim() });
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
            <div className="suggestions">
              <ul>
                {matches.map((hit, i) => (
                  <li key={`${hit.label}-${hit.entry?.strength ?? ''}-${i}`}>
                    <button
                      className="suggestion"
                      onClick={() =>
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
                        )
                      }
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

        return (
          <article className="med" key={line.id}>
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
                  {rx.patient.weightKg && cited.mgPerKg ? (
                    <>
                      {' '}
                      (
                      <span className="mono">
                        {(cited.mgPerKg * rx.patient.weightKg).toFixed(0)} mg
                      </span>{' '}
                      at {rx.patient.weightKg} kg)
                    </>
                  ) : null}
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
