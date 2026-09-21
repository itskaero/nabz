/**
 * The admission: when it started, when it ended, and what happened in between.
 *
 * The one section a discharge summary needs that a prescription does not --
 * everything else it prints is a block this app already had. That is the whole
 * argument for `domain/documents` being a registry rather than a second copy
 * of the writing surface.
 *
 * NOTHING HERE IS COMPUTED. The dates are typed, including the discharge date,
 * which the app could trivially default to today and must not: a summary
 * written the morning after would then carry a discharge date one day late,
 * and nobody would look at a field that was already filled in. Rule 3.2 --
 * the app never fills a clinical value the doctor did not choose -- is not
 * only about doses.
 *
 * The length of stay IS shown, because it is arithmetic on two values the
 * doctor entered rather than a third value invented on their behalf, and
 * because a summary saying "admitted the 4th, discharged the 2nd" is a typo
 * that should be visible while it can still be fixed.
 */
import { useStore } from '../store.tsx';
import { AutocompleteInput } from '../components/AutocompleteInput.tsx';

/** Whole days between two ISO dates, or null when either is missing or unreadable. */
export function stayLengthDays(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export function StaySection() {
  const { rx, setStay } = useStore();
  const stay = rx.stay ?? { course: [], procedures: [] };
  const days = stayLengthDays(stay.admittedOn, stay.dischargedOn);

  return (
    <>
      <section className="card">
        <h2>The admission</h2>
        <div className="two-col">
          <div className="field">
            <label>Admitted</label>
            <input
              type="date"
              value={stay.admittedOn ?? ''}
              onChange={(e) => setStay({ admittedOn: e.target.value || undefined })}
            />
          </div>
          <div className="field">
            <label>Discharged</label>
            <input
              type="date"
              value={stay.dischargedOn ?? ''}
              onChange={(e) => setStay({ dischargedOn: e.target.value || undefined })}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Ward</label>
          <input
            value={stay.ward ?? ''}
            placeholder="Paediatric Ward B"
            onChange={(e) => setStay({ ward: e.target.value || undefined })}
          />
        </div>
        {days !== null && (
          <p className={days < 0 ? 'hint stay-bad' : 'hint'}>
            {days < 0
              ? 'The discharge date is before the admission date.'
              : `${days} day${days === 1 ? '' : 's'} in hospital.`}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Course in hospital</h2>
        {stay.course.length === 0 && <p className="empty">Nothing recorded yet.</p>}
        {stay.course.map((para, i) => (
          <div className="entry-row" key={`${para}-${i}`}>
            <span className="text">{para}</span>
            <button
              className="mini"
              aria-label="Remove this paragraph"
              onClick={() => setStay({ course: stay.course.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <AutocompleteInput
          field="problem"
          placeholder="Settled on IV fluids by day 2…"
          onCommit={(text) => setStay({ course: [...stay.course, text] })}
        />
        <p className="hint">
          English, for the next clinician. What the family takes home is written
          in Advice, where both languages are already vouched for.
        </p>
      </section>

      <section className="card">
        <h2>Procedures</h2>
        {stay.procedures.length === 0 && <p className="empty">None recorded.</p>}
        {stay.procedures.map((text, i) => (
          <div className="entry-row" key={`${text}-${i}`}>
            <span className="text">{text}</span>
            <button
              className="mini"
              aria-label={`Remove ${text}`}
              onClick={() => setStay({ procedures: stay.procedures.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <AutocompleteInput
          field="finding"
          placeholder="Lumbar puncture, 12 Jan"
          onCommit={(text) => setStay({ procedures: [...stay.procedures, text] })}
        />
      </section>

      <section className="card">
        <h2>Leaving</h2>
        <div className="field">
          <label>Condition on discharge</label>
          <input
            value={stay.condition ?? ''}
            placeholder="Afebrile, feeding well, ambulant"
            onChange={(e) => setStay({ condition: e.target.value || undefined })}
          />
        </div>
        {/*
          Two fields, not one, and neither is optional in practice. The
          commonest failure of a discharge is not a wrong drug -- it is nobody
          knowing whose clinic the patient belongs to now, which is why
          `domain/documents` refuses to PRINT a summary without a follow-up.
        */}
        <div className="two-col" style={{ marginTop: 8 }}>
          <div className="field">
            <label>Follow-up with</label>
            <input
              value={stay.followUpWith ?? ''}
              placeholder="Dr Shahid, paediatrics"
              onChange={(e) => setStay({ followUpWith: e.target.value || undefined })}
            />
          </div>
          <div className="field">
            <label>Where</label>
            <input
              value={stay.followUpWhere ?? ''}
              placeholder="OPD, Tuesday clinic"
              onChange={(e) => setStay({ followUpWhere: e.target.value || undefined })}
            />
          </div>
        </div>
      </section>
    </>
  );
}
