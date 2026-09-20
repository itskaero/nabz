/**
 * The first screen, until there is no reason for it.
 *
 * A doctor who installs this app is asked, over the following week and by
 * four unrelated pieces of the interface, to classify the device, fill in a
 * registration number, pair to a station and invent a backup password that
 * nobody can ever recover. None of those is hard. What makes setup
 * frightening is that it arrives as a series of interruptions with no visible
 * end, so there is no moment at which anyone can say it is finished.
 *
 * This is that moment, said once and in one place.
 *
 * It shows only until the blocking steps are answered; after that the app
 * opens straight onto a blank script, so nothing is added to the OPD path
 * (`setupComplete`). It stays reachable from the nav afterwards, because the
 * backup row keeps its colour until a file has actually been written and a
 * doctor needs somewhere to go and see that.
 */
import type { SetupDestination, SetupStep } from '@domain/setup.ts';
import { outstanding } from '@domain/setup.ts';
import { SetupChecklist } from './SetupChecklist.tsx';

function summary(steps: SetupStep[]): string {
  const todo = outstanding(steps);
  const blocking = todo.filter((s) => s.severity === 'blocking').length;
  if (todo.length === 0) {
    return 'Everything on this list is done. This device is ready to prescribe from.';
  }
  if (blocking === 0) {
    return todo.length === 1
      ? 'You can start writing. One thing is still worth doing.'
      : `You can start writing. ${todo.length} things are still worth doing.`;
  }
  return blocking === 1
    ? 'One thing has to be answered before the first script.'
    : `${blocking} things have to be answered before the first script.`;
}

export function HomeView({
  steps,
  onGo,
  onStart,
  canStart,
}: {
  steps: SetupStep[];
  onGo: (where: SetupDestination) => void;
  onStart: () => void;
  /** false while a blocking step is outstanding */
  canStart: boolean;
}) {
  return (
    <div className="body">
      <div className="card setup-card">
        <h2 className="setup-title">Set up this device</h2>
        <p className="setup-summary">{summary(steps)}</p>
        <SetupChecklist steps={steps} onGo={onGo} />
        <button className="btn" onClick={onStart} disabled={!canStart}>
          {canStart ? 'Write a script' : 'Finish the steps above first'}
        </button>
      </div>
    </div>
  );
}
