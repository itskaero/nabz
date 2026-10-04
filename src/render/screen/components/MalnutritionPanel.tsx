/**
 * The acute-malnutrition module (PRODUCT.md 4c).
 *
 * Same two rules GrowthPanel and GfrPanel enforce, applied here:
 *  1. Nothing here computes anything. The classification comes from
 *     `domain/modules/malnutrition`, the single source of truth; this panel
 *     collects inputs and displays what that module returns.
 *  2. It states a CLASSIFICATION and stops there. It never says admit, refer
 *     or start RUTF -- that is the doctor's decision, and the app making it
 *     would be automated clinical judgement (PRODUCT.md rule 3.3).
 *
 * The protocol comes from the pack, not from here, and the panel names it on
 * screen: a clinic following the national MUAC-only programme and one
 * following WHO 2023 get different answers for the same child, and which one
 * they are looking at is not a detail.
 */
import { useEffect, useMemo, useState } from 'react';
import type { GrowthTables } from '@domain/growth/index.ts';
import { loadGrowthTables } from '@data/growth/index.ts';
import type { Oedema, Posture, WastingProtocol } from '@domain/modules/malnutrition.ts';
import { classify, expectedPosture } from '@domain/modules/malnutrition.ts';
import { useStore, newId } from '../store.tsx';

const OEDEMA_LABEL: Record<Oedema, string> = {
  present: 'Present',
  absent: 'Absent',
  'not-assessed': 'Not assessed',
};

const SEVERITY_VOUCH: Record<string, string> = {
  severe: 'red-flag',
  moderate: 'doctors-own',
  none: 'vetted',
};

export function MalnutritionPanel() {
  const { rx, pack, setCalculations } = useStore();
  const patient = rx.patient;
  const protocol = pack.moduleConfig?.malnutrition as WastingProtocol | undefined;

  const [tables, setTables] = useState<GrowthTables | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  useEffect(() => {
    void loadGrowthTables()
      .then(setTables)
      .catch((err: unknown) =>
        setTableError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  /*
    Posture is defaulted from age and then owned by the user. WHO's rule says
    what SHOULD have happened; a two-year-old who would not stand was measured
    lying down, and the reference tables differ by about 0.13kg at 80cm, which
    is a fifth of a z-score in the band where severe wasting is decided.
  */
  const [posture, setPosture] = useState<Posture>(() => expectedPosture(patient.ageDays));
  const [oedema, setOedema] = useState<Oedema>('not-assessed');
  const [muac, setMuac] = useState('');

  const deps = useMemo(() => {
    if (!tables) return null;
    const muacChart = tables.charts.find((c) => c.chart === 'muac-for-age');
    const rows = muacChart && patient.sex ? muacChart.data[patient.sex] : undefined;
    return {
      ...(tables.wasting ? { wasting: tables.wasting } : {}),
      ...(rows ? { muacRows: rows } : {}),
    };
  }, [tables, patient.sex]);

  const input = useMemo(
    () => ({
      ...(patient.sex ? { sex: patient.sex } : {}),
      ...(patient.ageDays !== undefined ? { ageDays: patient.ageDays } : {}),
      ...(patient.weightKg ? { weightKg: patient.weightKg } : {}),
      ...(patient.heightCm ? { measurementCm: patient.heightCm } : {}),
      posture,
      oedema,
      ...(Number(muac) > 0 ? { muacMm: Number(muac) } : {}),
    }),
    [patient.sex, patient.ageDays, patient.weightKg, patient.heightCm, posture, oedema, muac],
  );

  const outcome = protocol && deps ? classify(input, protocol, deps) : null;

  const record = () => {
    if (!outcome?.ok) return;
    const inputs: Record<string, number | string> = {
      oedema: outcome.oedema,
      protocol: protocol!.criteria.join('+'),
    };
    if (outcome.whz) {
      inputs['whz'] = outcome.whz.z.toFixed(2);
      inputs['chart'] = outcome.whz.chart;
      inputs['measurementCm'] = patient.heightCm ?? '';
      inputs['weightKg'] = patient.weightKg ?? '';
    }
    if (outcome.muacMm !== undefined) inputs['muacMm'] = outcome.muacMm;

    setCalculations([
      ...(rx.calculations ?? []),
      {
        id: newId(),
        moduleId: 'malnutrition',
        // Frozen at compute time, like every other CalcResult: the protocol
        // can be edited later and this line must still say what was applied.
        label: outcome.label,
        // Severity is the result; the numeric field carries the deciding
        // z-score where there is one, so a reviewer can check the arithmetic.
        value: outcome.whz ? Number(outcome.whz.z.toFixed(2)) : (outcome.muacMm ?? 0),
        unit: outcome.whz ? 'z (weight-for-height)' : 'mm (MUAC)',
        method: outcome.method,
        inputs,
        computedAt: new Date().toISOString(),
      },
    ]);
  };

  if (!protocol) {
    return (
      <section className="card">
        <h2>Malnutrition</h2>
        <div className="warn-box">
          <strong>This pack names no protocol.</strong>
          WHO 2023 and national programmes admit on different criteria, so there
          is no default to fall back on. Set one in the pack builder.
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Acute malnutrition</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Classified against <strong>{protocol.reference}</strong>. It states what
        the measurements show and nothing more — what to do about it is yours.
      </p>

      {tableError && (
        <div className="warn-box">
          <strong>The reference tables did not load.</strong>
          Nothing can be classified without them. ({tableError})
        </div>
      )}

      {/*
        Three states, not a checkbox. Bilateral pitting oedema outranks every
        number here, so a control that starts at "absent" would quietly assert
        a finding nobody made.
      */}
      <div className="opt-group">
        <label>Bilateral pitting oedema</label>
        <div className="opts">
          {(['present', 'absent', 'not-assessed'] as Oedema[]).map((o) => (
            <button
              key={o}
              className="opt"
              aria-pressed={oedema === o}
              onClick={() => setOedema(o)}
            >
              {OEDEMA_LABEL[o]}
            </button>
          ))}
        </div>
      </div>

      {protocol.criteria.includes('whz') && (
        <div className="opt-group">
          <label>Length or height was taken</label>
          <div className="opts">
            {(['recumbent', 'standing'] as Posture[]).map((p) => (
              <button
                key={p}
                className="opt"
                aria-pressed={posture === p}
                onClick={() => setPosture(p)}
              >
                {p === 'recumbent' ? 'Lying down' : 'Standing'}
              </button>
            ))}
          </div>
          <p className="hint">
            Not the same table. Lying and standing references differ by about
            0.13&nbsp;kg at 80&nbsp;cm — record how the child was actually
            measured, not what their age suggests.
          </p>
        </div>
      )}

      {protocol.criteria.includes('muac') && (
        <div className="field num" style={{ marginBottom: 10 }}>
          <label>MUAC (mm)</label>
          <input
            inputMode="decimal"
            aria-label="Mid-upper arm circumference in millimetres"
            value={muac}
            placeholder="e.g. 118"
            onChange={(e) => setMuac(e.target.value)}
          />
        </div>
      )}

      {outcome && !outcome.ok && (
        <div className="warn-box">
          <strong>Not enough to classify.</strong>
          {outcome.detail}.
        </div>
      )}

      {outcome?.ok && (
        <>
          {/*
            The classification carries a mark, a border and a word, never
            colour alone (DESIGN.md 8) -- reusing the advice tiers' vouch
            styling so severe reads the way a red flag reads everywhere else.
          */}
          <div className="advice-item" data-vouch={SEVERITY_VOUCH[outcome.severity]}>
            <span className="mark">
              {outcome.severity === 'severe' ? '!' : outcome.severity === 'moderate' ? '†' : '✓'}
            </span>
            <div>
              <span className="vouch-label">
                {outcome.severity === 'none' ? 'Not classified' : outcome.severity}
              </span>
              <strong>{outcome.label}</strong>
              {outcome.by.length > 0 && (
                <div className="en">
                  on {outcome.by.map((c) => (c === 'whz' ? 'weight-for-height' : c)).join(' and ')}
                </div>
              )}
            </div>
          </div>

          <div className="growth-grid" style={{ margin: '10px 0' }}>
            {outcome.whz && (
              <div className="stat">
                <div className="k">Weight-for-{posture === 'recumbent' ? 'length' : 'height'}</div>
                <div className="v">{outcome.whz.z.toFixed(2)}</div>
                <div className="sub">
                  z · {outcome.whz.percentile.toFixed(1)}th centile
                </div>
              </div>
            )}
            {outcome.muacMm !== undefined && (
              <div className="stat">
                <div className="k">MUAC</div>
                <div className="v">{outcome.muacMm}</div>
                <div className="sub">
                  mm{outcome.muacZ ? ` · ${outcome.muacZ.z.toFixed(2)} z for age` : ''}
                </div>
              </div>
            )}
            <div className="stat">
              <div className="k">Oedema</div>
              <div className="v" style={{ fontSize: 14 }}>{OEDEMA_LABEL[outcome.oedema]}</div>
              <div className="sub">bilateral pitting</div>
            </div>
          </div>

          <p className="ref-note">{outcome.method}</p>
          <button className="btn" onClick={record}>
            Record this classification
          </button>
        </>
      )}
    </section>
  );
}
