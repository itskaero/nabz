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

/** ids are used in stored prescriptions, so they must be stable and typeable. */
function slugify(text: string, prefix: string): string {
  const body = text
    .toLowerCase()
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .split('_')
    .filter(Boolean)
    .slice(0, 5)
    .join('_');
  return `${prefix}.${body || Date.now().toString(36)}`;
}

export function AdviceTab({ draft }: { draft: Draft }) {
  const [reviewer, setReviewer] = useState('');
  const [newTier1, setNewTier1] = useState('');
  const [newTier2, setNewTier2] = useState('');

  /**
   * Add a line to a tier.
   *
   * The English is written here and the Urdu deliberately starts EMPTY rather
   * than being copied across. An empty translation is caught by the validator
   * and shown as a blocking gap; a copied one looks finished and prints English
   * to a patient who cannot read it. The pack cannot be exported until it is
   * filled in, which is the point.
   */
  const addLine = (tier: 'tier1' | 'tier2', english: string) => {
    const text = english.trim();
    if (!text) return;
    const id = slugify(text, tier === 'tier1' ? 'advice' : 'redflag');
    if (draft.pack.advicePacks[tier].includes(id)) return;

    draft.setPack({
      ...draft.pack,
      advicePacks: {
        ...draft.pack.advicePacks,
        [tier]: [...draft.pack.advicePacks[tier], id],
      },
    });
    for (const locale of LOCALES) {
      draft.editLocale(locale, (pack) => ({
        ...pack,
        advice: {
          ...pack.advice,
          [tier]: { ...pack.advice[tier], [id]: locale === 'en' ? text : '' },
        },
      }));
    }
  };

  /**
   * Remove a line from the pack.
   *
   * The wording stays in the locale packs on purpose. A prescription already
   * written referenced this id, and history should still render what the
   * patient was actually handed -- retiring a line from the palette is not the
   * same as deciding it was never said.
   */
  const removeLine = (tier: 'tier1' | 'tier2', id: string) => {
    draft.setPack({
      ...draft.pack,
      advicePacks: {
        ...draft.pack.advicePacks,
        [tier]: draft.pack.advicePacks[tier].filter((x) => x !== id),
      },
    });
  };

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

        <div className="compose" style={{ marginTop: 12 }}>
          <input
            value={newTier2}
            aria-label="New red flag in English"
            placeholder="Come back at once if… (English)"
            onChange={(e) => setNewTier2(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addLine('tier2', newTier2);
                setNewTier2('');
              }
            }}
          />
          <button
            className="btn"
            disabled={!newTier2.trim()}
            onClick={() => {
              addLine('tier2', newTier2);
              setNewTier2('');
            }}
          >
            Add a red flag
          </button>
        </div>
        <p className="hint">
          The Urdu starts empty and the pack will not export until you write it.
          Copying the English across would look finished and hand a patient a
          sentence they cannot read.
        </p>
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
            <div className="actionbar" style={{ padding: 0, borderTop: 'none' }}>
              {signed ? (
                <p className="hint" style={{ flex: 1, margin: 0 }}>
                  Signed off by {review.reviewedBy} on {review.date}. Editing the
                  wording above clears this.
                </p>
              ) : (
                <button
                  className="btn ghost"
                  disabled={!reviewer.trim()}
                  onClick={() => signOff(id)}
                >
                  {stale ? 'Re-confirm this wording' : 'I have read this and it is correct'}
                </button>
              )}
              <button className="btn quiet" onClick={() => removeLine('tier2', id)}>
                Retire
              </button>
            </div>
          </section>
        );
      })}

      <section className="card">
        <h2>Common advice — tier 1</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          One tap in the app. `{'{n}'}` is a slot the doctor fills in — it must
          appear in every locale or one of them loses the number.
        </p>
        <div className="compose" style={{ marginTop: 10 }}>
          <input
            value={newTier1}
            aria-label="New advice line in English"
            placeholder="e.g. Drink extra fluids for {n} days (English)"
            onChange={(e) => setNewTier1(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addLine('tier1', newTier1);
                setNewTier1('');
              }
            }}
          />
          <button
            className="btn"
            disabled={!newTier1.trim()}
            onClick={() => {
              addLine('tier1', newTier1);
              setNewTier1('');
            }}
          >
            Add advice
          </button>
        </div>
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
            <h2>
              {id}
              <button
                className="btn quiet"
                style={{ float: 'right' }}
                onClick={() => removeLine('tier1', id)}
              >
                Retire
              </button>
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
