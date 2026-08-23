/**
 * Settings: the per-doctor profile, and the backup surface.
 *
 * The backup half is not an afterthought. Records live only on this device and
 * browser storage is evictable -- that is the known v1 weakness (PRODUCT.md 12),
 * and the honest response is to make "Export my data" impossible to miss rather
 * than to hide the risk.
 */
import { useEffect, useRef, useState } from 'react';
import type { LetterheadMode } from '@config/doctorProfile.ts';
import { useStore } from '../store.tsx';
import * as db from '@storage/db.ts';
import {
  backupFilename,
  decryptBackup,
  exportEncrypted,
  importBackup,
} from '@storage/backup.ts';
import { LegacyGrowthResolver } from './LegacyGrowthResolver.tsx';
import { ClinicPairing } from '../clinic/ClinicPairing.tsx';
import { detectSyncMode } from '@storage/clinicSync.ts';
import { parseFee } from '@domain/clinic.ts';
import { applyPatch } from '@domain/patch.ts';
import { hasPin, openGate, setPin } from '@domain/roles.ts';
import { secureContextProblem } from '@domain/secureContext.ts';
import { deviceRole, setDeviceRole } from '@domain/deviceRole.ts';

const MODES: Array<{ id: LetterheadMode; title: string; note: string }> = [
  {
    id: 'text',
    title: 'App prints my details',
    note: 'Plain paper. The app draws your name, qualifications, registration and clinic.',
  },
  {
    id: 'text+logo',
    title: 'App prints my details + logo',
    note: 'Plain paper with your clinic logo alongside the text block.',
  },
  {
    id: 'pad',
    title: 'I use a pre-printed pad',
    note: 'The app prints nothing at the top and keeps a blank zone clear so it never overprints your letterhead.',
  },
];

export function SettingsPanel({ onOpenBuilder }: { onOpenBuilder: () => void }) {
  // Does the origin this app came from run a clinic station? A static host
  // (Railway, or a file the doctor installed) says no, and there is nothing to
  // pair with -- so the pairing box does not appear at all.
  const [sharedOrigin, setSharedOrigin] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    void detectSyncMode(ac.signal)
      .then((mode) => setSharedOrigin(mode === 'clinic'))
      .catch(() => setSharedOrigin(false));
    return () => ac.abort();
  }, []);

  const { profile, setProfile, pack, contentRejected } = useStore();
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [counts, setCounts] = useState<{ rx: number; usage: number; quota: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Null when the browser has given us real crypto. Does not change while the
  // page is open, so it is read once.
  const [cryptoProblem] = useState(secureContextProblem);
  const [role, setRole] = useState(deviceRole);
  const [confirmReception, setConfirmReception] = useState(false);

  useEffect(() => {
    void (async () => {
      const [rx, estimate] = await Promise.all([db.prescriptionCount(), db.storageEstimate()]);
      setCounts({ rx, usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 });
    })();
  }, []);

  const doctor = profile.doctor;
  const setDoctor = (patch: Partial<typeof doctor>) =>
    setProfile({ ...profile, doctor: { ...doctor, ...patch } });

  const exportNow = async () => {
    try {
      const blob = await exportEncrypted(passphrase);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename();
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Backup saved. Keep it somewhere that is not this device.');
      setProfile({ ...profile, lastBackupAt: new Date().toISOString() });
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  const importNow = async (file: File) => {
    try {
      const payload = await decryptBackup(await file.text(), passphrase);
      const summary = await importBackup(payload, 'merge');
      setStatus(
        `Restored ${summary.prescriptions} prescriptions, ${summary.growthSeries} growth records` +
          (summary.skipped ? ` (${summary.skipped} already here)` : '') +
          '.',
      );
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  return (
    <div className="body">
      <section className="card settings-section">
        <h3>Your details</h3>
        <div className="field">
          <label>Name</label>
          <input value={doctor.name} onChange={(e) => setDoctor({ name: e.target.value })} />
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Qualifications</label>
          <input
            value={doctor.qualifications}
            placeholder="MBBS, FCPS (Paediatrics)"
            onChange={(e) => setDoctor({ qualifications: e.target.value })}
          />
        </div>
        <div className="two-col" style={{ marginTop: 8 }}>
          <div className="field">
            <label>Registration body</label>
            <input
              value={doctor.registration.authority}
              placeholder="PMDC / GMC / …"
              onChange={(e) =>
                setDoctor({
                  registration: { ...doctor.registration, authority: e.target.value },
                })
              }
            />
          </div>
          <div className="field num">
            <label>Registration number</label>
            <input
              value={doctor.registration.number}
              onChange={(e) =>
                setDoctor({ registration: { ...doctor.registration, number: e.target.value } })
              }
            />
          </div>
        </div>
        <p className="hint">
          The registration field is whatever your country uses — it is not fixed
          to any one council.
        </p>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Clinic</label>
          <input
            value={doctor.clinicName}
            onChange={(e) => setDoctor({ clinicName: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Address / phone / timings</label>
          <input
            value={doctor.clinicAddress ?? ''}
            placeholder="Address"
            onChange={(e) => setDoctor({ clinicAddress: e.target.value })}
          />
        </div>
      </section>

      <section className="card settings-section">
        <h3>Paper &amp; letterhead</h3>
        <div className="opts" style={{ marginBottom: 10 }}>
          {(['A4', 'Letter'] as const).map((paper) => (
            <button
              key={paper}
              className="opt"
              aria-pressed={profile.paper === paper}
              onClick={() => setProfile({ ...profile, paper })}
            >
              {paper}
            </button>
          ))}
        </div>
        <div className="mode-list">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              className="mode"
              aria-pressed={profile.letterhead.mode === mode.id}
              onClick={() =>
                setProfile({
                  ...profile,
                  letterhead: { ...profile.letterhead, mode: mode.id },
                })
              }
            >
              <div>
                <strong>{mode.title}</strong>
                <small>{mode.note}</small>
              </div>
            </button>
          ))}
        </div>
        {profile.letterhead.mode === 'pad' && (
          <div className="field num" style={{ marginTop: 10 }}>
            <label>Blank zone at the top (mm)</label>
            <input
              inputMode="numeric"
              value={String(profile.letterhead.reservedTopMm)}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  letterhead: {
                    ...profile.letterhead,
                    reservedTopMm: Number(e.target.value) || 0,
                  },
                })
              }
            />
            <p className="hint">
              Measure your pad and put the number here. The preview shows the zone
              so you can check it before you waste a sheet.
            </p>
          </div>
        )}
      </section>

      <section className="card settings-section">
        <h3>Your records live only on this device</h3>
        <div className="warn-box">
          <strong>Back up regularly.</strong>
          Nothing is sent to any server — that is deliberate, and it means nobody
          else holds your patients&rsquo; data. It also means a lost phone, a
          cleared browser or a reinstalled app is a lost record. Export a backup
          and keep it somewhere else.
        </div>
        {counts && (
          <p className="hint">
            {counts.rx} prescriptions stored
            {counts.quota
              ? ` · ${(counts.usage / 1e6).toFixed(1)} MB of ~${(counts.quota / 1e6).toFixed(0)} MB available`
              : ''}
            {profile.lastBackupAt
              ? ` · last backup ${profile.lastBackupAt.slice(0, 10)}`
              : ' · never backed up'}
          </p>
        )}
        {/*
          A button that throws when pressed is worse than a button that says why
          it cannot work. On a plain-HTTP address the browser has taken
          crypto.subtle away, so there is no encryption to be had here at all.
        */}
        {cryptoProblem && (
          <div className="warn-box" style={{ margin: '8px 0' }}>
            <strong>Backup is unavailable on this address.</strong>
            {cryptoProblem}
          </div>
        )}
        <div className="field" style={{ marginTop: 8 }}>
          <label>Backup passphrase</label>
          <input
            type="password"
            value={passphrase}
            disabled={!!cryptoProblem}
            placeholder="at least 8 characters"
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <p className="hint">
            The file is encrypted with this. There is no way to recover it if you
            forget — that is what makes the backup safe to keep on a memory stick.
          </p>
        </div>
        <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
          <button
            className="btn"
            disabled={!!cryptoProblem || passphrase.length < 8}
            title={cryptoProblem ?? undefined}
            onClick={exportNow}
          >
            Export my data
          </button>
          <button
            className="btn ghost"
            disabled={!!cryptoProblem || passphrase.length < 8}
            title={cryptoProblem ?? undefined}
            onClick={() => fileInput.current?.click()}
          >
            Restore a backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importNow(file);
              e.target.value = '';
            }}
          />
        </div>
        {status && <p className="hint">{status}</p>}
      </section>

      <section className="card settings-section">
        <h3>What this computer is for</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          {role === 'reception'
            ? 'The front desk. This machine holds the queue and payments — prescriptions cannot be written or saved here.'
            : 'The doctor’s own device. Prescriptions, examinations and growth records live here, and nowhere else.'}
        </p>

        {role === 'reception' ? (
          <button
            className="btn quiet"
            onClick={() => {
              setDeviceRole('consulting');
              setRole('consulting');
              setStatus('This is now the doctor’s device. Reload to see the clinical sections.');
            }}
          >
            Make this the doctor&rsquo;s device
          </button>
        ) : (
          <button className="btn quiet" onClick={() => setConfirmReception(true)}>
            Make this the front desk
          </button>
        )}

        {/*
          Switching a device that already holds records is the dangerous
          direction: the records are not deleted, but nothing on a reception
          station can reach them. Say the number out loud rather than letting
          someone discover it.
        */}
        {confirmReception && (
          <div className="warn-box" style={{ margin: '10px 0' }}>
            <strong>
              {counts?.rx
                ? `${counts.rx} prescriptions are stored on this device.`
                : 'Nothing clinical is stored on this device yet.'}
            </strong>
            {counts?.rx
              ? ' They will not be deleted, but a front-desk computer cannot open them. Export a backup first, then switch.'
              : ' Safe to switch.'}
            <div className="actionbar" style={{ padding: '8px 0 0', borderTop: 'none' }}>
              <button className="btn quiet" onClick={() => setConfirmReception(false)}>
                Cancel
              </button>
              <button
                className="btn quiet danger"
                onClick={() => {
                  setDeviceRole('reception');
                  setRole('reception');
                  setConfirmReception(false);
                  setStatus('This is now the front desk. Reload to apply.');
                }}
              >
                Switch to front desk
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card settings-section">
        <h3>Clinic queue</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          A queue of who is waiting, whether they have paid, and a running total
          for the day. Off unless you need it — a doctor working alone loses
          nothing by leaving it off.
        </p>
        <button
          className="mode"
          style={{ width: '100%' }}
          aria-pressed={profile.clinic.enabled}
          onClick={() =>
            setProfile({
              ...profile,
              clinic: { ...profile.clinic, enabled: !profile.clinic.enabled },
            })
          }
        >
          <div>
            <strong>
              {profile.clinic.enabled ? 'Queue is on' : 'Turn the queue on'}
            </strong>
            <small>
              Adds a Queue tab. It holds names, ages and fees — never diagnoses
              or medicines, which stay on this device with the prescriptions.
            </small>
          </div>
        </button>
        {profile.clinic.enabled && (
          <div className="two-col" style={{ marginTop: 10 }}>
            <div className="field num">
              <label>Usual visit fee</label>
              <input
                inputMode="decimal"
                value={
                  profile.clinic.defaultFeeMinor !== undefined
                    ? String(profile.clinic.defaultFeeMinor / 100)
                    : ''
                }
                placeholder="1500"
                onChange={(e) => {
                  const minor = parseFee(e.target.value);
                  setProfile({
                    ...profile,
                    clinic: applyPatch(profile.clinic, { defaultFeeMinor: minor }),
                  });
                }}
              />
            </div>
            <div className="field">
              <label>Currency</label>
              <input
                value={profile.clinic.currency}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    clinic: { ...profile.clinic, currency: e.target.value },
                  })
                }
              />
            </div>
          </div>
        )}
        {profile.clinic.enabled && sharedOrigin && (
          <>
            <h3 style={{ marginTop: 18 }}>Pair with the clinic station</h3>
            <ClinicPairing />
          </>
        )}
      </section>

      <section className="card settings-section">
        <h3>Sharing this machine</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          If a receptionist uses this computer, a PIN keeps prescriptions,
          examinations and patient history out of casual view. The queue and
          payments stay open so they can work without you.
        </p>
        <div className="warn-box" style={{ margin: '8px 0' }}>
          <strong>This is a curiosity gate, not security.</strong>
          Anyone with the device and the will can get past a PIN in a browser.
          The protection that actually holds is running the queue on a separate
          machine, where the records simply are not present.
        </div>
        {hasPin(profile.roleGate) ? (
          <button
            className="btn danger"
            onClick={() => setProfile({ ...profile, roleGate: openGate })}
          >
            Remove the PIN
          </button>
        ) : cryptoProblem ? (
          /*
            The PIN digest needs the same WebCrypto the backup does. Setting one
            here would create a gate that could never be opened again — so it is
            refused rather than half-offered.
          */
          <p className="hint">
            A PIN cannot be set on this address: {cryptoProblem}
          </p>
        ) : (
          <div className="compose">
            <input
              type="password"
              inputMode="numeric"
              aria-label="New doctor PIN"
              value={newPin}
              placeholder="4 to 8 digits"
              onChange={(e) => setNewPin(e.target.value)}
            />
            <button
              className="btn"
              disabled={!/^\d{4,8}$/.test(newPin)}
              onClick={async () => {
                try {
                  setProfile({ ...profile, roleGate: await setPin(newPin) });
                  setNewPin('');
                  setStatus('PIN set.');
                } catch (err) {
                  setStatus((err as Error).message);
                }
              }}
            >
              Set PIN
            </button>
          </div>
        )}
        {profile.roleGate.recentUnlocks.length > 0 && (
          <p className="hint">
            Last unlocked {profile.roleGate.recentUnlocks[0]!.slice(0, 16).replace('T', ' ')}
          </p>
        )}
      </section>

      <LegacyGrowthResolver />

      <section className="card settings-section">
        <h3>Content pack</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Currently loaded: <strong>{pack.specialty}</strong> — {pack.examSystems.length}{' '}
          exam systems, {pack.formularySeed.length} medicines,{' '}
          {pack.dosing.length} cited doses. Exam chips, advice wording, the drug
          list and the Urdu phrase library all come from the pack; adding
          another specialty means adding a pack, not changing the app.
        </p>
        {contentRejected.length > 0 && (
          <div className="warn-box" style={{ margin: '8px 0' }}>
            <strong>Your edited content is not in use.</strong>
            It failed validation, so the built-in packs are running instead.
            Open the builder to see what is wrong.
          </div>
        )}
        <div className="warn-box" style={{ margin: '8px 0' }}>
          <strong>Editing content changes what patients are given.</strong>
          The builder edits the drug list, the dosing citations and the Urdu
          wording that gets printed. Changes apply to every script you write
          after saving.
        </div>
        <button className="btn ghost" onClick={onOpenBuilder}>
          Open the pack builder
        </button>
      </section>
    </div>
  );
}
