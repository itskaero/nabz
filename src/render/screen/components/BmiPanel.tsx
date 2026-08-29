/**
 * The BMI / BSA module. Same two rules as GrowthPanel and GfrPanel:
 * everything numeric comes from `domain/modules/bmi`, and this panel shows a
 * number and stops -- it never adjusts a dose or flags a drug.
 */
import { useState } from 'react';
import { estimateBmi, estimateBsa } from '@domain/modules/bmi.ts';
import { useStore, newId } from '../store.tsx';

export function BmiPanel() {
  const { rx, setCalculations } = useStore();
  const patient = rx.patient;
  const [weight, setWeight] = useState(patient.weightKg ? String(patient.weightKg) : '');
  const [height, setHeight] = useState(patient.heightCm ? String(patient.heightCm) : '');

  const input = { weightKg: Number(weight), heightCm: Number(height) };
  const ready = Number(weight) > 0 && Number(height) > 0;
  const bmiOut = ready ? estimateBmi(input) : null;
  const bsaOut = ready ? estimateBsa(input) : null;

  const record = () => {
    if (!bmiOut?.ok || !bsaOut?.ok) return;
    const now = new Date().toISOString();
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
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="field num" style={{ flex: 1 }}>
          <label>Height (cm)</label>
          <input
            inputMode="decimal"
            aria-label="Height in centimetres"
            value={height}
            placeholder="e.g. 170"
            onChange={(e) => setHeight(e.target.value)}
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
          <button className="btn" onClick={record}>
            Record these results
          </button>
        </>
      )}
    </section>
  );
}
