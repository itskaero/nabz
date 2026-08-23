/**
 * Pairing a doctor's device with the clinic station.
 *
 * WHY A CODE AT ALL
 * -----------------
 * The station answers on the clinic's wifi. Without a shared secret, every
 * phone on that network -- patients' included, if the wifi is shared -- can
 * fetch the whole day's patient list by guessing one URL. Six digits typed once
 * per device is the smallest thing that closes that, and it is honest about
 * what it is: the traffic is still plain HTTP, so this stops curiosity and
 * casual snooping, not someone with a packet capture.
 *
 * The code lives in localStorage rather than IndexedDB because it is a fact
 * about this DEVICE, not a clinical record -- it must not ride along inside an
 * encrypted backup that is later restored onto a different machine.
 */
import { useState } from 'react';
import { forgetPairing, pairedCode, setPairedCode } from '@storage/clinicSync.ts';
import { isReceptionDevice } from '@domain/deviceRole.ts';

export function ClinicPairing({ onPaired }: { onPaired?: () => void }) {
  const [code, setCode] = useState('');
  const [paired, setPaired] = useState(() => pairedCode());

  const pair = () => {
    const clean = code.replace(/\D/g, '');
    if (clean.length < 4) return;
    setPairedCode(clean);
    setPaired(clean);
    setCode('');
    onPaired?.();
  };

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        The station prints a six-digit code in its window when it starts. Type it
        here once and this device stays paired.
      </p>
      {paired ? (
        <div className="pairing-row">
          <span className="mono">Paired · {paired.replace(/\d(?=\d{2})/g, '•')}</span>
          <button
            className="btn quiet"
            onClick={() => {
              forgetPairing();
              setPaired(null);
            }}
          >
            Unpair this device
          </button>
        </div>
      ) : (
        <div className="pairing-row">
          <div className="field num" style={{ flex: 1 }}>
            <label>Pairing code</label>
            <input
              inputMode="numeric"
              autoComplete="off"
              aria-label="Clinic pairing code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') pair();
              }}
            />
          </div>
          <button className="btn" disabled={code.replace(/\D/g, '').length < 4} onClick={pair}>
            Pair
          </button>
        </div>
      )}
      {/*
        The same fact, told from where the reader is standing. On a front desk
        "records never leave this device" implies they are here; they are not,
        and that is the whole point of the machine.
      */}
      <p className="hint">
        Pairing shares the queue only — names, ages, tokens and payment.{' '}
        {isReceptionDevice()
          ? 'Prescriptions, examinations and growth records are never stored on this computer at all.'
          : 'Prescriptions, examinations and growth records never leave this device.'}
      </p>
    </>
  );
}
