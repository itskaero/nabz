/**
 * The checklist, as rows you can act on.
 *
 * WHY THE RAIL IS NOT RED
 * -----------------------
 * The obvious scheme is green / amber / red, and it is wrong here. Red in this
 * app means danger and nothing else — an allergy, a red flag — and it is the
 * single most valuable property the palette has (DESIGN.md 3). Spending it on
 * "you have not typed your registration number yet" costs that meaning for
 * something a doctor will fix in fifteen seconds.
 *
 * So: teal for done, which is already this app's "vetted / safe"; amber for
 * everything outstanding, which is already its "not vetted"; and the
 * DIFFERENCE between blocking and merely outstanding is carried by a word,
 * the way every other safety state here carries a word as well as a colour.
 */
import type { SetupDestination, SetupStep } from '@domain/setup.ts';

function state(step: SetupStep): string {
  if (step.done) return 'Done';
  return step.severity === 'blocking' ? 'Needed before you start' : 'Still to do';
}

export function SetupChecklist({
  steps,
  onGo,
}: {
  steps: SetupStep[];
  onGo: (where: SetupDestination) => void;
}) {
  return (
    <ul className="setup-list">
      {steps.map((step) => (
        <li
          key={step.id}
          className="setup-step"
          data-state={step.done ? 'done' : step.severity}
        >
          <div className="setup-head">
            <strong>{step.title}</strong>
            {/*
              The word, not just the rail. Colour is never the only signal
              here, and this is the line a screen reader gets.
            */}
            <span className="setup-state">{state(step)}</span>
          </div>
          <p className="setup-why">{step.why}</p>
          {!step.done && step.action && (
            <button className="btn ghost" onClick={() => onGo(step.action!.go)}>
              {step.action.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
