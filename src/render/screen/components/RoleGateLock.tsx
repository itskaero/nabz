/**
 * The lock over the clinical side of a shared machine.
 *
 * Shown when a PIN is set and someone tries to reach a view a receptionist
 * should not see. It is honest about what it is: a curiosity gate, not
 * security. On a two-station clinic the records are not on the reception
 * machine at all, and that is the protection that actually holds.
 */
import { useState } from 'react';
import { checkPin, recordUnlock } from '@domain/roles.ts';
import { useStore } from '../store.tsx';

export function RoleGateLock({ onUnlock }: { onUnlock: () => void }) {
  const { profile, setProfile } = useStore();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = async () => {
    if (await checkPin(profile.roleGate, pin)) {
      setProfile({ ...profile, roleGate: recordUnlock(profile.roleGate) });
      setPin('');
      setWrong(false);
      onUnlock();
    } else {
      setWrong(true);
      setPin('');
    }
  };

  return (
    <div className="body">
      <section className="card">
        <h2>Doctor&rsquo;s PIN</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Prescriptions, examinations and patient history are behind this. The
          queue and payments are not — reception can keep working without it.
        </p>
        <div className="compose" style={{ marginTop: 10 }}>
          <input
            type="password"
            inputMode="numeric"
            aria-label="Doctor PIN"
            value={pin}
            placeholder="PIN"
            onChange={(e) => {
              setPin(e.target.value);
              setWrong(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          <button className="btn" disabled={pin.length < 4} onClick={submit}>
            Unlock
          </button>
        </div>
        {wrong && (
          <p className="hint" style={{ color: 'var(--alert)' }}>
            That PIN did not match.
          </p>
        )}
      </section>
    </div>
  );
}
