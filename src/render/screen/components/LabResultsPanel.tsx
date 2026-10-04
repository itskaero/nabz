/**
 * Results, as a table with a trend where there is one.
 *
 * The trend is the reason this exists. Six prescriptions carrying a creatinine
 * each are six numbers a doctor has to hold in their head; one line is a
 * direction. Everything else here is a list.
 *
 * NOTHING IS CALLED ABNORMAL. `flag` is what the laboratory printed or what
 * the doctor ticked -- never computed from a built-in reference range, because
 * ranges are age-, sex-, assay- and laboratory-specific and applying a
 * built-in one to a result from a laboratory using a different assay is how an
 * app manufactures a disease. A result with no flag renders with no flag,
 * which is not the same as "normal".
 */
import { useState } from 'react';
import type { ContentPack } from '@domain/pack.ts';
import type { LabFlag, LabResult, LabSeries } from '@domain/labResult.ts';
import { MIN_TREND_POINTS, seriesFor, sparkline, trendPoints } from '@domain/labResult.ts';
import { freeLabId } from '@domain/labs.ts';

const FLAG_LABEL: Record<LabFlag, string> = {
  low: 'low',
  high: 'high',
  critical: 'critical',
};

export function LabResultsPanel({
  pack,
  patientId,
  results,
  onAdd,
  onDelete,
}: {
  pack: ContentPack;
  patientId: string;
  results: LabResult[];
  onAdd: (result: Omit<LabResult, 'id' | 'enteredOn'>) => void;
  onDelete: (id: string) => void;
}) {
  const series = seriesFor(results, patientId);
  const [adding, setAdding] = useState(false);

  return (
    <section className="card">
      <h2>Results</h2>
      {series.length === 0 ? (
        <p className="empty">
          Nothing entered. Results come back after the visit that ordered them,
          so they are typed in here rather than onto the script.
        </p>
      ) : (
        <div className="lab-series-list">
          {series.map((s) => (
            <SeriesBlock key={s.labId} series={s} onDelete={onDelete} />
          ))}
        </div>
      )}

      {adding ? (
        <AddResult
          pack={pack}
          patientId={patientId}
          onCancel={() => setAdding(false)}
          onAdd={(r) => {
            onAdd(r);
            setAdding(false);
          }}
        />
      ) : (
        <div className="actionbar" style={{ padding: '12px 0 0', borderTop: 'none' }}>
          <button className="btn ghost" onClick={() => setAdding(true)}>
            Enter a result
          </button>
        </div>
      )}
    </section>
  );
}

function SeriesBlock({
  series,
  onDelete,
}: {
  series: LabSeries;
  onDelete: (id: string) => void;
}) {
  const points = trendPoints(series);
  const path = sparkline(points, 120, 28);

  return (
    <div className="lab-series">
      <div className="lab-series-head">
        <span className="fact-label">{series.label}</span>
        {series.unit && <span className="meta">{series.unit}</span>}
        {path ? (
          <svg
            className="sparkline"
            viewBox="0 0 120 28"
            width="120"
            height="28"
            role="img"
            aria-label={`${series.label}: ${points.map((p) => p.value).join(', ')} over ${points.length} measurements`}
          >
            <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ) : (
          series.results.length > 1 && (
            // Two points joined by a line read as a trend, and two
            // measurements are not one.
            <span className="meta">
              {series.results.length < MIN_TREND_POINTS
                ? `${series.results.length} measurements`
                : 'not plottable'}
            </span>
          )
        )}
      </div>
      <ul className="lab-rows">
        {series.results.map((r) => (
          <li key={r.id}>
            <time>{r.takenOn}</time>
            <span className="lab-value">
              {r.value}
              {r.unit ? ` ${r.unit}` : ''}
            </span>
            {r.flag && <span className={`tag flag-${r.flag}`}>{FLAG_LABEL[r.flag]}</span>}
            {r.note && <span className="meta">{r.note}</span>}
            <button className="mini" aria-label={`Remove ${r.label} from ${r.takenOn}`} onClick={() => onDelete(r.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddResult({
  pack,
  patientId,
  onAdd,
  onCancel,
}: {
  pack: ContentPack;
  patientId: string;
  onAdd: (result: Omit<LabResult, 'id' | 'enteredOn'>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [takenOn, setTakenOn] = useState(new Date().toISOString().slice(0, 10));
  const [flag, setFlag] = useState<LabFlag | ''>('');

  // The pack's own test list, flattened, so the common ones are one tap and
  // anything else is still typable -- the same bargain the Labs tab makes.
  const palette = Object.values(pack.labsPalette).flat();
  const match = palette.find((l) => l.label.toLowerCase() === label.trim().toLowerCase());

  const submit = () => {
    const name = label.trim();
    if (!name || !value.trim()) return;
    onAdd({
      patientId,
      labId: match ? match.id : freeLabId(name),
      label: match ? match.label : name,
      value: value.trim(),
      ...(unit.trim() ? { unit: unit.trim() } : {}),
      ...(flag ? { flag } : {}),
      takenOn,
    });
  };

  return (
    <div className="lab-add">
      <div className="two-col">
        <div className="field">
          <label htmlFor="lab-name">Test</label>
          <input
            id="lab-name"
            list="lab-palette"
            value={label}
            placeholder="Creatinine"
            onChange={(e) => setLabel(e.target.value)}
          />
          <datalist id="lab-palette">
            {palette.map((l) => (
              <option key={l.id} value={l.label} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="lab-date">Sample taken</label>
          <input
            id="lab-date"
            type="date"
            value={takenOn}
            onChange={(e) => setTakenOn(e.target.value)}
          />
        </div>
      </div>
      <div className="two-col" style={{ marginTop: 8 }}>
        <div className="field">
          <label htmlFor="lab-value">Result</label>
          <input
            id="lab-value"
            value={value}
            placeholder="1.4, or “not detected”"
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lab-unit">Unit</label>
          <input
            id="lab-unit"
            value={unit}
            placeholder="mg/dL"
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
      </div>
      <div className="opt-group" style={{ marginTop: 8 }}>
        <label>Flagged by the laboratory</label>
        <div className="opts">
          {(['low', 'high', 'critical'] as LabFlag[]).map((f) => (
            <button
              key={f}
              className="opt"
              aria-pressed={flag === f}
              onClick={() => setFlag(flag === f ? '' : f)}
            >
              {FLAG_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        Copied from the report, or your own reading of it. Nothing here decides
        what is abnormal — reference ranges belong to the laboratory that ran
        the assay.
      </p>
      <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
        <button className="btn quiet" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn" disabled={!label.trim() || !value.trim()} onClick={submit}>
          Save the result
        </button>
      </div>
    </div>
  );
}
