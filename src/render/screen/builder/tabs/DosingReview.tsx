/**
 * Signing off doses, one sitting at a time.
 *
 * WHAT THIS IS FOR. `DosingEntry.verified` used to be a boolean anybody could
 * set and nothing checked, while the pack claimed to be clinician-verified and
 * the website repeated it. It is now backed by `pack.dosingReview` — a named
 * signer, a date, and a fingerprint of the row's numbers — and
 * `validateContentPack` refuses the claim without one.
 *
 * WHY IT LOOKS LIKE THIS. The paediatric pack is heading for ~150 rows. A
 * review screen that has to be finished in one pass is a review screen nobody
 * starts, so this one is built to be left half-done: progress is per row and
 * persisted the moment it is ticked, the unsigned rows float to the top, and
 * the count says exactly how far through you are. Keyboard first (j/k to move,
 * space to sign) because the hand that is not on the keyboard is holding the
 * reference open -- but only while the list itself has focus. A window-level
 * space handler would sign a dose every time somebody pressed space to scroll
 * the page, which is a signature nobody gave.
 *
 * WHAT IT REFUSES. You cannot sign anything until the pack has a real author.
 * A sign-off whose `reviewedBy` is the string 'Pack author' records nothing and
 * is worse than no sign-off, because it looks like one.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { DosingEntry, RedFlagReview } from '@domain/pack.ts';
import { dosingFingerprint, dosingKey, unreviewedDosing } from '@domain/pack.ts';
import type { Draft } from '../useDraft.ts';

const PLACEHOLDER_AUTHOR = 'Pack author';

/**
 * How far through, as a ring.
 *
 * A dial rather than a bar because the number beside it is already the
 * precise answer — the ring's job is the shape of the remaining work, read
 * without counting. One SVG, one stroke-dashoffset, no library. The
 * transition is the family's `--motion-cine`, which is reserved for exactly
 * this: something arriving, not something responding.
 */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? done / total : 0;
  return (
    <svg className="ring" viewBox="0 0 56 56" role="img" aria-label={`${done} of ${total} signed`}>
      <circle className="ring-track" cx="28" cy="28" r={r} />
      <circle
        className="ring-done"
        cx="28"
        cy="28"
        r={r}
        style={{ strokeDasharray: c, strokeDashoffset: c * (1 - share) }}
      />
    </svg>
  );
}

function hasRealAuthor(name: string): boolean {
  return name.trim().length > 0 && name.trim() !== PLACEHOLDER_AUTHOR;
}

function doseText(row: DosingEntry): string {
  if (row.mgPerKg !== undefined) {
    const range = row.mgPerKgHigh !== undefined ? `${row.mgPerKg}–${row.mgPerKgHigh}` : `${row.mgPerKg}`;
    const per = row.perDoses ? `, ${row.perDoses}× a day` : '';
    return `${range} mg/kg per dose${per}`;
  }
  return row.fixedDose || row.maxPerDay || '—';
}

export function DosingReview({ draft }: { draft: Draft }) {
  const { pack } = draft;
  const [focus, setFocus] = useState(0);
  const [name, setName] = useState(hasRealAuthor(pack.author.name) ? pack.author.name : '');
  const [credential, setCredential] = useState(pack.author.credential);
  const listRef = useRef<HTMLDivElement>(null);

  const outstanding = useMemo(() => new Map(unreviewedDosing(pack).map((o) => [o.id, o.reason])), [pack]);

  /*
    Unsigned first, then by name. The order is the work queue: a row that has
    been signed has nothing left to do, and burying the remaining ones among
    the finished ones is how a long list stops feeling finishable.
  */
  const rows = useMemo(
    () =>
      pack.dosing
        .map((row, index) => ({ row, index, key: dosingKey(row), reason: outstanding.get(dosingKey(row)) }))
        .sort(
          (a, b) =>
            Number(Boolean(b.reason)) - Number(Boolean(a.reason)) ||
            a.row.generic.localeCompare(b.row.generic),
        ),
    [pack.dosing, outstanding],
  );

  const signedCount = pack.dosing.length - outstanding.size;
  const ready = hasRealAuthor(name);

  const sign = (at: number) => {
    const target = rows[at];
    if (!target || !ready) return;
    const review: RedFlagReview = {
      reviewedBy: name.trim(),
      date: new Date().toISOString().slice(0, 10),
      wording: dosingFingerprint(target.row),
    };
    const nextReview = { ...(pack.dosingReview ?? {}), [target.key]: review };
    const dosing = pack.dosing.map((r, i) => {
      if (i !== target.index) return r;
      /*
        Signing clears `drafted`.

        The mark means "these numbers were written from practice, nobody has
        opened the reference". Signing is somebody opening the reference. If
        the mark survived the signature it would be saying the opposite of
        what just happened, every time it was shown.
      */
      const signed = { ...r, verified: true };
      delete signed.drafted;
      return signed;
    });
    draft.setPack({
      ...pack,
      dosing,
      dosingReview: nextReview,
      // The first sign-off is what puts a real name on the pack. Until then
      // `author` is a placeholder and nothing may be signed at all.
      author: { name: name.trim(), credential: credential.trim(), updated: review.date },
    });
    /*
      Focus deliberately does NOT advance.

      Unsigned rows sort first, so the row that was below this one slides up
      into the slot that was just vacated. Moving to `at + 1` would step over
      it, and the one row a reviewer skipped is the one they will never notice
      they skipped.
    */
  };

  const unsign = (at: number) => {
    const target = rows[at];
    if (!target) return;
    const nextReview = { ...(pack.dosingReview ?? {}) };
    delete nextReview[target.key];
    draft.setPack({
      ...pack,
      dosing: pack.dosing.map((r, i) => (i === target.index ? { ...r, verified: false } : r)),
      dosingReview: nextReview,
    });
  };

  /*
    j/k to move, space to sign -- bound to the LIST, not to the window.

    It was on `window`, skipping events whose target was an input. That is not
    the same guard: the name field unmounted as soon as it held a real name, so
    every later keystroke landed on `document.body` instead, bubbled up, and
    the two spaces in "Dr A. Tahir" signed two doses. The screen read
    "3 of 10 signed" after one deliberate click, and all three were real
    signatures against rows nobody had read.

    Requiring focus on the list makes the shortcut mean what it says: these
    keys act on the row you are looking at, and only while you are in the list.
  */
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFocus((f) => Math.min(f + 1, rows.length - 1));
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocus((f) => Math.max(f - 1, 0));
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const current = rows[focus];
      if (current?.reason) sign(focus);
      else unsign(focus);
    }
  };

  useEffect(() => {
    // Optional-called: scrollIntoView is absent in jsdom and in older embedded
    // webviews, and keeping the focused row visible is a convenience. A
    // convenience must not be able to take the screen down.
    const el = listRef.current?.querySelector(`[data-at="${focus}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [focus]);

  if (pack.dosing.length === 0) {
    return <p className="empty">This pack has no dosing rows to review.</p>;
  }

  return (
    <>
      <section className="card">
        <span className="eyebrow">Dose sign-off</span>
        {/*
          The count as a nama stat rather than a bold sentence: mono, tabular,
          and big enough to be the thing you look at when you come back to a
          list you left half-done. `--motion-cine` on the ring, which is the
          one place in this screen anything is allowed to take 900ms.
        */}
        <div className="signoff-head">
          <ProgressRing done={signedCount} total={pack.dosing.length} />
          <div className="stat">
            <span className="stat-num">
              {signedCount}
              <span className="stat-of"> / {pack.dosing.length}</span>
            </span>
            <span className="stat-lab">doses signed</span>
          </div>
        </div>
        <p className="hint">
          Check each dose against its citation and sign it. Your name and the
          date are recorded against the row — and if the dose is edited later,
          the sign-off is revoked automatically.
        </p>

        {!ready && (
          <div className="warn-box">
            <strong>Who is signing?</strong>
            A sign-off recorded against “{PLACEHOLDER_AUTHOR}” records nothing
            and looks like it recorded something. Nothing can be signed until
            this says who you are.
          </div>
        )}

        {/*
          The name stays on screen after it is filled in, which it did not.

          These two fields used to live inside the `!ready` branch, so they
          vanished on the first keystroke: type the D of "Dr A. Tahir", the
          field disappears mid-word, and the pack is authored by "D". The rest
          of the name went to whatever had focus next.

          They belong here permanently anyway. This is the name that goes on
          every signature on the screen, and a field you cannot see is a field
          you cannot correct a typo in.
        */}
        <div className="two-col" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="rv-name">Your name</label>
            <input
              id="rv-name"
              value={name}
              placeholder="Dr A. Tahir"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="rv-cred">Credential</label>
            <input
              id="rv-cred"
              value={credential}
              placeholder="MBBS, FCPS (Paediatrics)"
              onChange={(e) => setCredential(e.target.value)}
            />
          </div>
        </div>

        <p className="hint">
          Click the list, then <kbd>j</kbd> / <kbd>k</kbd> to move and{' '}
          <kbd>space</kbd> to sign or unsign. You can stop anywhere — every
          tick is saved as you go.
        </p>
      </section>

      <div
        className="rows review-rows"
        ref={listRef}
        tabIndex={0}
        role="group"
        aria-label="Dosing rows awaiting sign-off"
        onKeyDown={onKey}
      >
        {rows.map((entry, at) => (
          <div
            key={`${entry.key}#${entry.index}`}
            data-at={at}
            className="row-item review-row"
            aria-current={at === focus ? 'true' : undefined}
            onClick={() => setFocus(at)}
          >
            <div style={{ minWidth: 0 }}>
              <div className="who">
                {entry.row.generic}
                {entry.row.indication ? <span className="meta"> — {entry.row.indication}</span> : null}
              </div>
              <div className="meta">
                {doseText(entry.row)}
                {entry.row.ageBand ? ` · ${entry.row.ageBand.label}` : ''} · {entry.row.route}
                {entry.row.maxPerDay ? ` · max ${entry.row.maxPerDay}` : ''}
              </div>
              <div className="cite">
              {entry.row.drafted && (
                <strong className="unverified">Drafted, not transcribed — open this and check the number. </strong>
              )}
              {entry.row.reference}
            </div>
            </div>
            <div className="review-state">
              {/*
                Filled, not outlined, and each one carries its word.

                A queue of 115 rows is scanned rather than read, and an
                outlined pill at 11px is invisible in a scan. The word stays
                because a filled green pill and a filled amber one are the same
                pill to eight per cent of men.
              */}
              {/*
                nama's state chip: a glyph AND a border AND a colour.

                The system attributes that rule to this codebase, so bringing
                it back is a round trip rather than an import. It matters most
                here: 115 rows scanned rather than read, where a filled pill
                in amber and one in teal are the same pill to eight per cent
                of men and both are grey on a mono printout.
              */}
              {entry.reason === 'wording-changed' ? (
                <span className="state danger">dose changed since sign-off</span>
              ) : entry.reason ? (
                <span className="state warn">not signed</span>
              ) : (
                <span className="state ok">
                  {pack.dosingReview?.[entry.key]?.reviewedBy} ·{' '}
                  {pack.dosingReview?.[entry.key]?.date}
                </span>
              )}
              <button
                className={entry.reason ? 'btn' : 'btn quiet'}
                disabled={Boolean(entry.reason) && !ready}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocus(at);
                  if (entry.reason) sign(at);
                  else unsign(at);
                }}
              >
                {entry.reason ? 'Sign off' : 'Undo'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
