/**
 * A compact, read-only patient identity strip for module panels (eGFR,
 * BMI/BSA, Scores) -- critique P0. Age and sex feed these calculations, and
 * until this existed nothing on screen said whose numbers a module was
 * computing, in a codebase that otherwise treats "which patient" as
 * important enough to warrant an explicit confirm-tap even within one
 * encounter (PRODUCT.md rule 3.4).
 *
 * Deliberately minimal: this is not a second patient bar, just enough to
 * answer "whose script is this" at a glance.
 */
import { useStore } from '../store.tsx';

export function PatientStrip() {
  const { rx } = useStore();
  const p = rx.patient;
  const sex = p.sex === 'M' ? 'M' : p.sex === 'F' ? 'F' : null;
  if (!p.name && !p.age && !sex) return null;

  return (
    <div className="patient-strip">
      <span className="who">{p.name || 'Unnamed'}</span>
      {(p.age || sex) && (
        <span className="meta">
          {[p.age, sex].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  );
}
