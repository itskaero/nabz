/**
 * What is this computer for? Asked once, on first run.
 *
 * Deliberately a full-screen choice rather than a setting buried in Settings.
 * The whole value of the reception role is that clinical records never reach
 * that machine, and a default nobody was asked about is a default nobody
 * applies — the reception PC would stay a doctor's PC and the guarantee would
 * quietly not hold.
 *
 * Written for whoever is physically installing it, which in a small clinic is
 * usually not the doctor. So it describes the machine's job, not a permission
 * model: "the computer at the front desk", not "role: receptionist".
 */
import { useState } from 'react';
import type { DeviceRole } from '@domain/deviceRole.ts';
import { setDeviceRole } from '@domain/deviceRole.ts';

export function DeviceRolePicker({ onChosen }: { onChosen: (role: DeviceRole) => void }) {
  const [picked, setPicked] = useState<DeviceRole | null>(null);

  const choose = (role: DeviceRole) => {
    setDeviceRole(role);
    onChosen(role);
  };

  return (
    <div className="body">
      <section className="card">
        <h2>What is this computer for?</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Asked once. It decides what this machine is allowed to hold, so it is
          worth getting right — but you can change it later in Settings.
        </p>

        <button
          className="mode"
          style={{ width: '100%', marginTop: 10 }}
          aria-pressed={picked === 'consulting'}
          onClick={() => setPicked('consulting')}
        >
          <div>
            <strong>The doctor&rsquo;s own device</strong>
            <small>
              Writing prescriptions, examinations, growth charts and history.
              Everything clinical lives here and nowhere else, which is why this
              is the device that has to be backed up.
            </small>
          </div>
        </button>

        <button
          className="mode"
          style={{ width: '100%', marginTop: 8 }}
          aria-pressed={picked === 'reception'}
          onClick={() => setPicked('reception')}
        >
          <div>
            <strong>The computer at the front desk</strong>
            <small>
              Today&rsquo;s queue, who has paid, and the day&rsquo;s total.
              Prescriptions, examinations and growth records are not shown and
              cannot be saved here at all.
            </small>
          </div>
        </button>

        {picked === 'reception' && (
          <div className="warn-box" style={{ margin: '12px 0' }}>
            <strong>Nothing clinical will be stored on this computer.</strong>
            That is the point of the setting, not a side effect: the doctor&rsquo;s
            records stay on the doctor&rsquo;s device, so whoever sits at this
            desk has nothing to read. Writing a script here will be refused.
          </div>
        )}

        {picked === 'consulting' && (
          <div className="warn-box" style={{ margin: '12px 0' }}>
            <strong>This device will hold the only copy of every record.</strong>
            Nothing is sent to any server. Set up a backup as soon as you have
            finished here — a lost or cleared device is a lost record.
          </div>
        )}

        <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
          <button className="btn" disabled={!picked} onClick={() => picked && choose(picked)}>
            {picked === 'reception'
              ? 'Set up as the front desk'
              : picked === 'consulting'
                ? 'Set up as the doctor’s device'
                : 'Choose one to continue'}
          </button>
        </div>
      </section>
    </div>
  );
}
