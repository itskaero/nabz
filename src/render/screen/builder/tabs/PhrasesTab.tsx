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
  const [draftTemplate, setDraftTemplate] = useState('');

  /**
   * A new sig template.
   *
   * Written in English and offered immediately, but the Urdu starts empty:
   * PRODUCT.md 4 is explicit that each locale has its OWN word order and is
   * authored, never derived. Seeding the Urdu with the English would produce a
   * template that validates, prints Latin script to a patient, and looks done.
   */
  const addTemplate = () => {
    const text = draftTemplate.trim();
    if (!text) return;
    const id = `sig.${text
      .toLowerCase()
      .replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .split('_')
      .filter(Boolean)
      .slice(0, 4)
      .join('_') || Date.now().toString(36)}`;
    if (draft.pack.sigTemplates.includes(id)) return;

    for (const locale of LOCALES) {
      draft.editLocale(locale, (pack) => ({
        ...pack,
        templates: { ...pack.templates, [id]: locale === 'en' ? text : '' },
      }));
    }
    draft.setPack({ ...draft.pack, sigTemplates: [...draft.pack.sigTemplates, id] });
    setDraftTemplate('');
  };

  const ids = useMemo(() => {
    const all = new Set<string>();
    for (const l of LOCALES) Object.keys(draft.phrases[l].templates).forEach((id) => all.add(id));
    return [...all].filter((id) => matches(id, query)).sort();
  }, [draft.phrases, query]);

  return (
    <>
      <section className="card">
        <h2>Add an instruction template</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          `{'{dose}'}`, `{'{frequency}'}`, `{'{duration}'}` are slots the doctor
          fills. Square brackets make a part optional:
          <code> [ for {'{duration}'}]</code>.
        </p>
        <div className="compose">
          <input
            value={draftTemplate}
            aria-label="New instruction template in English"
            placeholder="{administer} {dose} {frequency}[ for {duration}]"
            onChange={(e) => setDraftTemplate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTemplate();
            }}
          />
          <button className="btn" disabled={!draftTemplate.trim()} onClick={addTemplate}>
            Add
          </button>
        </div>
        <p className="hint">
          The Urdu is left blank deliberately. Each locale has its own word
          order and is written, never translated from the English — a copy would
          validate and still be wrong.
        </p>
      </section>

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
  const [group, setGroup] = useState('frequency');
  const [entryId, setEntryId] = useState('');
  const [english, setEnglish] = useState('');

  /** A new word in an existing group -- "every 48 hours", "before bed". */
  const addEntry = () => {
    const key = entryId.trim().replace(/\s+/g, '_');
    if (!key || !english.trim()) return;
    for (const locale of LOCALES) {
      draft.editLocale(locale, (pack) => ({
        ...pack,
        vocab: {
          ...pack.vocab,
          [group]: {
            ...(pack.vocab[group] ?? {}),
            [key]: locale === 'en' ? english.trim() : '',
          },
        },
      }));
    }
    setEntryId('');
    setEnglish('');
  };

  const vocabIds = useMemo(() => {
    const all = new Set<string>();
    for (const l of LOCALES) Object.keys(draft.phrases[l].vocab).forEach((v) => all.add(v));
    return [...all].sort();
  }, [draft.phrases]);

  return (
    <>
      <section className="card">
        <h2>Add a word</h2>
        <div className="vocab-row">
          <select
            className="pay-select"
            aria-label="Vocabulary group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            {vocabIds.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            value={entryId}
            aria-label="New vocabulary id"
            placeholder="id, e.g. Q48H"
            onChange={(e) => setEntryId(e.target.value)}
          />
          <input
            value={english}
            aria-label="New vocabulary English"
            placeholder="English, e.g. every 48 hours"
            onChange={(e) => setEnglish(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addEntry();
            }}
          />
          <button className="btn" disabled={!entryId.trim() || !english.trim()} onClick={addEntry}>
            Add
          </button>
        </div>
        <p className="hint">
          The id is what a prescription stores, so it never changes once used.
          The Urdu is written in the row below, not translated from here.
        </p>
      </section>

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
