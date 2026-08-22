/**
 * What stands between this pack and a patient.
 *
 * DESIGN.md 12 asks for two things here and this tab is both of them: the
 * blocking badges, and a live JSON preview that is *exactly* what the app
 * imports — the same string `downloadPack` writes to the file, not a
 * pretty-printed approximation of it.
 *
 * Errors are grouped by what they would do to a real script, rather than by
 * which validator produced them, because "an uncited dose" and "a phrase only
 * written in English" are the same category of problem to the person fixing
 * them: something that reaches a patient wrong.
 */
import { useState } from 'react';
import type { Draft, Gate } from '../useDraft.ts';

export function ReviewTab({ draft, json }: { draft: Draft; json: string }) {
  const [showJson, setShowJson] = useState(false);
  const warnings = draft.gates.filter((g) => g.severity === 'warning');

  return (
    <>
      <section className="card">
        <h2>Before this can be exported</h2>
        {draft.errors.length === 0 ? (
          <div className="ok-box">
            <strong>Nothing is blocking.</strong>
            Every dose has a citation, every phrase exists in both languages,
            every red flag has been signed off, and no generic is spelled two
            ways.
          </div>
        ) : (
          <div className="warn-box" style={{ borderColor: 'var(--alert)' }}>
            <strong>
              {draft.errors.length} problem{draft.errors.length === 1 ? '' : 's'} must be
              fixed first.
            </strong>
            Each of these reaches a patient silently — nothing about the printed
            script would look wrong.
          </div>
        )}

        <div className="growth-grid" style={{ marginTop: 10 }}>
          <Stat k="Medicines" v={draft.stats.brands} sub={`${draft.stats.generics} generics`} />
          <Stat
            k="Cited doses"
            v={draft.stats.dosing}
            sub={
              draft.stats.genericsWithoutDosing
                ? `${draft.stats.genericsWithoutDosing} generics with none`
                : 'all generics covered'
            }
          />
          <Stat
            k="Not DRAP-checked"
            v={draft.stats.unreconciled}
            sub={draft.stats.unreconciled ? 'no registration number' : 'all verified'}
          />
          <Stat
            k="Red flags unsigned"
            v={draft.stats.unreviewedRedFlags}
            sub={draft.stats.unreviewedRedFlags ? 'blocks export' : 'all signed off'}
          />
        </div>
      </section>

      {draft.errors.length > 0 && (
        <section className="card">
          <h2>Blocking</h2>
          <IssueList issues={draft.errors} />
        </section>
      )}

      {warnings.length > 0 && (
        <section className="card">
          <h2>Worth a look</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            These do not block export. They are places the pack is thinner than
            it looks.
          </p>
          <IssueList issues={warnings} />
        </section>
      )}

      <section className="card">
        <h2>The file</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Plain JSON, and deliberately not encrypted — a pack holds drug names
          and phrase templates, nothing about any patient, and its whole point is
          that you can hand it to a colleague. A records backup is the opposite
          and is encrypted. This is byte-for-byte what Export writes.
        </p>
        <button className="btn quiet" onClick={() => setShowJson((v) => !v)}>
          {showJson ? 'Hide' : 'Show'} JSON ({Math.round(json.length / 1024)} KB)
        </button>
        {showJson && <pre className="json-preview">{json}</pre>}
      </section>
    </>
  );
}

function IssueList({ issues }: { issues: Gate[] }) {
  return (
    <div className="rows">
      {issues.map((issue, i) => (
        <div
          className="advice-item"
          data-vouch={issue.severity === 'error' ? 'red-flag' : 'doctors-own'}
          key={`${issue.where}-${i}`}
        >
          <span className="mark" aria-hidden="true">
            {issue.severity === 'error' ? '!' : '†'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="vouch-label">{issue.where}</span>
            <div className="en">{issue.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: number; sub: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
