/**
 * Patients, by month.
 *
 * The question this answers is "who did I see last month", which nothing else
 * in the app could be asked: `HistoryPanel` is a search box that returns
 * nothing until two characters are typed, and `PatientPicker` ranks candidates
 * against a name you are already typing. Both assume you already know who you
 * are looking for.
 *
 * NOTHING HERE REACHES THE DOCUMENT. Tapping a row opens that patient's chart,
 * which is reading. Putting a past script's medicines onto today's paper is
 * still the explicit refill path with its confirmation dialog, exactly as
 * PRODUCT.md 3.4 requires -- this view creates no "we noticed this patient
 * before" shortcut.
 *
 * It is also the most sensitive single screen in the app: every patient seen
 * last month, by name, with a diagnosis beside it. It inherits the existing
 * gates rather than inventing new ones -- it lives in the RECORDS nav group,
 * which is not built on a reception station, and `deviceAllows` is an
 * allow-list so a new view defaults to doctor-only.
 */
import { useEffect, useState } from 'react';
import type { CaseloadMonth, CaseloadRow, Caseload } from '@domain/caseload.ts';
import { caseload, monthLabel, monthWindow } from '@domain/caseload.ts';
import * as db from '@storage/db.ts';
import { PageHeader, Stat } from '../shell/PageHeader.tsx';

export function CaseloadPanel({
  onOpenChart,
  onLinkEncounter,
}: {
  onOpenChart: (patientId: string) => void;
  onLinkEncounter?: ((encounterId: string) => void) | undefined;
}) {
  const [months, setMonths] = useState<CaseloadMonth[] | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [load, setLoad] = useState<Caseload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void db.monthsWithEncounters().then((found) => {
      if (cancelled) return;
      setMonths(found);
      setMonth((current) => current ?? found[0]?.key ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    void (async () => {
      const { from, toExclusive } = monthWindow(month);
      const [encounters, patients] = await Promise.all([
        db.encountersBetween(from, toExclusive),
        db.allPatients(),
      ]);
      if (cancelled) return;
      setLoad(caseload(month, encounters, new Map(patients.map((p) => [p.id, p.name]))));
    })();
    return () => {
      cancelled = true;
    };
  }, [month]);

  if (months === null) return <p className="empty">Reading the months…</p>;

  if (months.length === 0) {
    return (
      <div className="body">
        {/*
          The empty state is a page too.

          It took an early return that rendered a bare card, so the one screen
          where a doctor most needs to know where they are — nothing here yet,
          why? — was the one screen with no title and no trail.
        */}
        <PageHeader
          trail={['Records']}
          title="Patients"
          lede="Everyone you have seen, by month, with a way into each chart."
        />
        <section className="card">
          <p className="empty" style={{ margin: 0 }}>
            Nothing saved on this device yet. Every script you save puts a
            patient in this list.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="body">
      {/*
        A real page header, and the month strip and the figures hung under it.

        This screen used to open on a card titled "Patients" — a heading inside
        a box, which is not the same thing as the window knowing what it is
        showing. The figures were nowhere: the number of patients in the month
        and the number of visits were both already computed and both only
        visible by counting rows.
      */}
      <PageHeader
        trail={['Records']}
        title="Patients"
        lede="Who you have seen, by month. Opening a row opens that patient’s chart — nothing here is copied onto the script you are writing."
      >
        <div className="stat-row">
          <Stat
            label="Patients"
            value={load ? load.rows.length : '—'}
            of={month ? monthLabel(month) : ''}
          />
          <Stat
            label="Visits"
            value={load ? load.rows.reduce((n, r) => n + r.visits, 0) : '—'}
            of="scripts written"
          />
          <Stat
            label="Unlinked"
            value={load ? load.unlinked.length : '—'}
            of="no chart yet"
            {...(load && load.unlinked.length > 0
              ? { foot: 'Link them to keep a growth series', delta: 'needs a name', trend: 'down' as const }
              : {})}
          />
        </div>
      </PageHeader>

      <section className="card">
        {/*
          The month strip stays a tablist rather than becoming a segmented
          control: a segmented control is for a handful of fixed choices that
          all fit, and this list grows by one every month and scrolls. It takes
          the segmented LOOK — a sunken track with the selected month lifted
          out of it — without claiming a shape it cannot keep.
        */}
        <div className="month-strip segmented-track" role="tablist" aria-label="Month">
          {months.map((m) => (
            <button
              key={m.key}
              role="tab"
              className="month-chip"
              aria-selected={month === m.key}
              onClick={() => setMonth(m.key)}
            >
              <span>{monthLabel(m.key)}</span>
              <span className="month-count">{m.encounters}</span>
            </button>
          ))}
        </div>
      </section>

      {load === null ? (
        <p className="empty">Reading {month ? monthLabel(month) : ''}…</p>
      ) : (
        <>
          <div className="rows">
            {load.rows.length === 0 && <p className="empty">No visits in this month.</p>}
            {load.rows.map((row) => (
              <button
                className="row-item caseload-row"
                key={row.patientId}
                onClick={() => row.patientId && onOpenChart(row.patientId)}
              >
                {/*
                  The initial, as the chip the reference rows lead with. It
                  identifies nothing by itself — two Muhammads share an M, and
                  this app exists partly because a previous version treated a
                  name as an identity. It is a place for the eye to land while
                  scanning a column, and the name beside it is what is read.
                */}
                <span className="metric-chip" aria-hidden="true">
                  {(row.name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="who">{row.name || 'Unnamed'}</div>
                  <DiagnosisTags row={row} />
                </div>
                <div className="caseload-when">
                  <time>{row.lastSeen}</time>
                  {row.visits > 1 && <span className="meta">{row.visits} visits</span>}
                </div>
              </button>
            ))}
          </div>

          {load.unlinked.length > 0 && (
            <section className="card" style={{ marginTop: 'var(--stack)' }}>
              <h2>Not linked to a patient record</h2>
              <p className="hint" style={{ marginTop: 0 }}>
                {load.unlinked.length} visit{load.unlinked.length === 1 ? '' : 's'} written
                without identifying the patient. They have no chart and no growth
                series until somebody links them — names on paper are not enough,
                siblings share them.
              </p>
              <div className="rows">
                {load.unlinked.map((row) => (
                  <div className="row-item caseload-row" key={row.encounterIds[0]}>
                    <div style={{ minWidth: 0 }}>
                      <div className="who">{row.name || 'Unnamed'}</div>
                      <DiagnosisTags row={row} />
                    </div>
                    <div className="caseload-when">
                      <time>{row.lastSeen}</time>
                      {onLinkEncounter && (
                        <button
                          className="linkish"
                          onClick={() => onLinkEncounter(row.encounterIds[0]!)}
                        >
                          link
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The diagnosis, as read-only tags.
 *
 * `.tag`, not `.chip`: `.chip` is the tri-state examination control and sits
 * in the 24x24 target-size group, so reusing it would make a static label look
 * pressable.
 *
 * Only `diagnosis` feeds these. Where it is empty the row says so, rather than
 * falling back to `problems` the way `HistoryPanel` does -- a presenting
 * complaint dressed as a diagnosis chip is a quiet upgrade in confidence, and
 * this app does not make those.
 */
function DiagnosisTags({ row }: { row: CaseloadRow }) {
  if (row.diagnosis.length === 0) {
    return <div className="tags"><span className="tag is-empty">No diagnosis recorded</span></div>;
  }
  return (
    <div className="tags">
      {row.diagnosis.map((d) => (
        <span className="tag" key={d}>
          {d}
        </span>
      ))}
      {row.otherDiagnoses > 0 && (
        <span
          className="tag is-more"
          title={`${row.otherDiagnoses} other diagnosis recorded earlier this month`}
        >
          +{row.otherDiagnoses}
        </span>
      )}
    </div>
  );
}
