/**
 * Rescuing growth data recorded under the old, broken key.
 *
 * Before patients were real entities, a growth series was keyed by
 * `reference || name`. Two children called "Ali Khan" therefore shared one
 * series, and their weights are interleaved in it. **Nothing in the stored data
 * says which point belonged to which child** — there is no field to consult, so
 * no automatic migration is possible that is not a guess.
 *
 * A guess here is not a cosmetic error. It produces a growth chart that looks
 * authoritative and is wrong, and a wrong weight trajectory is how a healthy
 * child gets investigated for faltering growth.
 *
 * So this screen does the only honest thing: shows the points with their dates
 * and values, and asks a human which ones belong to whom. Unclaimed points stay
 * put for a second pass rather than being destroyed by the first.
 */
import { useEffect, useState } from 'react';
import type { LegacyGrowthLink, PatientRecord } from '@domain/patient.ts';
import { patientLabel } from '@domain/patient.ts';
import type { GrowthPoint } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';

export function LegacyGrowthResolver() {
  const [legacy, setLegacy] = useState<LegacyGrowthLink[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [open, setOpen] = useState<LegacyGrowthLink | null>(null);
  const [points, setPoints] = useState<GrowthPoint[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string>('');
  const [status, setStatus] = useState<string | null>(null);

  const refresh = () => {
    void db.legacyGrowthSeries().then(setLegacy);
    void db.allPatients().then(setPatients);
  };
  useEffect(refresh, []);

  const openSeries = async (row: LegacyGrowthLink) => {
    const pts = await db.legacyGrowthPoints(row.legacyKey);
    setOpen(row);
    setPoints(pts.sort((a, b) => a.ageDays - b.ageDays));
    setChosen(new Set());
    setTarget('');
    setStatus(null);
  };

  const link = async () => {
    if (!open || !target || chosen.size === 0) return;
    await db.linkLegacyGrowth(open.legacyKey, target, [...chosen], true);
    const name = patients.find((p) => p.id === target)?.name ?? 'the patient';
    setStatus(`Moved ${chosen.size} measurement(s) to ${name}.`);
    setOpen(null);
    refresh();
  };

  if (legacy.length === 0) {
    return status ? <p className="hint">{status}</p> : null;
  }

  return (
    <section className="card settings-section">
      <h3>Growth records from an older version</h3>
      <div className="warn-box" style={{ borderColor: 'var(--alert)' }}>
        <strong>These are not in use, and cannot be moved automatically.</strong>
        They were filed under the patient&rsquo;s name. If two children shared a
        name, their measurements are mixed together in one list and nothing in
        the data can tell them apart. Open each one, check the dates and values,
        and say which child they belong to.
      </div>

      {status && <p className="hint">{status}</p>}

      <div className="rows" style={{ marginTop: 10 }}>
        {legacy.map((row) => (
          <button className="row-item" key={row.legacyKey} onClick={() => openSeries(row)}>
            <div style={{ minWidth: 0 }}>
              <div className="who">{row.patientName}</div>
              <div className="meta">
                {row.pointCount} measurement{row.pointCount === 1 ? '' : 's'}
                {row.nameDerived
                  ? ' · filed by name — may hold more than one child'
                  : ' · filed by file number'}
              </div>
            </div>
            <span className={row.nameDerived ? 'pill bad' : 'pill'}>
              {row.nameDerived ? 'check carefully' : 'likely one child'}
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div className="scrim" role="dialog" aria-modal="true">
          <div className="sheet-modal">
            <h3>{open.patientName}</h3>
            <p className="sub">
              Tick the measurements that belong to one child. Anything you leave
              unticked stays here for a second pass.
            </p>

            <div className="rows">
              {points.map((pt) => {
                const on = chosen.has(pt.id);
                return (
                  <button
                    className="row-item"
                    key={pt.id}
                    aria-pressed={on}
                    onClick={() =>
                      setChosen((prev) => {
                        const next = new Set(prev);
                        if (next.has(pt.id)) next.delete(pt.id);
                        else next.add(pt.id);
                        return next;
                      })
                    }
                  >
                    <span className={on ? 'pill good' : 'pill'}>{on ? 'taking' : 'leave'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="who mono">
                        {pt.value} {pt.unit}
                      </div>
                      <div className="meta">
                        {pt.measure} · {Math.round(pt.ageDays / 30.4375)} months old ·{' '}
                        {pt.sex === 'M' ? 'boy' : 'girl'}
                      </div>
                    </div>
                    <time>{pt.date}</time>
                  </button>
                );
              })}
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Belongs to</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">— choose a patient —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {patientLabel(p)}
                  </option>
                ))}
              </select>
              {patients.length === 0 && (
                <p className="hint">
                  No patient records yet. Link a patient on a prescription first,
                  then come back.
                </p>
              )}
            </div>

            <div className="actionbar" style={{ padding: '12px 0 0', borderTop: 'none' }}>
              <button className="btn quiet" onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button className="btn" disabled={!target || chosen.size === 0} onClick={link}>
                Move {chosen.size} measurement{chosen.size === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
