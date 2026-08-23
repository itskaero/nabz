/**
 * Investigation categories and the tests offered under each.
 *
 * Built from ExamTab because a lab chip IS an exam chip: English-only, no
 * translation, no bidi, no plural rules. This tab is what makes labs
 * *adjustable per specialty* without anyone editing a .tsx file — the same rule
 * that governs exam palettes and locales (CLAUDE.md 6a). A cardiology pack ships
 * troponin and a lipid profile by adding a pack file, not by changing code.
 *
 * `takesValue` turns a chip into one that carries a qualifier — "Chest X-ray
 * PA view", "Ultrasound abdomen full bladder" — instead of a bare test name.
 * `fasting` is a property of the TEST: it offers the matching advice line and
 * never adds one, because the library suggests and the prescriber confirms.
 */
import { useState } from 'react';
import type { LabDefinition } from '@domain/pack.ts';
import { applyPatch } from '@domain/patch.ts';
import type { Draft } from '../useDraft.ts';

export function LabsTab({ draft }: { draft: Draft }) {
  const [open, setOpen] = useState<string | null>(draft.pack.labCategories[0]?.id ?? null);

  const setPalette = (categoryId: string, labs: LabDefinition[]) =>
    draft.setPack({
      ...draft.pack,
      labsPalette: { ...draft.pack.labsPalette, [categoryId]: labs },
    });

  const addCategory = () => {
    const id = `labcat_${Date.now().toString(36)}`;
    draft.setPack({
      ...draft.pack,
      labCategories: [
        ...draft.pack.labCategories,
        { id, label: 'New category', order: draft.pack.labCategories.length + 1 },
      ],
      labsPalette: { ...draft.pack.labsPalette, [id]: [] },
    });
    setOpen(id);
  };

  const total = Object.values(draft.pack.labsPalette).reduce((n, l) => n + l.length, 0);

  return (
    <>
      <section className="card">
        <h2>Investigations</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {draft.pack.labCategories.length} categories, {total} tests. English
          only, and deliberately so: a laboratory technician reads
          &ldquo;CBC&rdquo;, so a transliterated test name would hand the patient
          a slip nobody at the lab can act on.
        </p>
        <div className="warn-box" style={{ margin: '8px 0' }}>
          <strong>Tests are offered, never suggested.</strong>
          Nothing here reacts to a diagnosis. Proposing an investigation from a
          working diagnosis would be clinical decision support, which this
          product does not do.
        </div>
        <button className="btn" onClick={addCategory}>
          Add a category
        </button>
      </section>

      {draft.pack.labCategories.map((category) => {
        const palette = draft.pack.labsPalette[category.id] ?? [];
        const isOpen = open === category.id;
        return (
          <section className="card" key={category.id}>
            <div className="two-col">
              <div className="field">
                <label>Category name</label>
                <input
                  value={category.label}
                  onChange={(e) =>
                    draft.setPack({
                      ...draft.pack,
                      labCategories: draft.pack.labCategories.map((c) =>
                        c.id === category.id ? { ...c, label: e.target.value } : c,
                      ),
                    })
                  }
                />
              </div>
              <div className="field num">
                <label>Order</label>
                <input
                  inputMode="numeric"
                  value={category.order ?? ''}
                  onChange={(e) =>
                    draft.setPack({
                      ...draft.pack,
                      labCategories: draft.pack.labCategories.map((c) =>
                        c.id === category.id
                          ? applyPatch(c, { order: Number(e.target.value) || undefined })
                          : c,
                      ),
                    })
                  }
                />
              </div>
            </div>

            <button
              className="btn quiet"
              style={{ marginTop: 8 }}
              onClick={() => setOpen(isOpen ? null : category.id)}
            >
              {isOpen ? 'Hide' : 'Edit'} {palette.length} test
              {palette.length === 1 ? '' : 's'}
            </button>

            {isOpen && (
              <>
                <div className="rows" style={{ marginTop: 10 }}>
                  {palette.map((lab, i) => (
                    <div className="chip-editor" key={lab.id}>
                      <input
                        value={lab.label}
                        placeholder="test as it prints"
                        onChange={(e) =>
                          setPalette(
                            category.id,
                            palette.map((l, j) =>
                              j === i ? { ...l, label: e.target.value } : l,
                            ),
                          )
                        }
                      />
                      <input
                        value={lab.valueHint ?? ''}
                        placeholder="qualifier hint"
                        disabled={!lab.takesValue}
                        onChange={(e) =>
                          setPalette(
                            category.id,
                            palette.map((l, j) =>
                              j === i ? { ...l, valueHint: e.target.value } : l,
                            ),
                          )
                        }
                      />
                      <button
                        className="opt"
                        aria-pressed={Boolean(lab.takesValue)}
                        title="Offer an inline qualifier box, e.g. PA view"
                        onClick={() =>
                          setPalette(
                            category.id,
                            palette.map((l, j) =>
                              j === i ? { ...l, takesValue: !l.takesValue } : l,
                            ),
                          )
                        }
                      >
                        +detail
                      </button>
                      <button
                        className="opt"
                        aria-pressed={Boolean(lab.fasting)}
                        title="This test needs fasting; offers the advice line"
                        onClick={() =>
                          setPalette(
                            category.id,
                            palette.map((l, j) =>
                              j === i ? { ...l, fasting: !l.fasting } : l,
                            ),
                          )
                        }
                      >
                        fasting
                      </button>
                      <button
                        className="mini"
                        aria-label={`Remove ${lab.label}`}
                        onClick={() =>
                          setPalette(category.id, palette.filter((_, j) => j !== i))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="btn ghost"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setPalette(category.id, [
                      ...palette,
                      { id: `lab_${Date.now().toString(36)}`, label: '' },
                    ])
                  }
                >
                  Add a test
                </button>
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
