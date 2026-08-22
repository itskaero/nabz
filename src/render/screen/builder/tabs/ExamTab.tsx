/**
 * Exam systems and their findings chips.
 *
 * The easy tab, for the same reason the exam section is the easy section: it is
 * English-only by design (PRODUCT.md 6). No translation, no bidi, no plural
 * rules — the patient does not read the examination findings.
 *
 * `takesValue` is the one field worth understanding: it turns a chip into one
 * that carries a modifier ("hepatomegaly 3cm", "tachypnoea 46/min") instead of
 * a bare positive.
 */
import { useState } from 'react';
import type { FindingDefinition } from '@domain/pack.ts';
import { applyPatch } from '@domain/patch.ts';
import type { Draft } from '../useDraft.ts';

export function ExamTab({ draft }: { draft: Draft }) {
  const [open, setOpen] = useState<string | null>(draft.pack.examSystems[0]?.id ?? null);

  const setPalette = (systemId: string, findings: FindingDefinition[]) =>
    draft.setPack({
      ...draft.pack,
      findingsPalette: { ...draft.pack.findingsPalette, [systemId]: findings },
    });

  const addSystem = () => {
    const id = `system_${Date.now().toString(36)}`;
    draft.setPack({
      ...draft.pack,
      examSystems: [
        ...draft.pack.examSystems,
        { id, label: 'New system', order: draft.pack.examSystems.length + 1 },
      ],
      findingsPalette: { ...draft.pack.findingsPalette, [id]: [] },
    });
    setOpen(id);
  };

  return (
    <>
      <section className="card">
        <h2>Examination</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {draft.pack.examSystems.length} systems, {draft.stats.chips} chips.
          English only — this section is for the record and the pharmacist, not
          the patient, which is what keeps it free of translation entirely.
        </p>
        <button className="btn" onClick={addSystem}>
          Add a system
        </button>
      </section>

      {draft.pack.examSystems.map((system) => {
        const palette = draft.pack.findingsPalette[system.id] ?? [];
        const isOpen = open === system.id;
        return (
          <section className="card" key={system.id}>
            <div className="two-col">
              <div className="field">
                <label>System name</label>
                <input
                  value={system.label}
                  onChange={(e) =>
                    draft.setPack({
                      ...draft.pack,
                      examSystems: draft.pack.examSystems.map((s) =>
                        s.id === system.id ? { ...s, label: e.target.value } : s,
                      ),
                    })
                  }
                />
              </div>
              <div className="field num">
                <label>Order</label>
                <input
                  inputMode="numeric"
                  value={system.order ?? ''}
                  onChange={(e) =>
                    draft.setPack({
                      ...draft.pack,
                      examSystems: draft.pack.examSystems.map((s) =>
                        s.id === system.id
                          ? applyPatch(s, { order: Number(e.target.value) || undefined })
                          : s,
                      ),
                    })
                  }
                />
              </div>
            </div>

            <button
              className="btn quiet"
              style={{ marginTop: 8 }}
              onClick={() => setOpen(isOpen ? null : system.id)}
            >
              {isOpen ? 'Hide' : 'Edit'} {palette.length} chip{palette.length === 1 ? '' : 's'}
            </button>

            {isOpen && (
              <>
                <div className="rows" style={{ marginTop: 10 }}>
                  {palette.map((finding, i) => (
                    <div className="chip-editor" key={finding.id}>
                      <input
                        value={finding.label}
                        placeholder="finding as it prints"
                        onChange={(e) =>
                          setPalette(
                            system.id,
                            palette.map((f, j) =>
                              j === i ? { ...f, label: e.target.value } : f,
                            ),
                          )
                        }
                      />
                      <input
                        value={finding.valueHint ?? ''}
                        placeholder="value hint"
                        disabled={!finding.takesValue}
                        onChange={(e) =>
                          setPalette(
                            system.id,
                            palette.map((f, j) =>
                              j === i ? { ...f, valueHint: e.target.value } : f,
                            ),
                          )
                        }
                      />
                      <button
                        className="opt"
                        aria-pressed={Boolean(finding.takesValue)}
                        title="Offer an inline value box, e.g. 3cm"
                        onClick={() =>
                          setPalette(
                            system.id,
                            palette.map((f, j) =>
                              j === i ? { ...f, takesValue: !f.takesValue } : f,
                            ),
                          )
                        }
                      >
                        +value
                      </button>
                      <button
                        className="mini"
                        aria-label={`Remove ${finding.label}`}
                        onClick={() =>
                          setPalette(system.id, palette.filter((_, j) => j !== i))
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
                    setPalette(system.id, [
                      ...palette,
                      { id: `f_${Date.now().toString(36)}`, label: '' },
                    ])
                  }
                >
                  Add a chip
                </button>
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
