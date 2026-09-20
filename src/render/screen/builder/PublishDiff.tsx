/**
 * What saving is about to change, before it changes it.
 *
 * Patient-facing changes lead, and are counted separately in the heading. A
 * doctor scanning this at the end of an afternoon needs to know first whether
 * they have altered something a family will read -- an edited formulary row is
 * recoverable, a quietly altered red flag is the thing this app exists not to
 * do quietly.
 */
import { Dialog } from '../components/Dialog.tsx';
import type { Change, PackDiff } from './diff.ts';

const MARK: Record<Change['kind'], string> = { added: '+', removed: '−', changed: '·' };

export function PublishDiff({
  diff,
  onConfirm,
  onCancel,
}: {
  diff: PackDiff;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog label="Review changes before saving" onClose={onCancel}>
      <div className="sheet-modal">
        <h3>
          {diff.total} change{diff.total === 1 ? '' : 's'} will go live
        </h3>
        <p className="sub">
          {diff.patientFacing > 0 ? (
            <>
              <strong>
                {diff.patientFacing} of them change what a patient reads.
              </strong>{' '}
              Every script you write from now on uses this content.
            </>
          ) : (
            <>
              None of them change what a patient reads. Every script you write
              from now on uses this content.
            </>
          )}
        </p>

        {diff.total === 0 && (
          <div className="ok-box">
            <strong>Nothing has changed.</strong>
            The draft matches what is already live.
          </div>
        )}

        <div className="diff-list">
          {diff.sections.map((section) => (
            <div key={section.section} className="diff-section">
              <h4>
                {section.section}
                <span className="badge">{section.changes.length}</span>
              </h4>
              <ul>
                {section.changes.map((change, i) => (
                  <li key={`${change.label}-${change.detail ?? ''}-${i}`} data-kind={change.kind}>
                    <span className="diff-mark" aria-hidden="true">
                      {MARK[change.kind]}
                    </span>
                    {/* The word as well as the mark: a colour and a symbol are
                        not enough on a mono printer or for a colourblind
                        reader (DESIGN.md 8). */}
                    <span className="diff-kind">{change.kind}</span>
                    <span className="diff-label">{change.label}</span>
                    {change.detail && <span className="diff-detail">{change.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="actionbar" style={{ padding: '12px 0 0', borderTop: 'none' }}>
          <button className="btn quiet" onClick={onCancel}>
            Keep editing
          </button>
          <button className="btn" onClick={onConfirm}>
            Save and make live
          </button>
        </div>
      </div>
    </Dialog>
  );
}
