/**
 * Home -- the doctor device's landing screen (PRODUCT.md's analytics
 * addendum). Read-only, on-device, backward-looking: prescription volume by
 * month and top diagnoses "as written", computed entirely from this device's
 * own storage. Nothing here is transmitted anywhere, ever (rule 1), and
 * nothing here feeds a suggestion into an active script (rule 3.3 does not
 * apply -- there is no suggestion here, only a summary of the past).
 *
 * The hard constraint this component exists under: "New prescription" must
 * stay an unmistakable, one-tap primary action, because PRODUCT.md's
 * adoption bar is "at least as fast as the doctor's current Word template"
 * -- Home must not become a genuine detour in front of that.
 *
 * No drill-down, no export, no filters (PRODUCT.md 16: "not a structured
 * clinical database") -- this stays a summary, not a growing BI tool. There
 * is deliberately no "open this old script" action here: HistoryPanel.tsx's
 * confirm-then-refill flow is the ONLY path that touches a past prescription
 * (PRODUCT.md rule 3.4), so a recent entry here links to History rather than
 * re-implementing that flow a second time.
 */
import { useEffect, useState } from 'react';
import * as db from '@storage/db.ts';
import { monthlyVolume, rankDiagnoses } from '@domain/analytics.ts';
import type { MonthlyVolume, DiagnosisTally } from '@domain/analytics.ts';
import type { Prescription } from '@domain/prescription.ts';

export function HomePanel({
  onNew,
  onOpenHistory,
}: {
  onNew: () => void;
  onOpenHistory: () => void;
}) {
  const [volume, setVolume] = useState<MonthlyVolume[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisTally[]>([]);
  const [recent, setRecent] = useState<Prescription[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void Promise.all([
      db.monthlyVolumeSnapshot().then((all) => setVolume(monthlyVolume(all))),
      db.topDiagnoses(8).then((rows) => setDiagnoses(rankDiagnoses(rows))),
      db.recentPrescriptions(5).then(setRecent),
    ]).then(() => setLoaded(true));
  }, []);

  return (
    <div className="body">
      <div className="home">
        <button className="btn home-primary" onClick={onNew}>
          New prescription
        </button>

        {recent.length > 0 && (
          <section className="card">
            <h2>Recent</h2>
            <div className="rows">
              {recent.map((rx) => (
                <button key={rx.id} className="row-item" onClick={onOpenHistory}>
                  <div style={{ minWidth: 0 }}>
                    <div className="who">{rx.patient.name || 'Unnamed'}</div>
                    <div className="meta">
                      {rx.diagnosis.join(', ') || rx.problems.join(', ') || 'No diagnosis recorded'}
                    </div>
                  </div>
                  <time>{rx.date}</time>
                </button>
              ))}
            </div>
            <button className="btn quiet" style={{ marginTop: 8 }} onClick={onOpenHistory}>
              See all history
            </button>
          </section>
        )}

        {/*
          .card.emphasis, applied for real (2nd-pass critique P2 -- the token
          existed after the last pass with zero call sites anywhere). This is
          the reason Home exists, so it's the one card on this screen that
          should outweigh its neighbour.
        */}
        <section className="card emphasis">
          <h2>Prescriptions by month</h2>
          {loaded && volume.length === 0 ? (
            <p className="empty">Nothing saved on this device yet.</p>
          ) : (
            <>
              <div className="home-headline">
                <span className="home-headline-n">{currentMonthCount(volume)}</span>
                <span className="home-headline-l">this month</span>
              </div>
              <MonthlyVolumeChart data={volume} />
            </>
          )}
        </section>

        <section className="card">
          <h2>Top diagnoses (as written)</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Diagnosis is free text, not a coded list — similar phrasings (e.g.
            &quot;URTI&quot; and &quot;Upper respiratory tract infection&quot;) may appear as
            separate rows.
          </p>
          {loaded && diagnoses.length === 0 ? (
            <p className="empty">Nothing recorded yet.</p>
          ) : (
            <div className="rows">
              {diagnoses.map((d) => (
                <div className="entry-row" key={d.text}>
                  <span className="text">{d.text}</span>
                  <span className="mono">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** The current calendar month's count from an already-bucketed series, 0 if none yet. */
function currentMonthCount(data: MonthlyVolume[]): number {
  const thisMonth = new Date().toISOString().slice(0, 7);
  return data.find((m) => m.month === thisMonth)?.count ?? 0;
}

/**
 * Hand-rolled SVG bar chart -- the same compute-in-domain/render-in-component
 * split GrowthPanel.tsx uses for its own chart. Every number here already
 * came from domain/analytics.ts; this function only maps a value to a pixel.
 */
function MonthlyVolumeChart({ data }: { data: MonthlyVolume[] }) {
  if (data.length === 0) return null;
  const w = 320;
  const h = 130;
  const padL = 4;
  const padB = 18;
  const shown = data.slice(-6); // last 6 months, so a long history doesn't crush the bars
  const max = Math.max(...shown.map((d) => d.count), 1);
  const barW = (w - padL * 2) / shown.length;

  const y = (count: number) => h - padB - (count / max) * (h - padB - 10);

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Prescriptions by month">
      <line x1={padL} y1={h - padB} x2={w - padL} y2={h - padB} stroke="var(--line)" />
      {shown.map((d, i) => {
        const x = padL + i * barW + barW * 0.18;
        const bw = barW * 0.64;
        const barY = y(d.count);
        return (
          <g key={d.month}>
            <rect x={x} y={barY} width={bw} height={h - padB - barY} fill="var(--teal)" rx={2} />
            <text
              x={x + bw / 2}
              y={h - padB - (h - padB - barY) - 4}
              textAnchor="middle"
              fontSize={10}
              fill="var(--ink-soft)"
              fontFamily="var(--font-mono)"
            >
              {d.count}
            </text>
            <text
              x={x + bw / 2}
              y={h - padB + 12}
              textAnchor="middle"
              fontSize={9}
              /* --ink-soft, not --ink-faint (2nd-pass critique P1): this is
                 the month-axis label, real information, not decoration --
                 the exact pattern the last pass fixed everywhere else. */
              fill="var(--ink-soft)"
            >
              {d.month.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
