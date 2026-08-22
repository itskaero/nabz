/**
 * Advice tiers 1 and 2 — and the red-flag sign-off gate.
 *
 * Tier 1 is ordinary content: composable advice, both locales, reviewed by the
 * same eye that reviews everything else.
 *
 * TIER 2 IS NOT. PRODUCT.md 9 forbids free text in tier 2 because "a
 * mistranslated red flag can hurt a child" — these are the lines a frightened
 * parent acts on at 2am. The structural validators catch a MISSING translation;
 * nothing automatic can catch a WRONG one. So a red flag carries the same
 * discipline a dose does: a named person, on a date, saying they read it.
 *
 * Export is blocked until every red flag is signed off, and editing the wording
 * clears the signature — a sign-off is on a sentence, not on an id.
 */
import { useState } from 'react';
import { LOCALES } from '@domain/locale.ts';
import { templateSlots } from '@domain/phrases.ts';
import type { Draft } from '../useDraft.ts';

export function AdviceTab({ draft }: { draft: Draft }) {
  const [reviewer, setReviewer] = useState('');

  const signOff = (id: string) => {
    if (!reviewer.trim()) return;
    draft.setPack({
      ...draft.pack,
      redFlagReview: {
        ...draft.pack.redFlagReview,
        [id]: {
          reviewedBy: reviewer.trim(),
          date: new Date().toISOString().slice(0, 10),
          wording: draft.wordingOf(id),
        },
      },
    });
  };

  const signOffAll = () => {
    if (!reviewer.trim()) return;
    const next = { ...draft.pack.redFlagReview };
    for (const id of draft.pack.advicePacks.tier2) {
      next[id] = {
        reviewedBy: reviewer.trim(),
        date: new Date().toISOString().slice(0, 10),
        wording: draft.wordingOf(id),
      };
    }
    draft.setPack({ ...draft.pack, redFlagReview: next });
  };

  return (
    <>
      <section className="card">
        <h2>Red flags — tier 2</h2>
        <div className="warn-box" style={{ borderColor: 'var(--alert)' }}>
          <strong>These are the lines a parent acts on at 2am.</strong>
          Nothing in this app can tell whether a translation is right — only that
          one exists. So each of these needs a person to say they read it and it
          says what it should. Until then the pack cannot be exported.
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Reviewed by</label>
          <input
            value={reviewer}
            placeholder="Your name — recorded against each line you sign off"
            onChange={(e) => setReviewer(e.target.value)}
          />
        </div>
        {draft.stats.unreviewedRedFlags > 0 && (
          <button
            className="btn"
            style={{ marginTop: 8 }}
            disabled={!reviewer.trim()}
            onClick={signOffAll}
          >
            I have read all {draft.stats.unreviewedRedFlags} and they are correct
          </button>
        )}
      </section>

      {draft.pack.advicePacks.tier2.map((id) => {
        const review = draft.pack.redFlagReview?.[id];
        const current = draft.wordingOf(id);
        const stale = review !== undefined && review.wording !== current;
        const signed = review !== undefined && !stale;

        return (
          <section className="card" key={id}>
            <h2>
              {id}
              <span className={signed ? 'badge' : 'badge bad'}>
                {signed ? 'signed off' : stale ? 'wording changed' : 'not reviewed'}
              </span>
            </h2>
            {LOCALES.map((locale) => (
              <div className="field" key={locale} style={{ marginBottom: 6 }}>
                <label>{locale}</label>
                <textarea
                  rows={2}
                  dir={locale === 'ur-PK' ? 'rtl' : 'ltr'}
                  lang={locale === 'ur-PK' ? 'ur' : 'en'}
                  className={locale === 'ur-PK' ? 'ur' : ''}
                  style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 8, width: '100%' }}
                  value={draft.phrases[locale].advice.tier2[id] ?? ''}
                  onChange={(e) =>
                    draft.editLocale(locale, (p) => ({
                      ...p,
                      advice: {
                        ...p.advice,
                        tier2: { ...p.advice.tier2, [id]: e.target.value },
                      },
                    }))
                  }
                />
              </div>
            ))}
            {signed ? (
              <p className="hint">
                Signed off by {review.reviewedBy} on {review.date}. Editing the
                wording above clears this.
              </p>
            ) : (
              <button className="btn ghost" disabled={!reviewer.trim()} onClick={() => signOff(id)}>
                {stale ? 'Re-confirm this wording' : 'I have read this and it is correct'}
              </button>
            )}
          </section>
        );
      })}

      <section className="card">
        <h2>Common advice — tier 1</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          One tap in the app. `{'{n}'}` is a slot the doctor fills in — it must
          appear in every locale or one of them loses the number.
        </p>
      </section>

      {draft.pack.advicePacks.tier1.map((id) => {
        const slotsPerLocale = LOCALES.map((l) => ({
          locale: l,
          text: draft.phrases[l].advice.tier1[id],
        }));
        const sets = new Set(
          slotsPerLocale
            .filter((s) => s.text !== undefined)
            .map((s) => templateSlots(s.text!).join(',')),
        );
        const missing = slotsPerLocale.filter((s) => s.text === undefined);

        return (
          <section className="card" key={id}>
            <h2>{id}</h2>
            {LOCALES.map((locale) => (
              <div className="field" key={locale} style={{ marginBottom: 6 }}>
                <label>{locale}</label>
                <textarea
                  rows={2}
                  dir={locale === 'ur-PK' ? 'rtl' : 'ltr'}
                  lang={locale === 'ur-PK' ? 'ur' : 'en'}
                  className={locale === 'ur-PK' ? 'ur' : ''}
                  style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 8, width: '100%' }}
                  value={draft.phrases[locale].advice.tier1[id] ?? ''}
                  onChange={(e) =>
                    draft.editLocale(locale, (p) => ({
                      ...p,
                      advice: {
                        ...p.advice,
                        tier1: { ...p.advice.tier1, [id]: e.target.value },
                      },
                    }))
                  }
                />
              </div>
            ))}
            {missing.length > 0 && (
              <div className="warn-box">
                <strong>Not written in {missing.map((m) => m.locale).join(', ')}.</strong>
                The patient would get this line in the wrong language.
              </div>
            )}
            {sets.size > 1 && (
              <div className="warn-box" style={{ borderColor: 'var(--alert)' }}>
                <strong>The locales use different slots.</strong>
                One version is dropping the number the doctor typed.
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
