/**
 * History and refill.
 *
 * MANUAL ONLY (PRODUCT.md rule 3.4). The doctor types a search, reads the
 * results, and picks one. There is no "we noticed this patient before" path
 * anywhere in this component or in the storage layer beneath it, because
 * auto-loading a returning patient's last script is a wrong-patient
 * medication-error vector.
 *
 * The refill copies the medicines and clinical content, NOT the patient block.
 * Re-typing the name is two seconds and is the last cheap check that the right
 * chart is open.
 */
import { useEffect, useState } from 'react';
import type { Prescription } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';
import { useStore } from '../store.tsx';

export function HistoryPanel({ onDone }: { onDone: () => void }) {
  const { refillFrom } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Prescription[]>([]);
  const [recent, setRecent] = useState<Prescription[]>([]);
  const [confirming, setConfirming] = useState<Prescription | null>(null);

  useEffect(() => {
    void db.recentPrescriptions(15).then(setRecent);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void db.searchHistory(query).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const list = query.trim().length >= 2 ? results : recent;

  return (
    <div className="body">
      <section className="card">
        <h2>Find a previous visit</h2>
        <div className="compose">
          <input
            value={query}
            placeholder="Patient name, file number or diagnosis"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="hint">
          Nothing is loaded until you choose it. Check the name and date before
          you reuse a script.
        </p>
      </section>

      <div className="rows">
        {list.length === 0 && (
          <p className="empty">
            {query.trim().length >= 2 ? 'No match.' : 'No saved prescriptions yet.'}
          </p>
        )}
        {list.map((rx) => (
          <button className="row-item" key={rx.id} onClick={() => setConfirming(rx)}>
            <div style={{ minWidth: 0 }}>
              <div className="who">{rx.patient.name || 'Unnamed'}</div>
              <div className="meta">
                {rx.diagnosis.join(', ') || rx.problems.join(', ') || 'No diagnosis recorded'} ·{' '}
                {rx.medications.length} medicine{rx.medications.length === 1 ? '' : 's'}
              </div>
            </div>
            <time>{rx.date}</time>
          </button>
        ))}
      </div>

      {confirming && (
        <div className="scrim" role="dialog" aria-modal="true">
          <div className="sheet-modal">
            <h3>Reuse this script?</h3>
            <p className="sub">
              {confirming.patient.name || 'Unnamed'} · {confirming.date}
            </p>
            <div className="warn-box" style={{ marginBottom: 12 }}>
              <strong>The patient details are not copied.</strong>
              Only the medicines, problems, examination and advice come across.
              Enter the patient again so the wrong chart cannot travel with them.
            </div>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
              {confirming.medications.map((m) => (
                <li key={m.id}>
                  {m.drug.brand || m.drug.generic || m.drug.raw}
                  {m.drug.strength ? ` ${m.drug.strength}` : ''}
                </li>
              ))}
            </ul>
            <div className="actionbar" style={{ padding: 0, borderTop: 'none' }}>
              <button className="btn quiet" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => {
                  refillFrom(confirming);
                  setConfirming(null);
                  onDone();
                }}
              >
                Copy the medicines
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
