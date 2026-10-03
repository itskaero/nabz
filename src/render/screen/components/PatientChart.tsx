/**
 * One patient, over time.
 *
 * The rail-and-timeline shape Canvas Medical and Elation Health both use, and
 * which the grouped sidebar in this app already sets up: sections on the left,
 * the thing itself beside them.
 *
 * Almost all of it is DERIVED. `domain/chart.ts` projects the visits and the
 * medication history out of saved prescriptions, so opening a chart reads the
 * encounter store and nothing else -- there is no second copy of a child's
 * medications to fall out of step with the first.
 *
 * The two things that are not derived are allergies and the problem list,
 * because they are facts that outlive a visit (domain/patientClinical.ts), and
 * this is where they are edited.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * Nothing here writes to the prescription being composed. Opening a chart is
 * reading; putting something from it onto today's script is a separate,
 * explicit act through the refill path, which still warns that the patient
 * block is not copied. That is PRODUCT.md 3.4 and it is why this component
 * takes an `onOpenEncounter` callback rather than reaching into the store.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Prescription } from '@domain/prescription.ts';
import type { PatientRecord } from '@domain/patient.ts';
import type { AllergyFact, PatientClinical, ProblemFact } from '@domain/patientClinical.ts';
import { emptyClinical } from '@domain/patientClinical.ts';
import type { ChartMedication, PatientChart as Chart } from '@domain/chart.ts';
import { allergyDisagreements, buildChart } from '@domain/chart.ts';
import { patientLabel } from '@domain/patient.ts';
import * as db from '@storage/db.ts';

type SectionId = 'allergies' | 'problems' | 'medications' | 'visits';

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'allergies', label: 'Allergies' },
  { id: 'problems', label: 'Problems' },
  { id: 'medications', label: 'Medications' },
  { id: 'visits', label: 'Visits' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PatientChart({
  patientId,
  onOpenEncounter,
  onClose,
}: {
  patientId: string;
  onOpenEncounter?: (rx: Prescription) => void;
  onClose?: () => void;
}) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [clinical, setClinical] = useState<PatientClinical | null>(null);
  const [encounters, setEncounters] = useState<Prescription[] | null>(null);
  const [section, setSection] = useState<SectionId>('allergies');
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, c, rows] = await Promise.all([
        db.getPatient(patientId),
        db.getPatientClinical(patientId),
        db.patientHistory(patientId),
      ]);
      if (cancelled) return;
      setRecord(p ?? null);
      setClinical(c ?? null);
      setEncounters(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const chart: Chart | null = useMemo(
    () => (encounters ? buildChart(patientId, encounters) : null),
    [patientId, encounters],
  );

  const write = useCallback(
    async (next: PatientClinical) => {
      setClinical(next);
      try {
        await db.savePatientClinical(next);
        setRefusal(null);
      } catch (err) {
        // A reception station refuses outright. Say so rather than leaving an
        // edit on screen that was never written down.
        setRefusal(err instanceof Error ? err.message : 'That could not be saved.');
        setClinical((await db.getPatientClinical(patientId)) ?? null);
      }
    },
    [patientId],
  );

  const base = clinical ?? emptyClinical(patientId);

  if (!encounters) return <p className="empty">Opening the chart…</p>;

  return (
    <div className="chart">
      <header className="chart-head">
        <div style={{ minWidth: 0 }}>
          <h2>{record ? patientLabel(record) : 'Patient'}</h2>
          <p className="chart-span">
            {chart?.firstSeen
              ? `${chart.visits.length} visit${chart.visits.length === 1 ? '' : 's'} · first seen ${chart.firstSeen}`
              : 'No visits recorded on this device'}
          </p>
        </div>
        {onClose && (
          <button className="btn quiet" onClick={onClose}>
            Close
          </button>
        )}
      </header>

      {refusal && (
        <div className="warn-box" role="alert">
          <strong>Not saved.</strong>
          {refusal}
        </div>
      )}

      <div className="chart-body">
        <nav className="chart-rail" aria-label="Chart sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className="chart-rail-item"
              aria-current={section === s.id ? 'true' : undefined}
              onClick={() => setSection(s.id)}
            >
              <span>{s.label}</span>
              <span className="chart-count">{countFor(s.id, base, chart)}</span>
            </button>
          ))}
        </nav>

        <div className="chart-panel">
          {section === 'allergies' && (
            <AllergySection
              clinical={base}
              chart={chart}
              onChange={(next) => void write(next)}
            />
          )}
          {section === 'problems' && (
            <ProblemSection clinical={base} onChange={(next) => void write(next)} />
          )}
          {section === 'medications' && <MedicationSection chart={chart} />}
          {section === 'visits' && (
            <VisitSection chart={chart} encounters={encounters} onOpen={onOpenEncounter} />
          )}
        </div>
      </div>
    </div>
  );
}

function countFor(id: SectionId, c: PatientClinical, chart: Chart | null): string {
  if (id === 'allergies') return c.allergies.length ? String(c.allergies.length) : '—';
  if (id === 'problems') {
    const active = c.problems.filter((p) => p.status === 'active').length;
    return active ? String(active) : '—';
  }
  if (id === 'medications') return chart?.medications.length ? String(chart.medications.length) : '—';
  return chart?.visits.length ? String(chart.visits.length) : '—';
}

// --- allergies --------------------------------------------------------------

function AllergySection({
  clinical,
  chart,
  onChange,
}: {
  clinical: PatientClinical;
  chart: Chart | null;
  onChange: (next: PatientClinical) => void;
}) {
  const [substance, setSubstance] = useState('');
  const [reaction, setReaction] = useState('');
  const [severe, setSevere] = useState(false);

  const add = () => {
    const name = substance.trim();
    if (!name) return;
    const fact: AllergyFact = {
      substance: name,
      ...(reaction.trim() ? { reaction: reaction.trim() } : {}),
      severity: severe ? 'severe' : 'mild',
      notedOn: today(),
    };
    onChange({ ...clinical, allergies: [...clinical.allergies, fact] });
    setSubstance('');
    setReaction('');
    setSevere(false);
  };

  const disagreements = chart ? allergyDisagreements(chart) : [];

  return (
    <section className="card">
      <h2>Allergies</h2>
      {clinical.allergies.length === 0 ? (
        <p className="empty">
          Nothing recorded. That is not the same as “none known” — it means
          nobody has written the answer down yet.
        </p>
      ) : (
        <ul className="fact-list">
          {clinical.allergies.map((a, i) => (
            <li key={`${a.substance}-${i}`} className="fact">
              <div style={{ minWidth: 0 }}>
                <span className="fact-label">{a.substance}</span>
                {a.severity === 'severe' && <span className="pill bad">severe</span>}
                <div className="meta">
                  {a.reaction ? `${a.reaction} · ` : ''}
                  noted {a.notedOn}
                  {a.notedBy ? ` by ${a.notedBy}` : ''}
                </div>
              </div>
              <button
                className="mini"
                aria-label={`Remove ${a.substance}`}
                onClick={() =>
                  onChange({
                    ...clinical,
                    allergies: clinical.allergies.filter((_, j) => j !== i),
                  })
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {disagreements.length > 0 && (
        <div className="warn-box" style={{ marginTop: 12 }}>
          <strong>Past scripts disagree about this.</strong>
          Different visits recorded: {disagreements.join(' / ')}. The list above
          is the one the banner now uses — correct it if it is wrong.
        </div>
      )}

      <div className="two-col" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Substance</label>
          <input
            value={substance}
            aria-label="Allergy substance"
            placeholder="penicillin"
            onChange={(e) => setSubstance(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Reaction</label>
          <input
            value={reaction}
            placeholder="rash, swelling…"
            onChange={(e) => setReaction(e.target.value)}
          />
        </div>
      </div>
      <div className="opt-group" style={{ marginTop: 8 }}>
        <label>How bad</label>
        <div className="opts">
          <button className="opt" aria-pressed={!severe} onClick={() => setSevere(false)}>
            Mild
          </button>
          <button className="opt" aria-pressed={severe} onClick={() => setSevere(true)}>
            Severe
          </button>
        </div>
      </div>
      <p className="hint">
        Severe means airway, anaphylaxis or admission. Two values on purpose:
        a banner that shouts equally about a rash is a banner that gets ignored.
      </p>
      <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
        <button className="btn" disabled={!substance.trim()} onClick={add}>
          Record this allergy
        </button>
      </div>
    </section>
  );
}

// --- problems ---------------------------------------------------------------

function ProblemSection({
  clinical,
  onChange,
}: {
  clinical: PatientClinical;
  onChange: (next: PatientClinical) => void;
}) {
  const [label, setLabel] = useState('');
  const [onset, setOnset] = useState('');

  const add = () => {
    const text = label.trim();
    if (!text) return;
    const fact: ProblemFact = { label: text, status: 'active', ...(onset ? { onset } : {}) };
    onChange({ ...clinical, problems: [...clinical.problems, fact] });
    setLabel('');
    setOnset('');
  };

  const toggle = (i: number) =>
    onChange({
      ...clinical,
      problems: clinical.problems.map((p, j) =>
        j !== i
          ? p
          : p.status === 'active'
            ? { ...p, status: 'resolved', resolvedOn: today() }
            : { label: p.label, status: 'active', ...(p.onset ? { onset: p.onset } : {}) },
      ),
    });

  const active = clinical.problems.filter((p) => p.status === 'active');
  const resolved = clinical.problems.filter((p) => p.status === 'resolved');

  return (
    <section className="card">
      <h2>Problems</h2>
      {clinical.problems.length === 0 && <p className="empty">Nothing recorded.</p>}

      {active.length > 0 && (
        <ul className="fact-list">
          {clinical.problems.map((p, i) =>
            p.status !== 'active' ? null : (
              <li key={`${p.label}-${i}`} className="fact">
                <div style={{ minWidth: 0 }}>
                  <span className="fact-label">{p.label}</span>
                  {p.onset && <div className="meta">since {p.onset}</div>}
                </div>
                <button className="linkish" onClick={() => toggle(i)}>
                  resolved
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {resolved.length > 0 && (
        <>
          <p className="side-group-label" style={{ margin: '14px 0 4px' }}>
            Resolved
          </p>
          <ul className="fact-list">
            {clinical.problems.map((p, i) =>
              p.status !== 'resolved' ? null : (
                <li key={`${p.label}-${i}`} className="fact is-resolved">
                  <div style={{ minWidth: 0 }}>
                    <span className="fact-label">{p.label}</span>
                    {p.resolvedOn && <div className="meta">resolved {p.resolvedOn}</div>}
                  </div>
                  <button className="linkish" onClick={() => toggle(i)}>
                    reopen
                  </button>
                </li>
              ),
            )}
          </ul>
        </>
      )}

      <div className="two-col" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Problem</label>
          <input
            value={label}
            aria-label="Problem"
            placeholder="asthma"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Since</label>
          <input type="date" value={onset} onChange={(e) => setOnset(e.target.value)} />
        </div>
      </div>
      <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
        <button className="btn" disabled={!label.trim()} onClick={add}>
          Add to the problem list
        </button>
      </div>
    </section>
  );
}

// --- medications ------------------------------------------------------------

function MedicationSection({ chart }: { chart: Chart | null }) {
  if (!chart || chart.medications.length === 0) {
    return (
      <section className="card">
        <h2>Medications</h2>
        <p className="empty">Nothing has been prescribed to this patient on this device.</p>
      </section>
    );
  }
  return (
    <section className="card">
      <h2>Medications</h2>
      <p className="hint">
        Everything ever prescribed, grouped by generic so two brands of one drug
        read as one history. Counts are counts — what they mean is your call.
      </p>
      <ul className="fact-list">
        {chart.medications.map((m) => (
          <MedicationRow key={m.key} med={m} />
        ))}
      </ul>
    </section>
  );
}

function MedicationRow({ med }: { med: ChartMedication }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="fact fact-stack">
      <button className="fact-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="fact-label">{med.label}</span>
        <span className="meta">
          {med.courses.length} course{med.courses.length === 1 ? '' : 's'} · last{' '}
          {med.courses[0]?.date}
          {med.brands.length > 0 ? ` · as ${med.brands.join(', ')}` : ''}
        </span>
      </button>
      {open && (
        <ul className="course-list">
          {med.courses.map((c) => (
            <li key={c.encounterId + c.date}>
              <time>{c.date}</time>
              <span>
                {c.strength ? `${c.strength} ` : ''}
                {c.frequency}
                {c.duration ? ` · ${c.duration.value} ${c.duration.unit}` : ' · no duration recorded'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// --- visits -----------------------------------------------------------------

function VisitSection({
  chart,
  encounters,
  onOpen,
}: {
  chart: Chart | null;
  encounters: Prescription[];
  onOpen?: ((rx: Prescription) => void) | undefined;
}) {
  if (!chart || chart.visits.length === 0) {
    return (
      <section className="card">
        <h2>Visits</h2>
        <p className="empty">No visits recorded on this device.</p>
      </section>
    );
  }
  return (
    <section className="card">
      <h2>Visits</h2>
      <div className="rows">
        {chart.visits.map((v) => {
          const rx = encounters.find((e) => e.id === v.id);
          const body = (
            <>
              <div style={{ minWidth: 0 }}>
                <div className="who">
                  {v.diagnosis.join(', ') || v.problems.join(', ') || 'No diagnosis recorded'}
                </div>
                <div className="meta">
                  {v.medicationCount} medicine{v.medicationCount === 1 ? '' : 's'}
                  {v.labCount > 0 ? ` · ${v.labCount} investigation${v.labCount === 1 ? '' : 's'}` : ''}
                  {v.kind === 'discharge' ? ' · discharge summary' : ''}
                </div>
              </div>
              <time>{v.date}</time>
            </>
          );
          return onOpen && rx ? (
            <button className="row-item" key={v.id} onClick={() => onOpen(rx)}>
              {body}
            </button>
          ) : (
            <div className="row-item" key={v.id}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
