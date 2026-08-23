/**
 * Investigations: tap the tests, type anything the palette does not offer.
 *
 * Modelled on ExamSection because a lab chip IS an exam chip, minus a state:
 * a test is ordered or it is not, and there is no useful "pertinently
 * un-ordered" test (see domain/labs.ts). English-only, so nothing here touches
 * a locale pack.
 *
 * Nothing on this screen suggests a test from the diagnosis. That would be
 * decision support, which rule 3.3 forbids -- the palette offers what this
 * specialty commonly orders and the doctor decides.
 */
import { useMemo, useState } from 'react';
import type { LabDefinition } from '@domain/pack.ts';
import { composeLabs, findLab, freeLabId, setLabValue, toggleLab } from '@domain/labs.ts';
import * as db from '@storage/db.ts';
import { newId, useStore } from '../store.tsx';

export function LabsSection() {
  const { rx, pack, profile, setLabs } = useStore();
  const [typed, setTyped] = useState('');

  const categories = useMemo(
    () =>
      [...pack.labCategories]
        .filter((c) => !profile.hiddenLabCategories.includes(c.id))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [pack.labCategories, profile.hiddenLabCategories],
  );

  const ordered = rx.labs;
  const prose = composeLabs(ordered);

  /** A test the palette does not offer. Free text must never block. */
  const addTyped = () => {
    const text = typed.trim();
    if (!text) return;
    const labId = freeLabId(text);
    if (!findLab(ordered, labId)) {
      setLabs((prev) => toggleLab(prev, labId, text, newId));
      void db.learn('lab', text);
    }
    setTyped('');
  };

  /**
   * Tests whose fasting requirement the doctor may want to tell the patient
   * about. OFFERED, never added: the Urdu wording for it lives in tier-1
   * advice, and putting it there is the doctor's tap (rule 3.2).
   */
  const fastingOrdered = useMemo(() => {
    const byId = new Map<string, LabDefinition>();
    for (const list of Object.values(pack.labsPalette)) {
      for (const lab of list) byId.set(lab.id, lab);
    }
    return ordered.filter((o) => byId.get(o.labId)?.fasting);
  }, [ordered, pack.labsPalette]);

  return (
    <section>
      {categories.map((category) => {
        const palette = pack.labsPalette[category.id] ?? [];
        const count = palette.filter((l) => findLab(ordered, l.id)).length;

        return (
          <details className="system" key={category.id} open={count > 0}>
            <summary>
              {category.label}
              {count > 0 && <span className="badge count">{count}</span>}
            </summary>

            <div className="chips">
              {palette.map((lab) => {
                const current = findLab(ordered, lab.id);
                return (
                  <span key={lab.id} style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      className="chip"
                      data-state={current ? 'present' : 'none'}
                      aria-pressed={!!current}
                      aria-label={`${lab.label}: ${current ? 'ordered' : 'not ordered'}`}
                      onClick={() => setLabs((prev) => toggleLab(prev, lab.id, lab.label, newId))}
                    >
                      {lab.label}
                    </button>
                    {current && lab.takesValue && (
                      <input
                        className="chip-value"
                        value={current.value ?? ''}
                        placeholder={lab.valueHint ?? 'which one?'}
                        aria-label={`${lab.label} detail`}
                        onChange={(e) => setLabs((prev) => setLabValue(prev, lab.id, e.target.value))}
                      />
                    )}
                  </span>
                );
              })}
            </div>
          </details>
        );
      })}

      <section className="card">
        <h2>Something else</h2>
        <div className="compose">
          <input
            value={typed}
            aria-label="Other investigation"
            placeholder="e.g. Serum ceruloplasmin"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTyped();
            }}
          />
          <button className="btn" disabled={!typed.trim()} onClick={addTyped}>
            Add
          </button>
        </div>
        <p className="hint">
          Anything you type prints exactly as written. Test names stay in English
          — a laboratory reads &ldquo;CBC&rdquo;, not a translation of it.
        </p>
      </section>

      {ordered.length > 0 && (
        <section className="card">
          <h2>Ordered</h2>
          <div className="rows">
            {ordered.map((order) => (
              <div className="queue-row" key={order.id}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="who">{order.label}</div>
                  {order.value && <div className="meta">{order.value}</div>}
                </div>
                <button
                  className="btn quiet"
                  aria-label={`Remove ${order.label}`}
                  onClick={() => setLabs((prev) => toggleLab(prev, order.labId, order.label, newId))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="hint">
            Prints as: <strong style={{ fontWeight: 500 }}>{prose.join(', ')}</strong>
          </p>
          {fastingOrdered.length > 0 && (
            <div className="warn-box" style={{ marginTop: 10 }}>
              <strong>
                {fastingOrdered.map((f) => f.label).join(' and ')} need fasting.
              </strong>
              The patient has not been told yet — add the fasting line from
              Advice, where the Urdu wording has been reviewed.
            </div>
          )}
        </section>
      )}
    </section>
  );
}
