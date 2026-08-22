/**
 * The evidence table: what dose, for whom, and on whose authority.
 *
 * The rule with teeth is `reference`. A dosing row with an empty citation is a
 * build error, not a warning (PRODUCT.md 11a) — the citation is both the legal
 * cover and the prescriber's own sanity check before signing. This tab will not
 * let a row be saved without one and the export gate refuses the pack.
 *
 * `verified` is the second, softer signal: it says a clinician has personally
 * checked this row against the source. Seed rows ship `false` and the
 * prescribing UI says so, because a citation nobody has confirmed must not wear
 * the same authority as one that has been.
 *
 * The generic field is constrained to names already in the catalogue. A dosing
 * row whose generic matches nothing can never be suggested for any brand.
 */
import { useMemo, useState } from 'react';
import type { DosingEntry } from '@domain/pack.ts';
import type { Patch } from '@domain/patch.ts';
import { applyPatch } from '@domain/patch.ts';
import { normaliseGeneric, suggestGenerics } from '@domain/generics.ts';
import type { Draft } from '../useDraft.ts';

export function DosingTab({ draft }: { draft: Draft }) {
  const [editing, setEditing] = useState<number | null>(null);

  const brandCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of draft.pack.formularySeed) {
      const key = normaliseGeneric(row.generic);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [draft.pack.formularySeed]);

  const write = (index: number, patch: Patch<DosingEntry>) => {
    const next = [...draft.pack.dosing];
    // applyPatch, not spread: clearing an optional must delete the key, or the
    // exported JSON and the stored object disagree about whether it was set.
    next[index] = applyPatch(next[index]!, patch);
    draft.setPack({ ...draft.pack, dosing: next });
  };

  const add = () => {
    draft.setPack({
      ...draft.pack,
      dosing: [
        { generic: '', route: 'oral', reference: '', verified: false },
        ...draft.pack.dosing,
      ],
    });
    setEditing(0);
  };

  return (
    <>
      <section className="card">
        <h2>Doses</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Keyed by generic, so one row serves every brand of that medicine. Shown
          in the app as a suggestion with its source attached — never filled in
          automatically.
        </p>
        <div className="warn-box" style={{ margin: '8px 0' }}>
          <strong>Every dose needs a citation.</strong>
          Source, edition and section. Copyrighted references (BNFC, Nelson,
          Harriet Lane, Lexicomp) are consult-and-cite: read the source, write
          the entry in your own words, record where it came from. WHO materials
          are openly licensed and can be quoted more directly.
        </div>
        <button className="btn" onClick={add}>
          Add a dose
        </button>
        {draft.stats.genericsWithoutDosing > 0 && (
          <p className="hint">
            {draft.stats.genericsWithoutDosing} generic
            {draft.stats.genericsWithoutDosing === 1 ? '' : 's'} in the catalogue
            have no cited dose — no suggestion will ever appear for them.
          </p>
        )}
      </section>

      <div className="rows">
        {draft.pack.dosing.length === 0 && <p className="empty">No dosing rows yet.</p>}
        {draft.pack.dosing.map((row, index) =>
          editing === index ? (
            <EditDose
              key={index}
              row={row}
              draft={draft}
              brands={brandCount.get(normaliseGeneric(row.generic)) ?? 0}
              onChange={(patch) => write(index, patch)}
              onClose={() => setEditing(null)}
              onRemove={() => {
                draft.setPack({
                  ...draft.pack,
                  dosing: draft.pack.dosing.filter((_, i) => i !== index),
                });
                setEditing(null);
              }}
            />
          ) : (
            <button className="row-item" key={index} onClick={() => setEditing(index)}>
              <div style={{ minWidth: 0 }}>
                <div className="who">
                  {row.generic || <em>no generic</em>}
                  {row.indication ? <span className="meta"> — {row.indication}</span> : null}
                </div>
                <div className="meta">
                  {row.mgPerKg ? `${row.mgPerKg} mg/kg` : row.maxPerDay || '—'}
                  {row.ageBand ? ` · ${row.ageBand.label}` : ''} · {row.route}
                </div>
              </div>
              <span className={row.reference.trim() ? (row.verified ? 'pill good' : 'pill') : 'pill bad'}>
                {!row.reference.trim() ? 'no citation' : row.verified ? 'verified' : 'unverified'}
              </span>
            </button>
          ),
        )}
      </div>
    </>
  );
}

function EditDose({
  row,
  draft,
  brands,
  onChange,
  onClose,
  onRemove,
}: {
  row: DosingEntry;
  draft: Draft;
  brands: number;
  onChange: (patch: Patch<DosingEntry>) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const suggestions = useMemo(
    () => suggestGenerics(row.generic, draft.vocabulary, 6),
    [row.generic, draft.vocabulary],
  );
  const orphan = row.generic.trim() !== '' && brands === 0;

  return (
    <div className="card edit-row">
      <div className="field">
        <label>Generic</label>
        <input value={row.generic} onChange={(e) => onChange({ generic: e.target.value })} />
      </div>
      {suggestions.length > 0 && (
        <div className="opts" style={{ marginTop: 6 }}>
          {suggestions.map((s) => (
            <button
              key={s.key}
              className="opt"
              aria-pressed={s.name === row.generic}
              onClick={() => onChange({ generic: s.name })}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {orphan && (
        <div className="warn-box" style={{ marginTop: 8 }}>
          <strong>No medicine in the catalogue uses this generic.</strong>
          Doses are matched to brands by this name, so as written this row can
          never be suggested for anything. Usually a spelling difference.
        </div>
      )}

      <div className="field" style={{ marginTop: 8 }}>
        <label>Indication (optional)</label>
        <input
          value={row.indication ?? ''}
          placeholder="Pneumonia (fast breathing)"
          onChange={(e) => onChange({ indication: e.target.value })}
        />
      </div>

      <div className="two-col" style={{ marginTop: 8 }}>
        <div className="field num">
          <label>mg per kg, per dose</label>
          <input
            inputMode="decimal"
            value={row.mgPerKg ?? ''}
            onChange={(e) =>
              onChange({ mgPerKg: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
        <div className="field num">
          <label>Doses per day it assumes</label>
          <input
            inputMode="numeric"
            value={row.perDoses ?? ''}
            onChange={(e) =>
              onChange({ perDoses: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 8 }}>
        <div className="field">
          <label>Ceiling / plain-language dose</label>
          <input
            value={row.maxPerDay ?? ''}
            placeholder="4 doses in 24 hours"
            onChange={(e) => onChange({ maxPerDay: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Route</label>
          <input value={row.route} onChange={(e) => onChange({ route: e.target.value })} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Age band label (optional)</label>
        <input
          value={row.ageBand?.label ?? ''}
          placeholder="6 months and over"
          onChange={(e) =>
            onChange({
              ageBand: e.target.value.trim() ? { ...row.ageBand, label: e.target.value } : undefined,
            })
          }
        />
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Reference — required</label>
        <input
          value={row.reference}
          placeholder="WHO Pocket Book of Hospital Care for Children, 2nd ed., ch. 4"
          onChange={(e) => onChange({ reference: e.target.value })}
        />
        {!row.reference.trim() && (
          <p className="hint" style={{ color: 'var(--alert)' }}>
            A dose without a citation cannot be exported.
          </p>
        )}
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Note shown with the suggestion (optional)</label>
        <input
          value={row.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </div>

      <button
        className="mode"
        style={{ marginTop: 10, width: '100%' }}
        aria-pressed={row.verified}
        onClick={() => onChange({ verified: !row.verified })}
      >
        <div>
          <strong>
            {row.verified
              ? 'I have checked this against the source'
              : 'Not yet checked against the source'}
          </strong>
          <small>
            An unverified row still prints its citation, but the app labels it as
            unverified so it does not carry authority it has not earned.
          </small>
        </div>
      </button>

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
