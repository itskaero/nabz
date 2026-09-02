/**
 * The shell (DESIGN.md 11): top bar, allergy banner, section tabs tagged with
 * the language each one prints in, scrolling body, bottom action bar.
 *
 * The language tags on the tabs are not decoration. They are the whole product
 * model made visible: this is not a "bilingual app", it is an app where each
 * section speaks to whoever reads it (PRODUCT.md 6). A doctor who can see that
 * Medications is EN·UR and Advice is UR·EN understands the document before
 * printing it.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { languageFor } from '@config/doctorProfile.ts';
import type { SectionId } from '@config/appDefaults.ts';
import { appDefaults } from '@config/appDefaults.ts';
import { isBlank } from '@domain/prescription.ts';
import { findingCount } from '@domain/exam.ts';
import { buildDocument } from '@render/pdf/layout.ts';
import { renderPdfBlob, sharePrescription } from '@render/pdf/renderPdf.ts';
import { loadFonts, fontsReady } from '@render/text/engine.ts';
import * as db from '@storage/db.ts';
import { useStore } from './store.tsx';
import { ListSection } from './sections/ListSection.tsx';
import { ExamSection } from './sections/ExamSection.tsx';
import { LabsSection } from './sections/LabsSection.tsx';
import { MedicationsSection } from './sections/MedicationsSection.tsx';
import { AdviceSection } from './sections/AdviceSection.tsx';
import { PreviewSheet } from './components/PreviewSheet.tsx';
import { MODULE_PANEL } from './modules/registry.tsx';
import { MODULE_META } from '@domain/modules/index.ts';
import type { ModuleId } from '@domain/pack.ts';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { PatientPicker } from './components/PatientPicker.tsx';
import { RoleGateLock } from './components/RoleGateLock.tsx';
import { canAccess, hasPin } from '@domain/roles.ts';
import { hasWebCrypto } from '@domain/secureContext.ts';
import type { DeviceRole } from '@domain/deviceRole.ts';
import { deviceRole, deviceAllows } from '@domain/deviceRole.ts';
import { colorScheme, applyColorScheme } from '@domain/colorScheme.ts';
import { DeviceRolePicker } from './components/DeviceRolePicker.tsx';
import { useBackgroundSync } from './clinic/useBackgroundSync.ts';
import { HomePanel } from './components/HomePanel.tsx';

/** Lazy: an authoring/ops surface should not weigh on opening a script. */
const ClinicPanel = lazy(() =>
  import('./clinic/ClinicPanel.tsx').then((m) => ({ default: m.ClinicPanel })),
);

/**
 * The pack builder is lazy. It is an authoring tool used occasionally by one
 * person; the clinical app is used all day by someone in a hurry, and should
 * not carry the editor's weight to open a script.
 */
const PackBuilder = lazy(() =>
  import('./builder/PackBuilder.tsx').then((m) => ({ default: m.PackBuilder })),
);

/** Scores are pack data (§4c), not a module -- lazy for the same reason as the rest. */
const ScoresPanel = lazy(() =>
  import('./components/ScoresPanel.tsx').then((m) => ({ default: m.ScoresPanel })),
);

/**
 * `ModuleId` folds straight into `View`: every module id IS a valid view,
 * chosen the moment it is added to `domain/pack.ts`'s closed union. That is
 * what lets the nav below be GENERATED from `pack.modules` instead of one
 * hardcoded button per module -- the Growth button used to be gated on device
 * role alone and never on whether the active pack actually offered growth,
 * which meant a pack with `modules: []` still showed a tab leading nowhere.
 */
type View =
  | 'home'
  | 'write'
  | 'preview'
  | 'history'
  | 'settings'
  | 'builder'
  | 'clinic'
  | 'scores'
  | ModuleId;

const TAB_ORDER: SectionId[] = [
  'problems',
  'examination',
  'diagnosis',
  'labs',
  'medications',
  'advice',
];

const TAB_LABEL: Record<SectionId, string> = {
  problems: 'Problems',
  examination: 'Exam',
  diagnosis: 'Diagnosis',
  labs: 'Tests',
  medications: 'Medicines',
  advice: 'Advice',
};

const SHORT: Record<string, string> = { en: 'EN', 'ur-PK': 'UR' };

/**
 * Whether this device can hand a file to another app. Decides the button's
 * wording only -- the action falls back to a download either way.
 */
function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/**
 * Scrolls the strip's active child into view whenever `dep` changes -- shared
 * by the top nav (`[aria-pressed]`, keyed on `view`) and the section-tabs
 * strip (`role="tab"` uses `[aria-selected]` instead, keyed on `tab`), so
 * overflowing either one at 390px doesn't lose the doctor's place (critique
 * P1). A 2nd-pass critique found this covering only the top nav; both strips
 * go through the same hook now.
 */
function useScrollActiveIntoView(ref: RefObject<HTMLElement | null>, dep: unknown): void {
  useEffect(() => {
    const active = ref.current?.querySelector('[aria-pressed="true"], [aria-selected="true"]');
    // scrollIntoView is unimplemented in jsdom (and, defensively, on any
    // other environment that doesn't offer it) -- this call is a UX nicety,
    // not something the app depends on to function.
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}

export function App() {
  const store = useStore();
  const { rx, profile, pack, phrases, contentRejected, dirty, save, startNew } = store;
  /*
    A doctor's device lands on Home -- the practice-analytics summary, with
    "New prescription" as its one unmistakable primary action -- rather than
    dropping straight into a blank script. Reception is unchanged: the queue
    is the only thing that machine does, so it still opens directly there.
  */
  const [view, setView] = useState<View>(() =>
    deviceRole() === 'reception' ? 'clinic' : 'home',
  );
  const [tab, setTab] = useState<SectionId>('problems');
  const [fontsLoaded, setFontsLoaded] = useState(fontsReady());
  const [fontError, setFontError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nagBackup, setNagBackup] = useState(false);
  // Read once: whether the browser has given us real crypto does not change
  // while the page is open.
  const [secure] = useState(hasWebCrypto);
  const [unlocked, setUnlocked] = useState(false);
  // Null until someone says what this machine is for. Asked once, then stored
  // per-device -- never in the profile, which travels inside the backup.
  const [role, setRole] = useState<DeviceRole | null>(deviceRole);
  const reception = role === 'reception';
  /**
   * Ask only on a genuinely fresh install.
   *
   * An unclassified device already behaves as a consulting one, so a machine
   * that has prescriptions on it is obviously the doctor's -- putting a
   * full-screen question in front of someone who just updated the app would be
   * noise, and the answer is already implied by the records sitting there.
   * They can still switch in Settings.
   */
  const [askRole, setAskRole] = useState(false);
  useEffect(() => {
    if (deviceRole() !== null) return;
    void db.prescriptionCount().then((n) => setAskRole(n === 0));
  }, []);

  /*
    Applies the doctor's chosen (or OS-default) theme before/at first paint --
    index.html's inline script already did this once to avoid a flash, this
    keeps it correct if the OS signal changes while the app stays open and
    the stored preference is 'system' (DESIGN.md 14a).
  */
  useEffect(() => {
    applyColorScheme();
    // matchMedia is absent in some test/embed contexts (jsdom does not
    // implement it) -- colorScheme.ts's own functions already guard their
    // internal use of it, but this listener is opt-in extra behaviour, not
    // something the app needs to run at all when it is unavailable.
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (colorScheme() === 'system') applyColorScheme();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Both the top nav and the section-tabs strip scroll sideways at 390px once
  // enough buttons are on (critique P1) -- this keeps the ACTIVE one in view
  // on selection in either strip, rather than relying on a doctor noticing
  // the edge-fade hint and scrolling by hand to find where they already are.
  // A 2nd-pass critique found this wired to .topbar-nav only -- .tabs (the
  // in-script Problems/Exam/.../Advice strip) overflows too and had no
  // coverage at all, so both refs now go through the same effect.
  const navRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  useScrollActiveIntoView(navRef, view);
  useScrollActiveIntoView(tabsRef, tab);

  useEffect(() => {
    if (fontsLoaded) return;
    void loadFonts(async (file) => {
      const res = await fetch(`/fonts/${file}`);
      if (!res.ok) throw new Error(`could not load /fonts/${file} (${res.status})`);
      return res.arrayBuffer();
    })
      .then(() => {
        setFontsLoaded(true);
        setFontError(null);
      })
      .catch((err: unknown) => {
        // Say what went wrong. Writing the script still works; only the
        // preview and the PDF need the shaper, and a doctor is owed the reason
        // rather than a button that quietly stays greyed out.
        setFontsLoaded(false);
        setFontError(err instanceof Error ? err.message : String(err));
      });
  }, [fontsLoaded]);

  // The backup nag is deliberately repeated rather than dismissed forever.
  useEffect(() => {
    void (async () => {
      const [last, count] = await Promise.all([db.lastBackupAt(), db.prescriptionCount()]);
      if (count === 0) return;
      const days = last
        ? (Date.now() - Date.parse(last)) / 86400000
        : Number.POSITIVE_INFINITY;
      setNagBackup(days > appDefaults.backupReminderDays);
    })();
  }, [view]);

  /*
    The queue syncs wherever the doctor is looking, not only on the queue
    screen. Polling used to live inside ClinicPanel, so a doctor writing a
    script -- most of the day -- synced not at all, and reception's additions
    simply did not arrive until someone opened the queue.
  */
  const sync = useBackgroundSync({
    enabled: profile.clinic.enabled,
    watching: view === 'clinic',
  });

  const counts = useMemo(
    () => ({
      problems: rx.problems.length,
      examination: rx.examination.reduce((n, s) => n + findingCount(s), 0),
      diagnosis: rx.diagnosis.length,
      labs: rx.labs.length,
      medications: rx.medications.length,
      advice: rx.advice.length,
    }),
    [rx],
  );

  /**
   * A PIN set on a shared machine hides the clinical side until someone unlocks
   * it. The queue and payments stay reachable, because that is the receptionist's
   * job and they should not need the doctor to do it.
   */
  const locked =
    hasPin(profile.roleGate) && !unlocked && !canAccess('receptionist', view);

  /**
   * The device role and the PIN are different mechanisms and both apply.
   *
   * The PIN hides what IS on a shared machine; the device role means it is not
   * there at all. `deviceAllows` is checked at the render site as well as in
   * the nav, so a stale `view` — restored state, a deep link, a bug — cannot
   * put a clinical surface on a reception station.
   */
  const shown = (v: View) => deviceAllows(v) && !locked;

  const model = useMemo(() => {
    if (view !== 'preview' || !fontsLoaded) return null;
    return buildDocument({ rx, profile, pack, packs: phrases, defaults: appDefaults });
  }, [view, fontsLoaded, rx, profile, pack, phrases]);

  const doSave = useCallback(async () => {
    setBusy('Saving…');
    try {
      await save();
      /*
        A script opened from the queue ends by going back to the queue. Saving
        already closed that visit, so leaving the doctor on a finished script
        means the next thing they do is navigate away by hand -- and the queue
        they need is one tap further than it should be at the busiest moment.

        A script NOT from the queue stays put: a solo doctor saving mid-consult
        has nowhere else to be sent.
      */
      if (store.fromQueue) {
        startNew();
        setView('clinic');
      }
    } finally {
      setBusy(null);
    }
  }, [save, store.fromQueue, startNew]);

  const deliverPdf = useCallback(async () => {
    if (!model) return;
    setBusy('Building PDF…');
    try {
      const blob = await renderPdfBlob(model);
      // Share sheet where the device has one -- that is how a script reaches a
      // parent's WhatsApp without us ever touching WhatsApp. Download otherwise.
      const how = await sharePrescription(model, blob);
      if (how === 'downloaded') setBusy(null);
    } finally {
      setBusy(null);
    }
  }, [model]);

  /*
    Asked before anything else renders. A reception station that was never
    classified is just a doctor's PC, and the guarantee this setting exists to
    make would quietly not hold.
  */
  if (role === null && askRole) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            Nabz
            <small>first-time setup</small>
          </div>
        </header>
        <DeviceRolePicker
          onChosen={(chosen) => {
            setRole(chosen);
            setView(chosen === 'reception' ? 'clinic' : 'home');
            // The queue is off by default so a solo doctor never meets it, but
            // it is the ONLY thing a front desk does -- leaving it off hands
            // the receptionist a blank screen.
            if (chosen === 'reception' && !profile.clinic.enabled) {
              store.setProfile({
                ...profile,
                clinic: { ...profile.clinic, enabled: true },
              });
            }
          }}
        />
      </div>
    );
  }

  return (
    /*
      The doctor's surface is mobile-first at ~390px (DESIGN.md 11). The
      reception station is a desk scanning twenty rows, so the clinic view is
      allowed the width -- the constraint was never about taste, it was about
      one-handed use that does not apply here.
    */
    <div className="app" data-wide={view === 'clinic' || view === 'builder'}>
      <header className="topbar">
        <div className="brand">
          Nabz
          <small>{reception ? 'front desk' : 'on this device only'}</small>
        </div>
        <div className="spacer" />
        {/*
          On a reception station the clinical destinations are NOT RENDERED --
          not disabled, not PIN-hidden. There is nothing behind them on this
          machine, and a greyed-out button implies there is.
        */}
        <nav className="topbar-nav" ref={navRef}>
          {!reception && (
            <button
              className="icon-btn"
              aria-pressed={view === 'home'}
              onClick={() => setView('home')}
            >
              Home
            </button>
          )}
          {profile.clinic.enabled && (
            <button
              className="icon-btn"
              aria-pressed={view === 'clinic'}
              onClick={() => setView(view === 'clinic' ? 'write' : 'clinic')}
            >
              Queue
            </button>
          )}
          {!reception &&
            pack.modules.map((id) => (
              <button
                key={id}
                className="icon-btn"
                aria-pressed={view === id}
                onClick={() => setView(view === id ? 'write' : id)}
              >
                {MODULE_META[id].label}
              </button>
            ))}
          {!reception && (pack.scores?.length ?? 0) > 0 && (
            <button
              className="icon-btn"
              aria-pressed={view === 'scores'}
              onClick={() => setView(view === 'scores' ? 'write' : 'scores')}
            >
              Scores
            </button>
          )}
          {!reception && (
            <button
              className="icon-btn"
              aria-pressed={view === 'history'}
              onClick={() => setView(view === 'history' ? 'write' : 'history')}
            >
              History
            </button>
          )}
          <button
            className="icon-btn"
            aria-pressed={view === 'settings'}
            onClick={() =>
              setView(view === 'settings' ? (reception ? 'clinic' : 'write') : 'settings')
            }
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Persistent, above the working area, on every view (DESIGN.md 11). */}
      {rx.patient.allergies?.trim() && (
        <div className="banner banner-allergy" role="alert">
          <span>ALLERGY — {rx.patient.allergies}</span>
        </div>
      )}

      {/*
        NOT dismissible, and deliberately above the backup nag.

        A plain-HTTP LAN address is not a secure context, so the browser removes
        crypto.subtle — and with it the encrypted backup, on a device that holds
        the only copy of every record. It used to fail silently, which is the
        one behaviour this product cannot afford. Amber rather than red: red is
        danger and the allergy banner owns it (DESIGN.md 3).
      */}
      {!secure && (
        <div className="banner banner-backup" role="status">
          <span>
            <strong>This device cannot back itself up.</strong> The app was
            opened over a plain connection, so the browser has switched off
            encrypted backup, the PIN and offline use. Open the address starting{' '}
            <code>https://</code> that the clinic station prints, or open the app
            on the computer itself.
          </span>
        </div>
      )}

      {nagBackup && (
        <div className="banner banner-backup">
          <span>
            Records live only on this device. It has been a while since your last
            backup.
          </span>
          <button onClick={() => setView('settings')}>Export now</button>
        </div>
      )}

      {!fontsLoaded && !fontError && (
        <div className="banner banner-backup">
          <span>Loading the Urdu typeface… the preview needs it to be exact.</span>
        </div>
      )}

      {/*
        Amber, not red, and role="status", not "alert". Red is danger only
        (DESIGN.md 3) and the allergy banner owns it; a typesetting failure is
        serious but it is not a clinical hazard, and there must be exactly one
        thing on this screen that shouts.
      */}
      {fontError && (
        <div className="banner banner-backup" role="status">
          <span>
            The typesetting engine did not load, so preview and print are
            unavailable. You can still write and save this script. ({fontError})
          </span>
          <button
            onClick={() => {
              setFontError(null);
              setFontsLoaded(false);
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/*
        An edited pack that fails validation is IGNORED, not patched up, and
        the doctor is told rather than left to notice that a chip went missing.
        See data/provider.ts.
      */}

      {contentRejected.length > 0 && (
        <div className="banner banner-backup" role="status">
          <span>
            Your edited content did not load and the built-in packs are being
            used instead: {contentRejected[0]}
            {contentRejected.length > 1 ? ` (+${contentRejected.length - 1} more)` : ''}
          </span>
          <button onClick={() => setView('builder')}>Open builder</button>
        </div>
      )}

      {locked && (
        <RoleGateLock
          onUnlock={() => {
            setUnlocked(true);
          }}
        />
      )}

      {!reception && view === 'home' && (
        <HomePanel onNew={() => setView('write')} onOpenHistory={() => setView('history')} />
      )}

      {shown('write') && view === 'write' && (
        <>
          <PatientBar />
          <nav className="tabs" role="tablist" ref={tabsRef}>
            {TAB_ORDER.map((id) => {
              const lang = languageFor(profile, id);
              const tag = lang.secondary
                ? `${SHORT[lang.primary]}·${SHORT[lang.secondary]}`
                : SHORT[lang.primary];
              return (
                <button
                  key={id}
                  role="tab"
                  className="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  <strong>
                    {TAB_LABEL[id]}
                    {counts[id] > 0 && <span className="badge">{counts[id]}</span>}
                  </strong>
                  <span>{tag}</span>
                </button>
              );
            })}
          </nav>

          <div className="body">
            {tab === 'problems' && (
              <ListSection
                field="problems"
                title="Presenting complaints"
                placeholder="e.g. Fever for 3 days"
                note="Free text. Suggestions come from what you have written before."
              />
            )}
            {tab === 'examination' && <ExamSection />}
            {tab === 'diagnosis' && (
              <ListSection
                field="diagnosis"
                title="Diagnosis"
                placeholder="e.g. Community-acquired pneumonia"
                strong
                note="Free text on purpose — diagnosis is judgement, not a list to pick from."
              />
            )}
            {tab === 'labs' && <LabsSection />}
            {tab === 'medications' && <MedicationsSection />}
            {tab === 'advice' && <AdviceSection />}
          </div>
        </>
      )}

      {shown('preview') && view === 'preview' && (
        <>
          {model ? (
            <PreviewSheet model={model} />
          ) : (
            <div className="body">
              <p className="empty">Preparing the document…</p>
            </div>
          )}
        </>
      )}

      {shown('builder') && view === 'builder' && (
        <Suspense
          fallback={
            <div className="body">
              <p className="empty">Opening the pack builder…</p>
            </div>
          }
        >
          <PackBuilder onDone={() => setView('write')} />
        </Suspense>
      )}

      {view === 'clinic' && (
        <Suspense
          fallback={
            <div className="body">
              <p className="empty">Opening the queue…</p>
            </div>
          }
        >
          <ClinicPanel onOpenScript={() => setView('write')} sync={sync} />
        </Suspense>
      )}

      {shown('history') && view === 'history' && <HistoryPanel onDone={() => setView('write')} />}
      {view === 'settings' && <SettingsPanel onOpenBuilder={() => setView('builder')} />}
      {pack.modules.includes(view as ModuleId) && shown(view) && (
        <Suspense fallback={<div className="body"><p className="empty">Opening…</p></div>}>
          <div className="body">
            {(() => {
              const Panel = MODULE_PANEL[view as ModuleId];
              return <Panel />;
            })()}
          </div>
        </Suspense>
      )}
      {view === 'scores' && (pack.scores?.length ?? 0) > 0 && shown('scores') && (
        <Suspense fallback={<div className="body"><p className="empty">Opening…</p></div>}>
          <div className="body">
            <ScoresPanel />
          </div>
        </Suspense>
      )}

      {view !== 'home' && (
      <footer className="actionbar">
        {view === 'write' && (
          <>
            <button className="btn quiet" onClick={startNew}>
              New
            </button>
            <button className="btn ghost" onClick={doSave} disabled={isBlank(rx) || !!busy}>
              {busy ?? (dirty ? 'Save on this device' : 'Saved')}
            </button>
            <button
              className="btn"
              onClick={() => setView('preview')}
              disabled={isBlank(rx) || !fontsLoaded}
            >
              Preview &amp; print
            </button>
          </>
        )}
        {view === 'preview' && (
          <>
            <button className="btn quiet" onClick={() => setView('write')}>
              Back
            </button>
            <button className="btn ghost" onClick={doSave} disabled={!!busy}>
              {busy ?? 'Save on this device'}
            </button>
            <button className="btn" onClick={deliverPdf} disabled={!model || !!busy}>
              {busy ?? (canShareFiles() ? 'Send / print' : 'Download PDF')}
            </button>
          </>
        )}
        {/*
          A front desk has no script to go back to -- offering one names a
          surface that does not exist on that machine. It goes back to the
          queue, and from the queue there is nowhere further back.
        */}
        {(view === 'history' ||
          view === 'settings' ||
          pack.modules.includes(view as ModuleId) ||
          view === 'scores' ||
          view === 'builder' ||
          view === 'clinic') &&
          !(reception && view === 'clinic') && (
            <button
              className="btn quiet"
              onClick={() => setView(reception ? 'clinic' : 'write')}
            >
              {reception ? 'Back to the queue' : 'Back to the script'}
            </button>
          )}
      </footer>
      )}
    </div>
  );
}

function PatientBar() {
  const { rx, pack, setPatient, patient: identified, clearPatient } = useStore();
  const [picking, setPicking] = useState(false);
  const p = rx.patient;
  // Sex-label wording and the age placeholder are the one place patient-bar
  // copy is specialty-specific: "Boy"/"Girl" was hardcoded regardless of the
  // active pack, so an adult on the medicine pack saw their sex offered as
  // "Boy"/"Girl". Growth is the paediatric tell; no schema change needed.
  const paediatric = pack.modules.includes('growth');
  return (
    <div className="patient">
      {/*
        Identifying the patient is optional and stays optional. It buys growth
        tracking and a visible history; skipping it costs nothing on the script.
      */}
      <div className="identity-row">
        {identified ? (
          <>
            <span className="pill good">linked · {identified.name}</span>
            <button className="linkish" onClick={clearPatient}>
              unlink
            </button>
          </>
        ) : (
          <button className="linkish" onClick={() => setPicking(true)}>
            link to a patient record
          </button>
        )}
      </div>
      {picking && <PatientPicker onClose={() => setPicking(false)} />}
      <div className="grid">
        <div className="field f-name">
          <label>Patient</label>
          <input
            value={p.name}
            aria-label="Patient name"
            placeholder="Name"
            onChange={(e) => setPatient({ name: e.target.value })}
          />
        </div>
        <div className="field f-age">
          <label>Age</label>
          <input
            value={p.age ?? ''}
            placeholder={paediatric ? '3 y 2 m' : '45 y'}
            onChange={(e) => setPatient({ age: e.target.value })}
          />
        </div>
        <div className="field f-sex">
          <label>Sex</label>
          <select
            value={p.sex ?? ''}
            onChange={(e) =>
              setPatient({ sex: (e.target.value || undefined) as 'M' | 'F' | undefined })
            }
          >
            <option value="">—</option>
            <option value="M">{paediatric ? 'Boy' : 'Male'}</option>
            <option value="F">{paediatric ? 'Girl' : 'Female'}</option>
          </select>
        </div>
        <div className="field num f-weight">
          <label>Weight kg</label>
          <input
            inputMode="decimal"
            aria-label="Weight in kilograms"
            value={p.weightKg ?? ''}
            onChange={(e) =>
              setPatient({ weightKg: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
        <div className="field f-allergies">
          <label>Allergies</label>
          <input
            value={p.allergies ?? ''}
            placeholder="none known"
            onChange={(e) => setPatient({ allergies: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
