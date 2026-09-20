/**
 * Which kind of document to start.
 *
 * Shown only when the active pack offers more than one (`pack.documents`), so
 * a paediatric OPD doctor who will never write a discharge summary never meets
 * this screen — the same rule the module nav follows.
 *
 * It is a CHOICE AT THE START and there is no way back. Switching an
 * in-progress document would silently re-title sections that are already
 * filled in: "Investigations advised" becoming "Results" changes what the
 * words on the page claim happened, and doing that under a doctor who has
 * stopped reading is the kind of quiet edit this app exists not to make.
 */
import type { DocumentKindMeta } from '@domain/documents/index.ts';
import type { DocumentKindId } from '@domain/documents/index.ts';

interface Props {
  kinds: DocumentKindMeta[];
  current: DocumentKindId;
  onChoose: (kind: DocumentKindId) => void;
  onClose: () => void;
}

export function DocumentKindPicker({ kinds, current, onChoose, onClose }: Props) {
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Start a new document">
      <div className="sheet-modal">
        <h3>Start a new document</h3>
        <p className="sub">
          Anything unsaved in the current one stays unsaved. The kind cannot be
          changed later.
        </p>
        <div className="mode-list">
          {kinds.map((k) => (
            <button
              key={k.id}
              className="mode"
              aria-pressed={k.id === current}
              onClick={() => onChoose(k.id)}
            >
              <span>
                {k.label}
                <small>{describe(k)}</small>
              </span>
            </button>
          ))}
        </div>
        <button className="btn quiet" style={{ marginTop: 10 }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Described by what it PRINTS, not by what it is called. "Discharge summary"
 * means different things in different hospitals; "admission dates, course,
 * medicines to continue" does not.
 */
function describe(kind: DocumentKindMeta): string {
  const names: Partial<Record<string, string>> = {
    stay: 'admission and course',
    problems: 'complaints',
    examination: 'examination',
    diagnosis: 'diagnosis',
    labs: 'investigations',
    medications: 'medicines',
    advice: 'instructions for the patient',
  };
  const parts = kind.sections.map((s) => names[s]).filter(Boolean);
  return parts.join(', ');
}
