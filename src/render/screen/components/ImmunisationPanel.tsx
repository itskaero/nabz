/**
 * The immunisation record, and the milestone record.
 *
 * BOTH SCREENS STAY MUTE. There is no "overdue", no "give today", no "delayed
 * milestone". That is not timidity -- it is the same line this codebase draws
 * everywhere else: `LabsTab` refuses to propose an investigation from a
 * diagnosis, and `patient.ts` names the failure in its own words when a merged
 * weight series "reads as growth faltering, which is a diagnosis the data
 * invented".
 *
 * The specific reason here: a blank is not a negative. A child may well have
 * had their 14-week visit at a government centre with nobody writing it down
 * in this app. "4 of 6 recorded" is true. "2 overdue" would be a claim about
 * the world made from the absence of data, printed next to a child's name.
 *
 * The published due age is shown, because that is the same thing a growth
 * chart's centile band is: the reference, beside what was recorded. What it
 * means is the doctor's judgement and goes in `diagnosis`.
 */
import { useState } from 'react';
import type { ContentPack } from '@domain/pack.ts';
import type {
  ImmunisationRecord,
  MilestoneRecord,
  PatientClinical,
} from '@domain/patientClinical.ts';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "6 weeks", "9 months" -- in the units the schedule itself uses.
 *
 * The cut is at 16 weeks, not at two months, because EPI names its first four
 * visits in weeks: a row headed "10 weeks" with "due 2 months" beside it is
 * the app disagreeing with the row above it, which is how a doctor stops
 * trusting the row.
 */
function dueLabel(atDays: number): string {
  if (atDays === 0) return 'at birth';
  if (atDays < 112) return `${Math.round(atDays / 7)} weeks`;
  if (atDays < 548) return `${Math.round(atDays / 30.44)} months`;
  return `${Math.round(atDays / 365.25)} years`;
}

export function ImmunisationPanel({
  pack,
  clinical,
  onChange,
}: {
  pack: ContentPack;
  clinical: PatientClinical;
  onChange: (next: PatientClinical) => void;
}) {
  const schedule = pack.immunisationSchedule;
  const given = new Map((clinical.immunisations ?? []).map((r) => [r.visitId, r]));

  if (!schedule) {
    return (
      <section className="card">
        <h2>Immunisation</h2>
        <p className="empty">This pack declares no immunisation schedule.</p>
      </section>
    );
  }

  /*
    Built field by field rather than by spreading a partial over the existing
    row. With `exactOptionalPropertyTypes` a loose patch can set a REQUIRED
    field to undefined, and the one that matters here is `visitId` -- a record
    that lost it would be an immunisation belonging to no visit.
  */
  const record = (visitId: string, update: { givenOn?: string; source?: 'card' | 'recall' | null }) => {
    const rest = (clinical.immunisations ?? []).filter((r) => r.visitId !== visitId);
    const existing = given.get(visitId);
    const givenOn = update.givenOn ?? existing?.givenOn;
    const source = update.source === null ? undefined : (update.source ?? existing?.source);
    const next: ImmunisationRecord = {
      visitId,
      notedOn: existing?.notedOn ?? today(),
      ...(givenOn ? { givenOn } : {}),
      ...(source ? { source } : {}),
    };
    onChange({ ...clinical, immunisations: [...rest, next] });
  };

  const forget = (visitId: string) => {
    onChange({
      ...clinical,
      immunisations: (clinical.immunisations ?? []).filter((r) => r.visitId !== visitId),
    });
  };

  return (
    <section className="card">
      <h2>Immunisation</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        {given.size} of {schedule.visits.length} visits recorded. A blank row
        means <strong>not recorded</strong> — it does not mean not given.
      </p>

      <ul className="fact-list">
        {schedule.visits.map((visit) => {
          const row = given.get(visit.id);
          return (
            <li className="fact fact-stack" key={visit.id}>
              <div className="immun-row">
                <div style={{ minWidth: 0 }}>
                  <span className="fact-label">{visit.label}</span>
                  <span className="pill">due {dueLabel(visit.atDays)}</span>
                  <div className="meta">{visit.doses.join(' · ')}</div>
                </div>
                <button
                  className={row ? 'btn quiet' : 'btn ghost'}
                  onClick={() => (row ? forget(visit.id) : record(visit.id, {}))}
                >
                  {row ? 'Clear' : 'Record'}
                </button>
              </div>
              {row && (
                <div className="immun-detail">
                  <div className="field">
                    <label htmlFor={`im-${visit.id}`}>Given on</label>
                    <input
                      id={`im-${visit.id}`}
                      type="date"
                      value={row.givenOn ?? ''}
                      onChange={(e) => record(visit.id, { givenOn: e.target.value })}
                    />
                  </div>
                  <div className="opt-group">
                    <label>From</label>
                    <div className="opts">
                      {(['card', 'recall'] as const).map((source) => (
                        <button
                          key={source}
                          className="opt"
                          aria-pressed={row.source === source}
                          onClick={() =>
                            record(visit.id, { source: row.source === source ? null : source })
                          }
                        >
                          {source === 'card' ? 'Card seen' : 'Mother recalls'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="cite">{schedule.reference}</p>
    </section>
  );
}

const DOMAIN_LABEL: Record<string, string> = {
  gross: 'Gross motor',
  fine: 'Fine motor',
  speech: 'Speech',
  social: 'Social',
};

export function MilestonePanel({
  pack,
  clinical,
  onChange,
}: {
  pack: ContentPack;
  clinical: PatientClinical;
  onChange: (next: PatientClinical) => void;
}) {
  const catalogue = pack.milestones;
  const recorded = new Map((clinical.milestones ?? []).map((m) => [m.itemId, m]));
  const [editing, setEditing] = useState<string | null>(null);

  if (!catalogue) {
    return (
      <section className="card">
        <h2>Milestones</h2>
        <p className="empty">This pack declares no milestone list.</p>
      </section>
    );
  }

  const set = (itemId: string, update: { attainedOn?: string; notYet?: boolean }) => {
    const rest = (clinical.milestones ?? []).filter((m) => m.itemId !== itemId);
    const existing = recorded.get(itemId);
    const attainedOn = update.attainedOn ?? (update.notYet ? '' : existing?.attainedOn);
    const notYet = update.notYet ?? (update.attainedOn ? false : existing?.notYet);
    const next: MilestoneRecord = {
      itemId,
      notedOn: today(),
      ...(attainedOn ? { attainedOn } : {}),
      ...(notYet ? { notYet: true } : {}),
    };
    onChange({ ...clinical, milestones: [...rest, next] });
  };

  const forget = (itemId: string) => {
    onChange({
      ...clinical,
      milestones: (clinical.milestones ?? []).filter((m) => m.itemId !== itemId),
    });
  };

  const byDomain = new Map<string, typeof catalogue.items>();
  for (const item of [...catalogue.items].sort((a, b) => a.typicalByDays - b.typicalByDays)) {
    byDomain.set(item.domain, [...(byDomain.get(item.domain) ?? []), item]);
  }

  return (
    <section className="card">
      <h2>Milestones</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        What the parent reports, with the published age beside it. Blank means
        nobody asked — it is not the same as “not yet”, which has its own
        button.
      </p>

      {[...byDomain.entries()].map(([domain, items]) => (
        <div key={domain}>
          <p className="side-group-label" style={{ margin: '14px 0 4px' }}>
            {DOMAIN_LABEL[domain] ?? domain}
          </p>
          <ul className="fact-list">
            {items.map((item) => {
              const row = recorded.get(item.id);
              return (
                <li className="fact fact-stack" key={item.id}>
                  <div className="immun-row">
                    <div style={{ minWidth: 0 }}>
                      <span className="fact-label">{item.label}</span>
                      <span className="pill">usually by {dueLabel(item.typicalByDays)}</span>
                      {row?.attainedOn && <div className="meta">attained {row.attainedOn}</div>}
                      {row?.notYet && <div className="meta">not yet, as of {row.notedOn}</div>}
                    </div>
                    <div className="opts">
                      <button
                        className="opt"
                        aria-pressed={Boolean(row?.attainedOn)}
                        onClick={() =>
                          setEditing(editing === item.id ? null : item.id)
                        }
                      >
                        Attained
                      </button>
                      <button
                        className="opt"
                        aria-pressed={Boolean(row?.notYet)}
                        onClick={() =>
                          row?.notYet ? forget(item.id) : set(item.id, { notYet: true })
                        }
                      >
                        Not yet
                      </button>
                    </div>
                  </div>
                  {editing === item.id && (
                    <div className="field">
                      <label htmlFor={`ms-${item.id}`}>Age attained</label>
                      <input
                        id={`ms-${item.id}`}
                        value={row?.attainedOn ?? ''}
                        placeholder="about 10 months"
                        onChange={(e) => set(item.id, { attainedOn: e.target.value })}
                      />
                      <span className="field-noted">
                        Free text on purpose: a parent says “about ten months”, not a date.
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="cite">{catalogue.reference}</p>
    </section>
  );
}
