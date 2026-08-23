/**
 * Today's queue.
 *
 * This is the clinic layer, and it is a prescription app first and a clinic
 * system second — so this whole surface is off until someone turns it on, and a
 * solo doctor never meets it.
 *
 * THE MIS-TAP IS THE DANGER HERE, not the data model. On paper the doctor picks
 * up a physical file and is holding the evidence of who this is. On screen,
 * tapping the wrong row silently loads the wrong patient's name, age and sex
 * into the script — and it looks *correct*, because it looks filled in. So
 * starting a consultation from the queue goes through an explicit confirm that
 * states who is about to be opened. (This is also why Clivita photographs
 * patients at check-in; the photo is the missing affordance.)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PaymentStatus, QueueEntry } from '@domain/clinic.ts';
import {
  dayTotals,
  formatMoney,
  nextStatus,
  nextToken,
  parseFee,
  sortQueue,
  touch,
} from '@domain/clinic.ts';
import { detectSyncMode, SyncMisconfigured, pairedCode } from '@storage/clinicSync.ts';
import { ClinicPairing } from './ClinicPairing.tsx';
import type { BackgroundSync } from './useBackgroundSync.ts';
import type { Sex } from '@domain/prescription.ts';
import * as db from '@storage/db.ts';
import { newId, useStore } from '../store.tsx';

const today = () => new Date().toISOString().slice(0, 10);

export function ClinicPanel({
  onOpenScript,
  sync,
}: {
  onOpenScript: () => void;
  /** The shell owns the timer now, so it keeps running off this screen. */
  sync: BackgroundSync;
}) {
  const { profile, startNew, setPatient, identifyPatient, openFromQueue } = useStore();
  const clinic = profile.clinic;
  const [date] = useState(today);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [confirming, setConfirming] = useState<QueueEntry | null>(null);
  const [removing, setRemoving] = useState<QueueEntry | null>(null);

  /*
    Everything about sharing lives on THIS screen, because the queue is the only
    thing that is ever shared. Keeping a Sync button in the app's header made it
    look like the prescriptions might be going somewhere too -- and it pushed the
    header past the width of a phone, which is how the mis-tap risk gets worse.
  */
  const [sharedOrigin, setSharedOrigin] = useState(false);
  const [paired, setPaired] = useState(() => pairedCode());
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [fee, setFee] = useState('');

  const refresh = useCallback(() => {
    void db.queueForDate(date).then(setEntries);
  }, [date]);
  useEffect(refresh, [refresh]);

  useEffect(() => {
    const ac = new AbortController();
    void detectSyncMode(ac.signal)
      .then((mode) => setSharedOrigin(mode === 'clinic'))
      .catch((err: unknown) => {
        // Wrong address rather than absent station. Say it here, on the queue,
        // because this is the screen where someone notices rows going nowhere.
        if (err instanceof SyncMisconfigured) setSyncNote(err.message);
      });
    return () => ac.abort();
  }, []);

  /*
    Refresh whenever the shell's timer brought something back. The panel no
    longer owns a timer of its own -- two of them meant two requests and a queue
    that stopped updating the moment this screen closed.
  */
  useEffect(refresh, [sync.tick, refresh]);

  const syncNow = async () => {
    setSyncNote('Checking the station…');
    const ok = await sync.syncNow();
    setSyncNote(ok ? null : 'The clinic station did not answer.');
    refresh();
  };

  const totals = useMemo(() => dayTotals(entries, date), [entries, date]);
  const ordered = useMemo(() => sortQueue(entries), [entries]);

  const add = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const entry: QueueEntry = {
      id: newId(),
      date,
      token: nextToken(entries, date),
      name: name.trim(),
      ...(age.trim() ? { age: age.trim() } : {}),
      ...(sex ? { sex: sex as Sex } : {}),
      status: 'waiting',
      payment: 'unpaid',
      ...(parseFee(fee || String((clinic.defaultFeeMinor ?? 0) / 100)) !== undefined
        ? { feeMinor: parseFee(fee) ?? clinic.defaultFeeMinor }
        : {}),
      createdAt: now,
      updatedAt: now,
    };
    await db.saveQueueEntry(entry);
    setName('');
    setAge('');
    setSex('');
    setFee('');
    refresh();
  };

  /**
   * Every write stamps WHICH contested field moved. Reception owns payment, the
   * doctor owns status, and the merge resolves those two independently -- so a
   * doctor marking a visit done can no longer overwrite a payment they had not
   * yet seen. See server/merge.mjs.
   */
  const update = async (
    entry: QueueEntry,
    patch: Partial<QueueEntry>,
    changed: 'payment' | 'status' | 'other' = 'other',
  ) => {
    await db.saveQueueEntry(touch({ ...entry, ...patch }, changed));
    refresh();
  };

  const remove = async (entry: QueueEntry) => {
    await db.deleteQueueEntry(entry.id);
    setRemoving(null);
    refresh();
  };

  const openScript = async (entry: QueueEntry) => {
    startNew();
    // Identity flows from the queue into the script for THIS encounter. That is
    // within-encounter carry, which rule 3.4 permits; nothing clinical comes
    // with it, and last month's script still needs a manual search.
    setPatient({
      name: entry.name,
      ...(entry.age ? { age: entry.age } : {}),
      ...(entry.sex ? { sex: entry.sex } : {}),
    });
    if (entry.patientId) {
      const record = await db.getPatient(entry.patientId);
      if (record) identifyPatient(record);
    }
    // Saving the script will close this visit, so the doctor never has to say
    // "done" twice. The status button stays for visits that end without one.
    openFromQueue(entry.id);
    await update(entry, { status: 'with-doctor', seenAt: new Date().toISOString() }, 'status');
    setConfirming(null);
    onOpenScript();
  };

  if (!clinic.enabled) return null;

  return (
    <div className="body">
      {sharedOrigin && !paired && (
        <section className="card">
          <h2>Pair with the clinic station</h2>
          <ClinicPairing
            onPaired={() => {
              setPaired(pairedCode());
              void syncNow();
            }}
          />
        </section>
      )}

      <section className="card">
        <h2>Add to the queue</h2>
        <div className="queue-add">
          <div className="field">
            <label>Name</label>
            <input
              value={name}
              aria-label="Queue patient name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add();
              }}
            />
          </div>
          <div className="field">
            <label>Age</label>
            <input value={age} placeholder="3 y" onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="field">
            <label>Sex</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
              <option value="">—</option>
              <option value="M">Boy</option>
              <option value="F">Girl</option>
            </select>
          </div>
          <div className="field num">
            <label>Fee</label>
            <input
              inputMode="decimal"
              value={fee}
              aria-label="Visit fee"
              placeholder={
                clinic.defaultFeeMinor ? String(clinic.defaultFeeMinor / 100) : '0'
              }
              onChange={(e) => setFee(e.target.value)}
            />
          </div>
          <button className="btn" disabled={!name.trim()} onClick={add}>
            Add
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Today · {date}</h2>
        <div className="growth-grid">
          <Stat k="Waiting" v={String(totals.waiting)} sub="still to be seen" />
          <Stat k="Seen" v={String(totals.seen)} sub="finished" />
          <Stat
            k="Collected"
            v={formatMoney(totals.collectedMinor, clinic.currency)}
            sub="money actually taken"
          />
          <Stat
            k="Outstanding"
            v={formatMoney(totals.outstandingMinor, clinic.currency)}
            sub={totals.waived ? `${totals.waived} waived` : 'not yet paid'}
          />
        </div>
        <p className="hint">
          A running total for the day, not a financial record — no receipts, no
          invoices, nothing to file.
        </p>
        {sharedOrigin && paired && (
          <div className="sync-line">
            <span className="hint" style={{ margin: 0 }}>
              {sync.syncedAt
                ? `Shared with the station · last checked ${new Date(
                    sync.syncedAt,
                  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Sharing the queue with the station…'}
            </span>
            <button className="btn quiet" onClick={() => void syncNow()}>
              Sync now
            </button>
          </div>
        )}
        {syncNote && (
          <p className="hint" role="status">
            {syncNote}{' '}
            <button className="linky" onClick={() => setSyncNote(null)}>
              dismiss
            </button>
          </p>
        )}
      </section>

      <div className="rows">
        {ordered.length === 0 && <p className="empty">Nobody in the queue yet.</p>}
        {ordered.map((entry) => (
          <div className="queue-row" key={entry.id} data-status={entry.status}>
            <span className="token mono">{entry.token}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="who">{entry.name}</div>
              <div className="meta">
                {[entry.age, entry.sex === 'M' ? 'boy' : entry.sex === 'F' ? 'girl' : null]
                  .filter(Boolean)
                  .join(' · ') || 'no details'}
                {entry.feeMinor ? ` · ${formatMoney(entry.feeMinor, clinic.currency)}` : ''}
              </div>
            </div>

            <select
              className="pay-select"
              aria-label={`Payment for ${entry.name}`}
              value={entry.payment}
              onChange={(e) =>
                update(entry, { payment: e.target.value as PaymentStatus }, 'payment')
              }
            >
              <option value="unpaid">unpaid</option>
              <option value="paid">paid</option>
              <option value="waived">waived</option>
            </select>

            <button
              className="btn quiet"
              onClick={() =>
                update(
                  entry,
                  {
                    status: nextStatus(entry.status),
                    ...(nextStatus(entry.status) === 'done'
                      ? { doneAt: new Date().toISOString() }
                      : {}),
                  },
                  'status',
                )
              }
            >
              {entry.status === 'waiting'
                ? 'waiting'
                : entry.status === 'with-doctor'
                  ? 'in room'
                  : 'done'}
            </button>

            <button className="btn ghost" onClick={() => setConfirming(entry)}>
              Open script
            </button>

            {/*
              Removing a row is a soft delete: the other station has to LEARN
              about it, and a hard delete is indistinguishable from "this row
              has not reached me yet", so the next stale sync would put it back.
              Only rows nobody has been seen for can be removed -- once a
              consultation has started, the day's record stands.
            */}
            {entry.status === 'waiting' && (
              <button
                className="btn quiet"
                aria-label={`Remove ${entry.name} from the queue`}
                onClick={() => setRemoving(entry)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/*
        The confirm exists because a mis-tap here is silent. Everything the
        doctor can use to catch it is on this one screen.
      */}
      {confirming && (
        <div className="scrim" role="dialog" aria-modal="true">
          <div className="sheet-modal">
            <h3>Start a script for this patient?</h3>
            <div className="confirm-patient">
              <span className="token mono">{confirming.token}</span>
              <div>
                <div className="who" style={{ fontSize: 18 }}>
                  {confirming.name}
                </div>
                <div className="meta">
                  {[
                    confirming.age,
                    confirming.sex === 'M' ? 'boy' : confirming.sex === 'F' ? 'girl' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'no age or sex recorded'}
                </div>
              </div>
            </div>
            <div className="warn-box" style={{ margin: '12px 0' }}>
              <strong>Check this is the child in front of you.</strong>
              The name, age and sex above will be copied onto the prescription.
              Nothing on the printed script will look wrong if this is the wrong
              row.
            </div>
            <div className="actionbar" style={{ padding: 0, borderTop: 'none' }}>
              <button className="btn quiet" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button className="btn" onClick={() => openScript(confirming)}>
                Yes, open the script
              </button>
            </div>
          </div>
        </div>
      )}

      {removing && (
        <div className="scrim" role="dialog" aria-modal="true">
          <div className="sheet-modal">
            <h3>Remove token {removing.token} from the queue?</h3>
            <p className="hint">
              {removing.name} disappears from today's list and from the day's
              total. Token numbers are not reused, so the numbering after this
              one does not shift.
            </p>
            <div className="actionbar" style={{ padding: 0, borderTop: 'none' }}>
              <button className="btn quiet" onClick={() => setRemoving(null)}>
                Keep them
              </button>
              {/*
                The red lives HERE and nowhere else. A red Remove on every
                waiting row would put fifteen red things on a busy morning's
                screen, and DESIGN.md 3 spends red on danger precisely so that
                it still means something when it appears.
              */}
              <button className="btn quiet danger" onClick={() => remove(removing)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
