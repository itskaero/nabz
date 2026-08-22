/**
 * The growth module (PRODUCT.md 4b).
 *
 * Two things this component is NOT allowed to do:
 *  1. Compute a percentile. Everything numeric comes from domain/growth, which
 *     is the single source of truth; the chart plots what it is given. Two code
 *     paths producing the same number will eventually disagree, and this is a
 *     number that gets written on a child's chart.
 *  2. Load a prior series on its own. The longitudinal carve-out is doctor-
 *     initiated: an explicit "open growth for this patient" click, with the
 *     patient named on the button. See the confirm step below.
 */
import { useMemo, useState } from 'react';
import type { GrowthMeasureId, GrowthPoint, Sex } from '@domain/prescription.ts';
import { compute, curve, ageDaysBetween, bmi } from '@domain/growth/index.ts';
import type { GrowthReference } from '@domain/growth/index.ts';
import type { GrowthTables } from '@domain/growth/index.ts';
import { loadGrowthTables } from '@data/growth/index.ts';
import * as db from '@storage/db.ts';
import { useStore, newId } from '../store.tsx';

const MEASURE_LABEL: Record<GrowthMeasureId, string> = {
  weight: 'Weight (kg)',
  length: 'Length lying (cm)',
  height: 'Height standing (cm)',
  hc: 'Head circumference (cm)',
  bmi: 'BMI (kg/m²)',
};

export function GrowthPanel() {
  const { rx, profile, pack, patient: identified, setPatient } = useStore();
  const [series, setSeries] = useState<GrowthPoint[] | null>(null);
  const [tables, setTables] = useState<GrowthTables | null>(null);
  const [loading, setLoading] = useState(false);
  const [measure, setMeasure] = useState<GrowthMeasureId>('weight');
  const [reference, setReference] = useState<GrowthReference>(
    profile.growth.reference ?? pack.moduleConfig?.growth?.defaultReference ?? 'WHO',
  );
  const [value, setValue] = useState('');
  const [dob, setDob] = useState(rx.patient.dob ?? '');

  const enabled = pack.modules.includes('growth');
  const patient = rx.patient;
  const ageDays =
    patient.ageDays ?? (dob ? ageDaysBetween(dob, rx.date) : Number.NaN);
  const sex: Sex | undefined = patient.sex;

  const measures = pack.moduleConfig?.growth?.measures ?? ['weight'];

  const result = useMemo(() => {
    if (!sex || !Number.isFinite(ageDays)) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    // A null table is a refusal, not a fallback: compute() will say so.
    return compute(tables, reference, { measure, value: n, ageDays, sex });
  }, [tables, sex, ageDays, value, measure, reference]);

  const chart = useMemo(() => {
    if (!tables || !sex || !Number.isFinite(ageDays)) return null;
    const from = Math.max(0, ageDays - 730);
    const to = ageDays + 365;
    const bands = [-3, -2, 0, 2, 3].map((z) => ({
      z,
      points: curve(tables, reference, measure, sex, z, from, to, 60),
    }));
    if (bands.every((b) => b.points.length === 0)) return null;
    const all = bands.flatMap((b) => b.points.map((p) => p.value));
    const plotted = (series ?? []).filter((p) => p.measure === measure);
    const yMin = Math.min(...all, ...plotted.map((p) => p.value));
    const yMax = Math.max(...all, ...plotted.map((p) => p.value));
    return { bands, from, to, yMin, yMax, plotted };
  }, [tables, sex, ageDays, measure, reference, series]);

  if (!enabled) return null;

  const openSeries = async () => {
    if (!identified) return;
    setLoading(true);
    try {
      // The `true` here is the doctor's explicit confirmation; storage refuses
      // to load a series without it (see storage/db.ts).
      const [points, loaded] = await Promise.all([
        db.loadGrowthSeries(identified!.id, true),
        loadGrowthTables(),
      ]);
      setTables(loaded);
      setSeries(points);
    } finally {
      setLoading(false);
    }
  };

  const record = async () => {
    if (!result?.ok) return;
    const point: GrowthPoint = {
      id: newId(),
      date: rx.date,
      ageDays: result.ageDays,
      sex: result.sex,
      measure: result.measure,
      value: result.value,
      unit: result.unit,
      z: result.z,
      percentile: result.percentile,
      reference: result.reference,
      chart: result.chart,
      edition: result.edition,
    };
    const next = [...(series ?? []), point].sort((a, b) => a.ageDays - b.ageDays);
    setSeries(next);
    await db.saveGrowthSeries(identified!.id, next);
  };

  return (
    <section className="card">
      <h2>Growth</h2>

      {/*
        A growth series belongs to an IDENTIFIED child, not to a typed name.
        Two children called "Ali Khan" used to share one series -- their points
        interleaved into a chart that read as faltering. See domain/patient.ts.
      */}
      {!identified && (
        <div className="warn-box">
          <strong>Identify the patient first.</strong>
          Growth is tracked per child across visits, so it needs to know which
          child this is. Names are not enough — siblings share them.
        </div>
      )}

      {identified && series === null && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Past measurements are never loaded automatically. Open them only when
            you are sure this is the same child.
          </p>
          <button className="btn ghost" onClick={openSeries} disabled={loading}>
            {loading ? 'Opening…' : `Open growth records for ${identified.name}`}
          </button>
        </>
      )}

      {series !== null && (
        <>
          <div className="two-col" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>Date of birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  setPatient({
                    dob: e.target.value,
                    ageDays: ageDaysBetween(e.target.value, rx.date),
                  });
                }}
              />
            </div>
            <div className="field">
              <label>Sex</label>
              <select
                value={patient.sex ?? ''}
                onChange={(e) => setPatient({ sex: (e.target.value || undefined) as Sex })}
              >
                <option value="">—</option>
                <option value="M">Boy</option>
                <option value="F">Girl</option>
              </select>
            </div>
          </div>

          <div className="opt-group">
            <label>Measurement</label>
            <div className="opts">
              {measures.map((m) => (
                <button
                  key={m}
                  className="opt"
                  aria-pressed={measure === m}
                  onClick={() => setMeasure(m)}
                >
                  {MEASURE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="opt-group">
            <label>Reference curve</label>
            <div className="opts">
              {(['WHO', 'CDC'] as GrowthReference[]).map((r) => (
                <button
                  key={r}
                  className="opt"
                  aria-pressed={reference === r}
                  onClick={() => setReference(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="ref-note">
              {tables?.editions[reference] ?? 'reference tables loading…'}. WHO and
              CDC disagree under age two, so every recorded percentile stores
              which curve produced it.
            </p>
          </div>

          <div className="num-row" style={{ marginBottom: 10 }}>
            <div className="field num" style={{ flex: 1 }}>
              <label>{MEASURE_LABEL[measure]}</label>
              <input
                inputMode="decimal"
                aria-label={MEASURE_LABEL[measure]}
                value={value}
                placeholder="e.g. 13.5"
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            {measure === 'bmi' && patient.weightKg && patient.heightCm && (
              <button
                className="btn quiet"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => setValue(bmi(patient.weightKg!, patient.heightCm!).toFixed(1))}
              >
                From {patient.weightKg} kg / {patient.heightCm} cm
              </button>
            )}
          </div>

          {result && !result.ok && <p className="empty">{result.detail}</p>}

          {result?.ok && (
            <>
              <div className="growth-grid" style={{ marginBottom: 10 }}>
                <div className="stat">
                  <div className="k">z-score</div>
                  <div className="v">{result.z.toFixed(2)}</div>
                  <div className="sub">{result.band} SD</div>
                </div>
                <div className="stat">
                  <div className="k">Percentile</div>
                  <div className="v">{result.percentile.toFixed(1)}</div>
                  <div className="sub">of the {result.reference} curve</div>
                </div>
                <div className="stat">
                  <div className="k">Chart</div>
                  <div className="v" style={{ fontSize: 13 }}>
                    {result.chart}
                  </div>
                  <div className="sub">{result.reference}</div>
                </div>
              </div>
              <button className="btn" onClick={record}>
                Record this measurement
              </button>
            </>
          )}

          {chart && (
            <svg className="chart" viewBox="0 0 320 200" style={{ marginTop: 12 }}>
              <GrowthChart chart={chart} ageDays={ageDays} />
            </svg>
          )}

          {series.length > 0 && (
            <div className="rows" style={{ marginTop: 10 }}>
              {series
                .filter((p) => p.measure === measure)
                .map((p) => (
                  <div className="row-item" key={p.id}>
                    <span className="who mono">
                      {p.value} {p.unit}
                    </span>
                    <span className="meta">
                      {p.percentile !== undefined ? `${p.percentile.toFixed(1)}th` : '—'} ·{' '}
                      {p.reference} · {Math.round(p.ageDays / 30.4375)} mo
                    </span>
                    <time>{p.date}</time>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface ChartData {
  bands: Array<{ z: number; points: Array<{ ageDays: number; value: number }> }>;
  from: number;
  to: number;
  yMin: number;
  yMax: number;
  plotted: GrowthPoint[];
}

/** Presentation only. Every number here was computed by domain/growth. */
function GrowthChart({ chart, ageDays }: { chart: ChartData; ageDays: number }) {
  const pad = { l: 30, r: 8, t: 8, b: 20 };
  const w = 320 - pad.l - pad.r;
  const h = 200 - pad.t - pad.b;
  const span = chart.to - chart.from || 1;
  const range = chart.yMax - chart.yMin || 1;
  const x = (d: number) => pad.l + ((d - chart.from) / span) * w;
  const y = (v: number) => pad.t + h - ((v - chart.yMin) / range) * h;

  return (
    <>
      <rect x={pad.l} y={pad.t} width={w} height={h} fill="#fff" stroke="var(--line)" />
      {chart.bands.map((band) => (
        <polyline
          key={band.z}
          fill="none"
          stroke={band.z === 0 ? 'var(--teal)' : 'var(--line)'}
          strokeWidth={band.z === 0 ? 1.4 : 1}
          strokeDasharray={Math.abs(band.z) === 3 ? '3 3' : undefined}
          points={band.points.map((p) => `${x(p.ageDays)},${y(p.value)}`).join(' ')}
        />
      ))}
      {chart.bands.map((band) => {
        const last = band.points[band.points.length - 1];
        if (!last) return null;
        return (
          <text
            key={`l${band.z}`}
            x={pad.l + w - 2}
            y={y(last.value) - 2}
            fontSize="7"
            textAnchor="end"
            fill="var(--ink-faint)"
          >
            {band.z > 0 ? `+${band.z}` : band.z}
          </text>
        );
      })}
      <polyline
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.4}
        points={chart.plotted.map((p) => `${x(p.ageDays)},${y(p.value)}`).join(' ')}
      />
      {chart.plotted.map((p) => (
        <circle key={p.id} cx={x(p.ageDays)} cy={y(p.value)} r={2.6} fill="var(--ink)" />
      ))}
      <line
        x1={x(ageDays)}
        y1={pad.t}
        x2={x(ageDays)}
        y2={pad.t + h}
        stroke="var(--teal)"
        strokeDasharray="2 2"
        strokeWidth={0.8}
      />
      <text x={pad.l} y={198} fontSize="7" fill="var(--ink-faint)">
        {Math.round(chart.from / 30.4375)} mo
      </text>
      <text x={pad.l + w} y={198} fontSize="7" textAnchor="end" fill="var(--ink-faint)">
        {Math.round(chart.to / 30.4375)} mo
      </text>
      <text x={2} y={pad.t + 8} fontSize="7" fill="var(--ink-faint)">
        {chart.yMax.toFixed(1)}
      </text>
      <text x={2} y={pad.t + h} fontSize="7" fill="var(--ink-faint)">
        {chart.yMin.toFixed(1)}
      </text>
    </>
  );
}
