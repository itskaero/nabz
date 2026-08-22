/**
 * The catalogue: brands, generics, strengths, forms, DRAP registration.
 *
 * Two jobs beyond plain editing.
 *
 * 1. DRAP RECONCILIATION. Every shipped row is `provenance: 'manual'` with no
 *    registration number — a starting vocabulary, not a verified extract of the
 *    registry. This tab makes working through them a filtered list with a
 *    running count, and the validator already refuses to let a row claim DRAP
 *    provenance without a number.
 *
 * 2. THE GENERIC GUARD. `formulary` joins to `dosing` on `generic`, and that
 *    join is a plain string match. Typing "Amoxycillin" where the pack says
 *    "Amoxicillin" does not fail — it silently means no dose is ever suggested
 *    for that brand. So the generic field autocompletes from the pack's own
 *    vocabulary and warns the moment a new name looks like a typo of an
 *    existing one.
 */
import { useMemo, useRef, useState } from 'react';
import type { FormularyEntry } from '@domain/pack.ts';
import type { Patch } from '@domain/patch.ts';
import { applyPatch } from '@domain/patch.ts';
import { normaliseGeneric, suggestGenerics } from '@domain/generics.ts';
import type { Draft } from '../useDraft.ts';
import { cleanGeneric } from '../useDraft.ts';
import type { CsvImportResult } from '../csv.ts';
import { newGenerics, parseFormularyCsv } from '../csv.ts';

type Filter = 'all' | 'unreconciled' | 'no-dosing';

export function FormularyTab({ draft }: { draft: Draft }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [preview, setPreview] = useState<CsvImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dosedGenerics = useMemo(
    () => new Set(draft.pack.dosing.map((d) => normaliseGeneric(d.generic))),
    [draft.pack.dosing],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return draft.pack.formularySeed
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (filter === 'unreconciled' && row.provenance === 'DRAP' && row.drapRegNo) return false;
        if (filter === 'no-dosing' && dosedGenerics.has(normaliseGeneric(row.generic))) return false;
        if (!q) return true;
        return `${row.brand} ${row.generic}`.toLowerCase().includes(q);
      });
  }, [draft.pack.formularySeed, filter, query, dosedGenerics]);

  const write = (index: number, patch: Patch<FormularyEntry>) => {
    const next = [...draft.pack.formularySeed];
    // An empty optional must vanish rather than sit there as "", so blanks
    // become deletions before the patch is applied.
    const cleaned: Patch<FormularyEntry> = { ...patch };
    for (const key of ['strength', 'form', 'drapRegNo'] as const) {
      if (cleaned[key] !== undefined && String(cleaned[key]).trim() === '') cleaned[key] = undefined;
    }
    next[index] = applyPatch(next[index]!, cleaned);
    draft.setPack({ ...draft.pack, formularySeed: next });
  };

  const remove = (index: number) => {
    draft.setPack({
      ...draft.pack,
      formularySeed: draft.pack.formularySeed.filter((_, i) => i !== index),
    });
    setEditing(null);
  };

  const add = () => {
    draft.setPack({
      ...draft.pack,
      formularySeed: [
        { brand: '', generic: '', provenance: 'manual' },
        ...draft.pack.formularySeed,
      ],
    });
    setEditing(0);
    setFilter('all');
    setQuery('');
  };

  return (
    <>
      <section className="card">
        <h2>Medicines</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          The catalogue: which brands exist and what generic each one is. It never
          holds dose information — that lives under Doses, keyed by generic, with
          a citation on every row.
        </p>
        <div className="opts" style={{ marginTop: 8 }}>
          <button className="opt" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All {draft.pack.formularySeed.length}
          </button>
          <button
            className="opt"
            aria-pressed={filter === 'unreconciled'}
            onClick={() => setFilter('unreconciled')}
          >
            Not verified against DRAP {draft.stats.unreconciled}
          </button>
          <button
            className="opt"
            aria-pressed={filter === 'no-dosing'}
            onClick={() => setFilter('no-dosing')}
          >
            No cited dose
          </button>
        </div>
        <div className="compose" style={{ marginTop: 8 }}>
          <input
            value={query}
            placeholder="Filter by brand or generic"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" onClick={add}>
            Add medicine
          </button>
          <button className="btn quiet" onClick={() => fileInput.current?.click()}>
            Import CSV
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setPreview(parseFormularyCsv(await file.text(), draft.pack.formularySeed));
            }}
          />
        </div>
        {filter === 'unreconciled' && draft.stats.unreconciled > 0 && (
          <div className="warn-box" style={{ marginTop: 10 }}>
            <strong>{draft.stats.unreconciled} still to check.</strong>
            These carry no DRAP registration number, so nothing in the app can
            confirm the brand exists as described. Look each one up in the DRAP
            registry, enter its number, then switch it to DRAP.
          </div>
        )}
      </section>

      {preview && (
        <div className="scrim" role="dialog" aria-modal="true">
          <div className="sheet-modal">
            <h3>Import {preview.rows.length} medicines?</h3>
            <div className="warn-box" style={{ margin: '10px 0' }}>
              <strong>Everything imported arrives unverified.</strong>
              A CSV proves nothing about a registration, so every row comes in
              marked manual with no DRAP number — visible as unverified until
              someone looks it up. Doses are never importable: they are authored
              against a cited source, one at a time.
            </div>

            <div className="growth-grid" style={{ marginBottom: 10 }}>
              <div className="stat">
                <div className="k">New rows</div>
                <div className="v">{preview.rows.length}</div>
                <div className="sub">will be added</div>
              </div>
              <div className="stat">
                <div className="k">Already here</div>
                <div className="v">{preview.duplicates}</div>
                <div className="sub">skipped</div>
              </div>
              <div className="stat">
                <div className="k">Rejected</div>
                <div className="v">{preview.rejected.length}</div>
                <div className="sub">could not be used</div>
              </div>
            </div>

            {newGenerics(preview.rows, draft.pack.formularySeed).length > 0 && (
              <p className="hint">
                Adds {newGenerics(preview.rows, draft.pack.formularySeed).length} new
                generic name(s) to the vocabulary. Doses are matched on these
                exactly, so check the spellings afterwards.
              </p>
            )}

            {preview.rejected.length > 0 && (
              <div className="rows" style={{ maxHeight: 180, overflowY: 'auto' }}>
                {preview.rejected.slice(0, 20).map((r) => (
                  <div className="row-item" key={r.line}>
                    <div style={{ minWidth: 0 }}>
                      <div className="who">Line {r.line}</div>
                      <div className="meta">{r.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="actionbar" style={{ padding: '12px 0 0', borderTop: 'none' }}>
              <button className="btn quiet" onClick={() => setPreview(null)}>
                Cancel
              </button>
              <button
                className="btn"
                disabled={preview.rows.length === 0}
                onClick={() => {
                  draft.setPack({
                    ...draft.pack,
                    formularySeed: [...draft.pack.formularySeed, ...preview.rows],
                  });
                  setPreview(null);
                }}
              >
                Add {preview.rows.length} medicines
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rows">
        {rows.length === 0 && <p className="empty">Nothing matches.</p>}
        {rows.slice(0, 120).map(({ row, index }) =>
          editing === index ? (
            <EditRow
              key={index}
              row={row}
              draft={draft}
              onChange={(patch) => write(index, patch)}
              onClose={() => setEditing(null)}
              onRemove={() => remove(index)}
            />
          ) : (
            <button className="row-item" key={index} onClick={() => setEditing(index)}>
              <div style={{ minWidth: 0 }}>
                <div className="who">
                  {row.brand || <em>unnamed</em>}{' '}
                  {row.strength && <span className="mono">{row.strength}</span>}
                </div>
                <div className="meta">
                  {row.generic || <em>no generic</em>}
                  {row.form ? ` · ${row.form}` : ''}
                  {!dosedGenerics.has(normaliseGeneric(row.generic)) && ' · no cited dose'}
                </div>
              </div>
              <span className={row.provenance === 'DRAP' && row.drapRegNo ? 'pill good' : 'pill'}>
                {row.provenance === 'DRAP' && row.drapRegNo ? row.drapRegNo : 'unverified'}
              </span>
            </button>
          ),
        )}
        {rows.length > 120 && (
          <p className="hint">Showing the first 120 of {rows.length}. Filter to narrow it.</p>
        )}
      </div>
    </>
  );
}

function EditRow({
  row,
  draft,
  onChange,
  onClose,
  onRemove,
}: {
  row: FormularyEntry;
  draft: Draft;
  onChange: (patch: Patch<FormularyEntry>) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [genericQuery, setGenericQuery] = useState(row.generic);
  const suggestions = useMemo(
    () => suggestGenerics(genericQuery, draft.vocabulary, 6),
    [genericQuery, draft.vocabulary],
  );
  const duplicates = useMemo(
    () => draft.checkGeneric(genericQuery),
    [genericQuery, draft],
  );

  const commitGeneric = (value: string) => {
    const clean = cleanGeneric(value);
    setGenericQuery(clean);
    onChange({ generic: clean });
  };

  return (
    <div className="card edit-row">
      <div className="two-col">
        <div className="field">
          <label>Brand</label>
          <input value={row.brand} onChange={(e) => onChange({ brand: e.target.value })} />
        </div>
        <div className="field">
          <label>Generic</label>
          <input
            value={genericQuery}
            onChange={(e) => commitGeneric(e.target.value)}
            list={undefined}
          />
        </div>
      </div>

      {genericQuery.trim() && suggestions.length > 0 && (
        <div className="opts" style={{ marginTop: 6 }}>
          {suggestions.map((s) => (
            <button
              key={s.key}
              className="opt"
              aria-pressed={s.name === row.generic}
              onClick={() => commitGeneric(s.name)}
            >
              {s.name}{' '}
              <span className="mono" style={{ opacity: 0.65 }}>
                {s.brands}b/{s.dosing}d
              </span>
            </button>
          ))}
        </div>
      )}

      {/*
        The whole reason this tab exists. A near-miss here is not a typo in a
        label -- it is a brand that will never get a dose suggestion.
      */}
      {duplicates.length > 0 && (
        <div className="warn-box" style={{ marginTop: 8 }}>
          <strong>
            {duplicates[0]!.identical
              ? 'This is the same generic, spelled differently.'
              : 'Very close to a generic already in the pack.'}
          </strong>
          Doses are matched on the generic name, so two spellings split one
          medicine in two and neither gets the other&rsquo;s dosing. Did you mean{' '}
          {duplicates.slice(0, 3).map((d, i) => (
            <span key={d.existing.key}>
              {i > 0 && ', '}
              <button
                className="linkish"
                onClick={() => commitGeneric(d.existing.name)}
              >
                {d.existing.name}
              </button>
            </span>
          ))}
          ?
        </div>
      )}

      <div className="two-col" style={{ marginTop: 8 }}>
        <div className="field num">
          <label>Strength</label>
          <input
            value={row.strength ?? ''}
            placeholder="125mg/5ml"
            onChange={(e) => onChange({ strength: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Form</label>
          <input
            value={row.form ?? ''}
            placeholder="syrup / tablet / drops"
            onChange={(e) => onChange({ form: e.target.value })}
          />
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 8 }}>
        <div className="field num">
          <label>DRAP registration number</label>
          <input
            value={row.drapRegNo ?? ''}
            placeholder="from the DRAP registry"
            onChange={(e) => onChange({ drapRegNo: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Provenance</label>
          <div className="opts">
            {(['manual', 'DRAP'] as const).map((p) => (
              <button
                key={p}
                className="opt"
                aria-pressed={row.provenance === p}
                disabled={p === 'DRAP' && !row.drapRegNo?.trim()}
                title={
                  p === 'DRAP' && !row.drapRegNo?.trim()
                    ? 'Enter the registration number first'
                    : undefined
                }
                onClick={() => onChange({ provenance: p })}
              >
                {p === 'DRAP' ? 'Verified against DRAP' : 'Manual'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
        <button className="btn danger" onClick={onRemove}>
          Remove
        </button>
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
