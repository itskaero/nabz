/**
 * The BMI / BSA module. Same two rules as GrowthPanel and GfrPanel:
 * everything numeric comes from `domain/modules/bmi`, and this panel shows a
 * number and stops -- it never adjusts a dose or flags a drug.
 */
import { useState } from 'react';
import { estimateBmi, estimateBsa } from '@domain/modules/bmi.ts';
import { useStore, newId } from '../store.tsx';
import { PatientStrip } from './PatientStrip.tsx';

export function BmiPanel() {
  const { rx, setCalculations } = useStore();
  const patient = rx.patient;
  const [weight, setWeight] = useState(patient.weightKg ? String(patient.weightKg) : '');
  const [height, setHeight] = useState(patient.heightCm ? String(patient.heightCm) : '');

  const input = { weightKg: Number(weight), heightCm: Number(height) };
  const ready = Number(weight) > 0 && Number(height) > 0;
  const bmiOut = ready ? estimateBmi(input) : null;
  const bsaOut = ready ? estimateBsa(input) : null;
  const recorded = (rx.calculations ?? []).filter((c) => c.moduleId === 'bmi');
  const [justRecorded, setJustRecorded] = useState(false);

  const record = () => {
    if (!bmiOut?.ok || !bsaOut?.ok) return;
    const now = new Date().toISOString();
    setJustRecorded(true);
    setCalculations([
      ...(rx.calculations ?? []),
      {
        id: newId(),
        moduleId: 'bmi',
        label: `BMI (${bmiOut.category})`,
        value: bmiOut.value,
        unit: bmiOut.unit,
        method: 'weight / height²',
        inputs: { weightKg: input.weightKg, heightCm: input.heightCm },
        computedAt: now,
      },
      {
        id: newId(),
        moduleId: 'bmi',
        label: 'BSA (Mosteller)',
        value: bsaOut.value,
        unit: bsaOut.unit,
        method: 'Mosteller',
        inputs: { weightKg: input.weightKg, heightCm: input.heightCm },
        computedAt: now,
      },
    ]);
  };

  return (
    <section className="card">
      <PatientStrip />
      <h2>BMI / BSA</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Body surface area is here mainly because eGFR de-indexes against it at
        extremes of body size — check it alongside the eGFR tab, not instead of it.
      </p>

      <div className="num-row" style={{ marginBottom: 10 }}>
        <div className="field num" style={{ flex: 1 }}>
          <label>Weight (kg)</label>
          <input
            inputMode="decimal"
            aria-label="Weight in kilograms"
            value={weight}
            placeholder="e.g. 70"
            onChange={(e) => {
              setWeight(e.target.value);
              setJustRecorded(false);
            }}
          />
        </div>
        <div className="field num" style={{ flex: 1 }}>
          <label>Height (cm)</label>
          <input
            inputMode="decimal"
            aria-label="Height in centimetres"
            value={height}
            placeholder="e.g. 170"
            onChange={(e) => {
              setHeight(e.target.value);
              setJustRecorded(false);
            }}
          />
        </div>
      </div>

      {bmiOut?.ok && bsaOut?.ok && (
        <>
          <div className="growth-grid" style={{ marginBottom: 10 }}>
            <div className="stat">
              <div className="k">BMI</div>
              <div className="v">{bmiOut.value}</div>
              <div className="sub">{bmiOut.unit} · {bmiOut.category}</div>
            </div>
            <div className="stat">
              <div className="k">BSA</div>
              <div className="v">{bsaOut.value}</div>
              <div className="sub">{bsaOut.unit} · Mosteller</div>
            </div>
          </div>
          <div className="record-row">
            <button className="btn" onClick={record}>
              Record these results
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
