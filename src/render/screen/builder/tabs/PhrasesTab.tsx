/**
 * The phrase library: the sig templates, the slot vocabularies, the units, and
 * the printed labels — in every locale, side by side.
 *
 * This is where the Urdu review PRODUCT.md 15 demands actually happens. It has
 * had nowhere to happen until now except a code editor, which is why the
 * shipped `ur-PK` pack is still a first draft.
 *
 * Two things the editor must not let slide, both already enforced by
 * `validatePacks`:
 *
 *  - A template present in one locale and missing in another prints the wrong
 *    language to the patient. Shown here as a side-by-side gap, not a list of
 *    ids somewhere else.
 *  - The same template declaring different SLOTS per locale means one of them is
 *    silently dropping clinical information — an Urdu line with no {duration}
 *    tells a parent to keep giving an antibiotic forever. Word ORDER differing
 *    is the whole point and is never flagged; slot SETS differing is an error.
 */
import { useMemo, useState } from 'react';
import { LOCALES } from '@domain/locale.ts';
import type { Locale } from '@domain/locale.ts';
import { templateSlots } from '@domain/phrases.ts';
import type { Draft } from '../useDraft.ts';

type Group = 'templates' | 'vocab' | 'units' | 'strings';

const GROUPS: Array<{ id: Group; label: string; note: string }> = [
  {
    id: 'templates',
    label: 'Instruction sentences',
    note: 'Each locale is written independently, in its own word order. Never a translation of the other.',
  },
  {
    id: 'vocab',
    label: 'Slot words',
    note: 'Frequencies, timings, verbs and forms — the pieces the sentences are built from.',
  },
  {
    id: 'units',
    label: 'Units',
    note: 'One form for a count of one, one for everything else. In Urdu گولی becomes گولیاں; دن does not change.',
  },
  {
    id: 'strings',
    label: 'Printed labels',
    note: 'Section headings and the fixed text on the printed script.',
  },
];

export function PhrasesTab({ draft }: { draft: Draft }) {
  const [group, setGroup] = useState<Group>('templates');
  const [query, setQuery] = useState('');

  return (
    <>
      <section className="card">
        <h2>Phrases</h2>
        <div className="opts">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              className="opt"
              aria-pressed={group === g.id}
              onClick={() => setGroup(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <p className="hint">{GROUPS.find((g) => g.id === group)!.note}</p>
        <div className="compose" style={{ marginTop: 6 }}>
          <input value={query} placeholder="Filter" onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      {group === 'templates' && <Templates draft={draft} query={query} />}
      {group === 'vocab' && <Vocab draft={draft} query={query} />}
      {group === 'units' && <Units draft={draft} query={query} />}
      {group === 'strings' && <Strings draft={draft} query={query} />}
    </>
  );
}

function matches(id: string, query: string): boolean {
  return !query.trim() || id.toLowerCase().includes(query.trim().toLowerCase());
}

function LocaleField({
  locale,
  value,
  onChange,
  placeholder,
}: {
  locale: Locale;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const rtl = locale === 'ur-PK';
  return (
    <div className="field">
      <label>{locale}</label>
      <textarea
        rows={rtl ? 2 : 2}
        dir={rtl ? 'rtl' : 'ltr'}
        lang={rtl ? 'ur' : 'en'}
        className={rtl ? 'ur' : ''}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 8, width: '100%' }}
      />
    </div>
  );
}

function Templates({ draft, query }: { draft: Draft; query: string }) {
  const ids = useMemo(() => {
    const all = new Set<string>();
    for (const l of LOCALES) Object.keys(draft.phrases[l].templates).forEach((id) => all.add(id));
    return [...all].filter((id) => matches(id, query)).sort();
  }, [draft.phrases, query]);

  return (
    <>
      {ids.map((id) => {
        const slotSets = LOCALES.map((l) => {
          const t = draft.phrases[l].templates[id];
          return { locale: l, template: t, slots: t === undefined ? null : templateSlots(t) };
        });
        const present = slotSets.filter((s) => s.template !== undefined);
        const missing = slotSets.filter((s) => s.template === undefined);
        const sets = new Set(present.map((s) => s.slots!.join(',')));
        const drifted = sets.size > 1;
        const offered = draft.pack.sigTemplates.includes(id);

        return (
          <section className="card" key={id}>
            <h2>
              {id}
              {offered && <span className="badge">offered</span>}
            </h2>
            {LOCALES.map((locale) => (
              <LocaleField
                key={locale}
                locale={locale}
                value={draft.phrases[locale].templates[id] ?? ''}
                placeholder={`write the ${locale} sentence in its own word order`}
                onChange={(v) =>
                  draft.editLocale(locale, (p) => ({
                    ...p,
                    templates: { ...p.templates, [id]: v },
                  }))
                }
              />
            ))}
            <p className="hint">
              Slots:{' '}
              {present.map((s) => (
                <span key={s.locale} className="mono" style={{ marginRight: 10 }}>
                  {s.locale} {'{'}
                  {s.slots!.join(', ')}
                  {'}'}
                </span>
              ))}
            </p>
            {missing.length > 0 && (
              <div className="warn-box">
                <strong>Not written in {missing.map((m) => m.locale).join(', ')}.</strong>
                A half-translated instruction prints the wrong language to the
                patient, which is the one thing this app exists to fix.
              </div>
            )}
            {drifted && (
              <div className="warn-box" style={{ borderColor: 'var(--alert)' }}>
                <strong>The locales use different slots.</strong>
                One of them is dropping clinical information — a sentence with no
                duration tells a parent to keep going indefinitely. Word order
                differing between locales is correct and expected; the set of
                slots must match.
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

function Vocab({ draft, query }: { draft: Draft; query: string }) {
  const vocabIds = useMemo(() => {
    const all = new Set<string>();
    for (const l of LOCALES) Object.keys(draft.phrases[l].vocab).forEach((v) => all.add(v));
    return [...all].sort();
  }, [draft.phrases]);

  return (
    <>
      {vocabIds.map((vid) => {
        const entries = new Set<string>();
        for (const l of LOCALES) {
          Object.keys(draft.phrases[l].vocab[vid] ?? {}).forEach((e) => entries.add(e));
        }
        const shown = [...entries].filter((e) => matches(`${vid} ${e}`, query)).sort();
        if (shown.length === 0) return null;
        return (
          <section className="card" key={vid}>
            <h2>{vid}</h2>
            {shown.map((entry) => (
              <div key={entry} className="vocab-row">
                <span className="mono vocab-key">{entry}</span>
                {LOCALES.map((locale) => (
                  <input
                    key={locale}
                    dir={locale === 'ur-PK' ? 'rtl' : 'ltr'}
                    className={locale === 'ur-PK' ? 'ur' : ''}
                    value={draft.phrases[locale].vocab[vid]?.[entry] ?? ''}
                    placeholder={locale}
                    onChange={(e) =>
                      draft.editLocale(locale, (p) => ({
                        ...p,
                        vocab: {
                          ...p.vocab,
                          [vid]: { ...(p.vocab[vid] ?? {}), [entry]: e.target.value },
                        },
                      }))
                    }
                  />
                ))}
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}

function Units({ draft, query }: { draft: Draft; query: string }) {
  const unitIds = useMemo(() => {
    const all = new Set<string>();
    for (const l of LOCALES) Object.keys(draft.phrases[l].units).forEach((u) => all.add(u));
    return [...all].filter((u) => matches(u, query)).sort();
  }, [draft.phrases, query]);

  return (
    <section className="card">
      <h2>Units</h2>
      {unitIds.map((unit) => (
        <div key={unit} className="unit-row">
          <span className="mono vocab-key">{unit}</span>
          {LOCALES.map((locale) =>
            (['one', 'other'] as const).map((form) => (
              <input
                key={`${locale}-${form}`}
                dir={locale === 'ur-PK' ? 'rtl' : 'ltr'}
                className={locale === 'ur-PK' ? 'ur' : ''}
                value={draft.phrases[locale].units[unit]?.[form] ?? ''}
                placeholder={`${locale} ${form}`}
                title={`${locale} — ${form === 'one' ? 'exactly 1' : 'any other count'}`}
                onChange={(e) =>
                  draft.editLocale(locale, (p) => ({
                    ...p,
                    units: {
                      ...p.units,
                      [unit]: {
                        other: p.units[unit]?.other ?? '',
                        ...p.units[unit],
                        [form]: e.target.value,
                      },
                    },
                  }))
                }
              />
            )),
          )}
        </div>
      ))}
      <p className="hint">
        Four boxes per unit: singular and plural, in each language. Leaving the
        plural blank is what produces &ldquo;1 days&rdquo;.
      </p>
    </section>
  );
}

function Strings({ draft, query }: { draft: Draft; query: string }) {
  const keys = useMemo(() => {
    const all = new Set<string>();
    for (const l of LOCALES) Object.keys(draft.phrases[l].strings).forEach((k) => all.add(k));
    return [...all].filter((k) => matches(k, query)).sort();
  }, [draft.phrases, query]);

  return (
    <section className="card">
      <h2>Printed labels</h2>
      {keys.map((key) => (
        <div key={key} className="vocab-row">
          <span className="mono vocab-key">{key}</span>
          {LOCALES.map((locale) => (
            <input
              key={locale}
              dir={locale === 'ur-PK' ? 'rtl' : 'ltr'}
              className={locale === 'ur-PK' ? 'ur' : ''}
              value={draft.phrases[locale].strings[key] ?? ''}
              placeholder={locale}
              onChange={(e) =>
                draft.editLocale(locale, (p) => ({
                  ...p,
                  strings: { ...p.strings, [key]: e.target.value },
                }))
              }
            />
          ))}
        </div>
      ))}
    </section>
  );
}
