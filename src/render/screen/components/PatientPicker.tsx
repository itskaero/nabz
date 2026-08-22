/**
 * Choosing which child this is.
 *
 * The whole design of this component is one idea: **the app never decides.** It
 * types what you typed into a search, ranks what it has, shows you WHY each one
 * matched, and waits. There is no "best match" pre-selected, no auto-fill on
 * exact name, and no threshold above which it picks for you — because the
 * failure mode is opening the wrong child's chart, and that failure is silent.
 *
 * The second idea: identifying a patient is an ACCELERATOR, never a gate. Every
 * path here can be skipped. A walk-in with no record gets a prescription
 * exactly as before (PRODUCT.md 16).
 */
import { useEffect, useMemo, useState } from 'react';
import type { PatientRecord } from '@domain/patient.ts';
import { patientLabel, rankCandidates } from '@domain/patient.ts';
import type { Sex } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';
import { newId, useStore } from '../store.tsx';

export function PatientPicker({ onClose }: { onClose: () => void }) {
  const { rx, identifyPatient } = useStore();
  const [all, setAll] = useState<PatientRecord[]>([]);
  const [name, setName] = useState(rx.patient.name);
  const [phone, setPhone] = useState(rx.patient.contact ?? '');
  const [fileNo, setFileNo] = useState(rx.patient.reference ?? '');
  const [dob, setDob] = useState(rx.patient.dob ?? '');
  const [sex, setSex] = useState<Sex | ''>(rx.patient.sex ?? '');
  const [history, setHistory] = useState<Record<string, number>>({});

  useEffect(() => {
    void db.allPatients().then(setAll);
  }, []);

  const candidates = useMemo(
    () =>
      rankCandidates(
        {
          ...(name.trim() ? { name } : {}),
          ...(phone.trim() ? { phone } : {}),
          ...(fileNo.trim() ? { fileNo } : {}),
          ...(dob ? { dob } : {}),
          ...(sex ? { sex } : {}),
        },
        all,
      ),
    [name, phone, fileNo, dob, sex, all],
  );

  // Visit counts are shown because "3 visits since March" is the thing that
  // actually tells a doctor whether this is the child they remember.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      candidates.map(async (c) => [c.patient.id, (await db.patientHistory(c.patient.id)).length] as const),
    ).then((pairs) => {
      if (!cancelled) setHistory(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [candidates]);

  const createNew = async () => {
    const now = new Date().toISOString();
    const record: PatientRecord = {
      id: newId(),
      name: name.trim() || rx.patient.name.trim(),
      ...(dob ? { dob } : {}),
      ...(sex ? { sex: sex as Sex } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(fileNo.trim() ? { fileNo: fileNo.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await db.savePatient(record);
    identifyPatient(record);
    onClose();
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Identify patient">
      <div className="sheet-modal">
        <h3>Which patient is this?</h3>
        <p className="sub">
          Only to link this visit to the same child later. You can skip it and
          write the script anyway.
        </p>

        <div className="two-col">
          <div className="field">
            <label>Name</label>
            <input value={name} aria-label="Search by name" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field num">
            <label>File number</label>
            <input value={fileNo} onChange={(e) => setFileNo(e.target.value)} />
          </div>
        </div>
        <div className="two-col" style={{ marginTop: 8 }}>
          <div className="field num">
            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>
        <div className="opt-group" style={{ marginTop: 8 }}>
          <label>Sex</label>
          <div className="opts">
            {(['M', 'F'] as Sex[]).map((s) => (
              <button
                key={s}
                className="opt"
                aria-pressed={sex === s}
                onClick={() => setSex(sex === s ? '' : s)}
              >
                {s === 'M' ? 'Boy' : 'Girl'}
              </button>
            ))}
          </div>
        </div>

        {candidates.length > 0 && (
          <>
            <div className="warn-box" style={{ margin: '12px 0 8px' }}>
              <strong>Check before you choose.</strong>
              Children share names. Confirm the date of birth or file number
              matches the child in front of you — not just the name.
            </div>
            <div className="rows">
              {candidates.map(({ patient, reasons }) => (
                <button
                  className="row-item"
                  key={patient.id}
                  onClick={() => {
                    identifyPatient(patient);
                    onClose();
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="who">{patientLabel(patient)}</div>
                    <div className="meta">
                      {patient.sex === 'M' ? 'Boy' : patient.sex === 'F' ? 'Girl' : 'sex not recorded'}
                      {' · '}
                      {reasons.join(', ')}
                    </div>
                  </div>
                  <time>
                    {history[patient.id] === undefined
                      ? ''
                      : `${history[patient.id]} visit${history[patient.id] === 1 ? '' : 's'}`}
                  </time>
                </button>
              ))}
            </div>
          </>
        )}

        {name.trim() && candidates.length === 0 && (
          <p className="empty">No existing record matches.</p>
        )}

        <div className="actionbar" style={{ padding: '12px 0 0', borderTop: 'none' }}>
          <button className="btn quiet" onClick={onClose}>
            Skip
          </button>
          <button className="btn ghost" disabled={!name.trim()} onClick={createNew}>
            New patient
          </button>
        </div>
      </div>
    </div>
  );
}
