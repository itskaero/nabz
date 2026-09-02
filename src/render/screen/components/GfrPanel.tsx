/**
 * The eGFR module (PRODUCT.md 4c) -- what the medicine pack's own notes
 * called "to medicine what the growth chart is to paediatrics".
 *
 * Same two rules GrowthPanel enforces, applied here:
 *  1. Nothing here computes a number. Both estimates come from
 *     `domain/modules/gfr`, the single source of truth; this panel only
 *     collects inputs and displays what that module returns.
 *  2. It shows a number and its method, and STOPS THERE. It never adjusts a
 *     dose and never flags a drug -- that decision stays with the doctor
 *     reading the dosing citation on the Medicines tab (PRODUCT.md rule 3.3).
 */
import { useMemo, useState } from 'react';
import type { CreatinineUnit } from '@domain/modules/gfr.ts';
import { estimateCkdEpi, estimateCockcroftGault, kdigoStage } from '@domain/modules/gfr.ts';
import { useStore, newId } from '../store.tsx';
import { PatientStrip } from './PatientStrip.tsx';

export function GfrPanel() {
  const { rx, setCalculations } = useStore();
  const patient = rx.patient;
  /*
    patient.ageDays is only ever written by GrowthPanel's date-of-birth field
    (domain/growth's ageDaysBetween) -- and the medicine pack, the one that
    enables this module, never enables growth. Depending on it alone left
    eGFR permanently stuck on "missing age" for every real adult patient, with
    no way to clear it. This field is the fix: a plain age-in-years input,
    same self-contained pattern BmiPanel already uses for weight/height,
    falling back to patient.ageDays only when something (a paediatric pack
    that also happened to enable gfr) has actually set it.
  */
  const [ageInput, setAgeInput] = useState(
    patient.ageDays ? String(Math.round(patient.ageDays / 365.25)) : '',
  );
  const ageYears = patient.ageDays ? patient.ageDays / 365.25 : Number(ageInput);
  const [creatinine, setCreatinine] = useState('');
  const [unit, setUnit] = useState<CreatinineUnit>('mg/dL');

  const missing: string[] = [];
  if (!patient.sex) missing.push('sex');
  if (!Number.isFinite(ageYears) || ageYears <= 0) missing.push('age');

  const input = useMemo(
    () => ({
      age: ageYears,
      sex: patient.sex!,
      creatinine: Number(creatinine),
      creatinineUnit: unit,
      ...(patient.weightKg ? { weightKg: patient.weightKg } : {}),
    }),
    [ageYears, patient.sex, patient.weightKg, creatinine, unit],
  );

  const ready = missing.length === 0 && Number(creatinine) > 0;
  const ckdEpi = ready ? estimateCkdEpi(input) : null;
  const crCl = ready ? estimateCockcroftGault(input) : null;
  const recorded = (rx.calculations ?? []).filter((c) => c.moduleId === 'gfr');
  const [justRecorded, setJustRecorded] = useState(false);

  const record = () => {
    const now = new Date().toISOString();
    const next = [...(rx.calculations ?? [])];
    if (ckdEpi?.ok) {
      next.push({
        id: newId(),
        moduleId: 'gfr',
        label: 'eGFR (CKD-EPI 2021)',
        value: ckdEpi.value,
        unit: ckdEpi.unit,
        method: ckdEpi.method,
        inputs: { age: input.age.toFixed(1), sex: input.sex, creatinine, creatinineUnit: unit },
        computedAt: now,
      });
    }
    if (crCl?.ok) {
      next.push({
        id: newId(),
        moduleId: 'gfr',
        label: 'Creatinine clearance (Cockcroft-Gault)',
        value: crCl.value,
        unit: crCl.unit,
        method: crCl.method,
        inputs: {
          age: input.age.toFixed(1),
          sex: input.sex,
          creatinine,
          creatinineUnit: unit,
          weightKg: patient.weightKg ?? '',
        },
        computedAt: now,
      });
    }
    setCalculations(next);
    setJustRecorded(true);
  };

  return (
    <section className="card">
      <PatientStrip />
      <h2>eGFR</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Two estimates, because they answer different questions. CKD-EPI stages
        kidney function; Cockcroft-Gault estimates creatinine clearance, which
        is what most drug renal-dosing tables actually cite. Neither adjusts a
        dose or flags a drug — read the citation on the Medicines tab and
        decide there.
      </p>

      {!patient.sex && (
        <div className="warn-box">
          <strong>Missing sex.</strong>
          Fill the patient's sex in the patient bar before this can compute
          anything.
        </div>
      )}

      <div className="num-row" style={{ marginBottom: 10 }}>
        {!patient.ageDays && (
          <div className="field num" style={{ flex: 1 }}>
            <label>Age (years)</label>
            <input
              inputMode="decimal"
              aria-label="Age in years"
              value={ageInput}
              placeholder="e.g. 45"
              onChange={(e) => {
                setAgeInput(e.target.value);
                setJustRecorded(false);
              }}
            />
          </div>
        )}
        <div className="field num" style={{ flex: 1 }}>
          <label>Serum creatinine</label>
          <input
            inputMode="decimal"
            aria-label="Serum creatinine"
            value={creatinine}
            placeholder={unit === 'mg/dL' ? 'e.g. 1.0' : 'e.g. 88'}
            onChange={(e) => {
              setCreatinine(e.target.value);
              setJustRecorded(false);
            }}
          />
        </div>
        <div className="opt-group">
          <label>Unit</label>
          <div className="opts">
            {(['mg/dL', 'umol/L'] as CreatinineUnit[]).map((u) => (
              <button
                key={u}
                className="opt"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {ready && (
        <>
          {/*
            The two estimates fail independently -- Cockcroft-Gault needs a
            weight and CKD-EPI does not, so a missing weight must not hide a
            perfectly computable eGFR.
          */}
          <div className="growth-grid" style={{ marginBottom: 10 }}>
            {ckdEpi?.ok ? (
              <>
                <div className="stat">
                  <div className="k">eGFR</div>
                  <div className="v">{ckdEpi.value}</div>
                  <div className="sub">
                    {ckdEpi.unit} · {ckdEpi.method}
                  </div>
                </div>
                <div className="stat">
                  <div className="k">KDIGO stage</div>
                  <div className="v" style={{ fontSize: 14 }}>
                    {kdigoStage(ckdEpi.value)}
                  </div>
                  <div className="sub">by eGFR category</div>
                </div>
              </>
            ) : (
              <div className="stat">
                <div className="k">eGFR</div>
                <div className="sub">{ckdEpi?.detail}</div>
              </div>
            )}
            {crCl?.ok ? (
              <div className="stat">
                <div className="k">Creatinine clearance</div>
                <div className="v">{crCl.value}</div>
                <div className="sub">
                  {crCl.unit} · {crCl.method}
                </div>
              </div>
            ) : (
              <div className="stat">
                <div className="k">Creatinine clearance</div>
                <div className="sub">{crCl?.detail}</div>
              </div>
            )}
          </div>
          <div className="record-row">
            <button className="btn" disabled={!ckdEpi?.ok && !crCl?.ok} onClick={record}>
              Record {ckdEpi?.ok && crCl?.ok ? 'these results' : 'this result'}
            </button>
            {justRecorded && <span className="pill good">Recorded ✓</span>}
          </div>
        </>
      )}

      {recorded.length > 0 && (
        <div className="rows" style={{ marginTop: 14 }}>
          <p className="hint" style={{ margin: '0 0 6px' }}>
            Already recorded on this script. Printing is off by default —
            turn it on in Settings → Paper &amp; letterhead.
          </p>
          {recorded.map((c) => (
            <div className="row-item" key={c.id}>
              <span className="who mono">
                {c.value} {c.unit}
              </span>
              <span className="meta">{c.label}</span>
              <time>{c.computedAt.slice(11, 16)}</time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
