/**
 * Advice, in the three tiers of PRODUCT.md 9 -- and the UI must never flatten
 * them, because they carry three different levels of trust.
 *
 *   Tier 1  vetted templates      one tap, reviewed Urdu, a slot where needed
 *   Tier 2  red flags             library ONLY. There is no free-text field in
 *                                 this tier, by construction, because a
 *                                 mistranslated return precaution can kill a
 *                                 child.
 *   Tier 3  the doctor's own      printed exactly as typed, in the language
 *                                 typed, never translated -- and labelled as
 *                                 the doctor's own words so it does not look as
 *                                 authoritative as the vetted lines.
 */
import { useState } from 'react';
import type { AdviceItem } from '@domain/prescription.ts';
import { composeAdvice, vouchOf } from '@domain/advice.ts';
import { templateSlots } from '@domain/phrases.ts';
import type { Locale } from '@domain/locale.ts';
import { useStore, newId } from '../store.tsx';

type Tier = 1 | 2 | 3;

const MARK: Record<string, string> = {
  vetted: '✓',
  'red-flag': '!',
  'doctors-own': '✎',
};

const VOUCH_LABEL: Record<string, string> = {
  vetted: 'Approved wording',
  'red-flag': 'Red flag — approved wording',
  'doctors-own': 'Your own words — prints as typed, not translated',
};

export function AdviceSection() {
  const { rx, pack, phrases: packs, setAdvice } = useStore();
  const [tier, setTier] = useState<Tier>(1);
  const [freeText, setFreeText] = useState('');
  const [freeLang, setFreeLang] = useState<Locale>('ur-PK');
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});

  const add = (item: AdviceItem) => setAdvice([...rx.advice, item]);
  const remove = (id: string) => setAdvice(rx.advice.filter((a) => a.id !== id));

  return (
    <section>
      <div className="card">
        <h2>Advice for the patient</h2>

        <div className="tier-picker">
          <button aria-pressed={tier === 1} onClick={() => setTier(1)}>
            Common
          </button>
          <button aria-pressed={tier === 2} onClick={() => setTier(2)}>
            Red flags
          </button>
          <button aria-pressed={tier === 3} onClick={() => setTier(3)}>
            My own words
          </button>
        </div>

        {tier === 1 && (
          <div className="library">
            {pack.advicePacks.tier1.map((id) => {
              const template = packs.en.advice.tier1[id] ?? id;
              const urdu = packs['ur-PK'].advice.tier1[id] ?? '';
              const needs = templateSlots(template);
              const n = slotValues[id] ?? '';
              return (
                <button
                  key={id}
                  onClick={() => {
                    if (needs.includes('n') && !n.trim()) return;
                    add({
                      kind: 1,
                      id: newId(),
                      templateId: id,
                      slots: needs.includes('n') ? { n: Number(n) } : {},
                    });
                  }}
                >
                  <div>
                    {template.replace('{n}', needs.includes('n') ? (n || '…') : '')}
                    {needs.includes('n') && (
                      <input
                        className="chip-value"
                        style={{ marginLeft: 8 }}
                        inputMode="numeric"
                        placeholder="days"
                        value={n}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setSlotValues((s) => ({ ...s, [id]: e.target.value }))}
                      />
                    )}
                  </div>
                  <div className="ur" dir="rtl" lang="ur">
                    {urdu.replace('{n}', needs.includes('n') ? (n || '…') : '')}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {tier === 2 && (
          <>
            <div className="warn-box" style={{ marginBottom: 8 }}>
              <strong>Library only.</strong>
              Return precautions cannot be typed freely here. A mistranslated red
              flag is the one error in this app that could cost a life, so these
              come from reviewed wording or not at all.
            </div>
            <div className="library red">
              {pack.advicePacks.tier2.map((id) => (
                <button key={id} onClick={() => add({ kind: 2, id: newId(), redFlagId: id })}>
                  <div>{packs.en.advice.tier2[id]}</div>
                  <div className="ur" dir="rtl" lang="ur">
                    {packs['ur-PK'].advice.tier2[id]}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tier === 3 && (
          <>
            <div className="opts" style={{ marginBottom: 8 }}>
              {(['ur-PK', 'en'] as Locale[]).map((locale) => (
                <button
                  key={locale}
                  className="opt"
                  aria-pressed={freeLang === locale}
                  onClick={() => setFreeLang(locale)}
                >
                  {locale === 'ur-PK' ? 'اردو' : 'English'}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              dir={freeLang === 'ur-PK' ? 'rtl' : 'ltr'}
              className={freeLang === 'ur-PK' ? 'ur' : ''}
              style={{
                width: '100%',
                border: '1px solid var(--line)',
                borderRadius: 6,
                padding: 9,
              }}
              placeholder={
                freeLang === 'ur-PK' ? 'اپنے الفاظ میں لکھیں…' : 'Type in your own words…'
              }
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
            />
            <div className="warn-box" style={{ margin: '8px 0' }}>
              <strong>Prints exactly as typed.</strong>
              Nothing here is translated. English in, English out; Urdu in, Urdu
              out. This line is your words at your own risk and is marked on the
              script as not vetted.
            </div>
            <button
              className="btn"
              disabled={!freeText.trim()}
              onClick={() => {
                add({ kind: 3, id: newId(), lang: freeLang, text: freeText.trim() });
                setFreeText('');
              }}
            >
              Add my line
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h2>On this script</h2>
        {rx.advice.length === 0 && <p className="empty">No advice added yet.</p>}
        {rx.advice.map((item) => {
          const vouch = vouchOf(item);
          const ur = composeAdvice(item, 'ur-PK', packs);
          const en = composeAdvice(item, 'en', packs);
          return (
            <div className="advice-item" data-vouch={vouch} key={item.id}>
              <span className="mark" aria-hidden="true">
                {MARK[vouch]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="vouch-label">{VOUCH_LABEL[vouch]}</span>
                {ur && (
                  <div className="ur" dir="rtl" lang="ur">
                    {ur.plain}
                  </div>
                )}
                {en && <div className="en">{en.plain}</div>}
              </div>
              <button className="mini" aria-label="Remove" onClick={() => remove(item.id)}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      <FollowUp />
    </section>
  );
}

function FollowUp() {
  const { rx, setFollowUp } = useStore();
  const current = rx.followUp?.in.value ?? '';
  return (
    <div className="card">
      <h2>Follow-up</h2>
      <div className="opts">
        {[2, 3, 5, 7, 14].map((d) => (
          <button
            key={d}
            className="opt"
            aria-pressed={current === d}
            onClick={() => setFollowUp(current === d ? null : d)}
          >
            {d} days
          </button>
        ))}
      </div>
    </div>
  );
}
