/**
 * Examination: stateful findings chips, per system.
 *
 * A chip cycles untouched -> present -> absent -> untouched. "Absent" is not a
 * cosmetic third state: a recorded pertinent negative ("no neck stiffness") is
 * a medico-legal fact and has to be as fast to enter as a positive, which is
 * why it is the very next tap rather than a separate control (PRODUCT.md 8).
 *
 * An untouched system collapses and drops out of the document entirely, so the
 * script never claims an examination that did not happen.
 *
 * Exam is English-only, and that is what makes it the easy section: no
 * translation, no bidi, no plural rules (PRODUCT.md 6).
 */
import { useMemo, useState } from 'react';
import type { ExamSystem } from '@domain/prescription.ts';
import type { FindingDefinition } from '@domain/pack.ts';
import {
  composeSystem,
  findFinding,
  findingCount,
  setFindingValue,
  toggleFinding,
} from '@domain/exam.ts';
import * as db from '@storage/db.ts';
import { useStore } from '../store.tsx';

export function ExamSection() {
  const { rx, pack, profile, setExam } = useStore();
  const [promotions, setPromotions] = useState<Array<{ text: string; count: number }>>([]);

  const systems = useMemo(
    () =>
      [...pack.examSystems]
        .filter((s) => !profile.hiddenExamSystems.includes(s.id))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [pack.examSystems, profile.hiddenExamSystems],
  );

  const stateOf = (systemId: string): ExamSystem =>
    rx.examination.find((s) => s.system === systemId) ?? {
      system: systemId,
      findings: [],
    };

  const write = (next: ExamSystem) => {
    const others = rx.examination.filter((s) => s.system !== next.system);
    const keep = next.findings.length > 0 || (next.freeText?.trim() ?? '') !== '';
    setExam(keep ? [...others, next] : others);
  };

  const loadPromotions = () => {
    void db.promotionCandidates().then((rows) =>
      setPromotions(rows.map((r) => ({ text: r.text, count: r.count }))),
    );
  };

  return (
    <section>
      {systems.map((system) => {
        const state = stateOf(system.id);
        // The doctor's own additions sit alongside the pack's, same shape.
        const palette: FindingDefinition[] = [
          ...(pack.findingsPalette[system.id] ?? []),
          ...(profile.extraFindings[system.id] ?? []).map(
            (f): FindingDefinition => ({ id: f.id, label: f.label }),
          ),
        ];
        const count = findingCount(state);
        const prose = composeSystem(state, system.label);

        return (
          <details className="system" key={system.id} open={count > 0}>
            <summary>
              {system.label}
              {count > 0 && <span className="badge count">{count}</span>}
            </summary>

            <div className="chips">
              {palette.map((finding) => {
                const current = findFinding(state, finding.id);
                return (
                  <span key={finding.id} style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      className="chip"
                      data-state={current?.state ?? 'none'}
                      onClick={() => write(toggleFinding(state, finding.id, finding.label))}
                      aria-label={`${finding.label}: ${current?.state ?? 'not examined'}`}
                    >
                      {finding.label}
                    </button>
                    {current?.state === 'present' && finding.takesValue && (
                      <input
                        className="chip-value"
                        value={current.value ?? ''}
                        placeholder={finding.valueHint ?? 'value'}
                        onChange={(e) =>
                          write(setFindingValue(state, finding.id, e.target.value))
                        }
                      />
                    )}
                  </span>
                );
              })}
            </div>

            <div style={{ padding: '0 12px 12px' }}>
              <textarea
                rows={2}
                style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 6, padding: 8 }}
                placeholder={`Other ${system.label.toLowerCase()} findings…`}
                value={state.freeText ?? ''}
                onChange={(e) => write({ ...state, freeText: e.target.value })}
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  if (text) void db.learn('finding', text);
                }}
              />
              {prose && (
                <p className="hint">
                  Prints as: <strong style={{ fontWeight: 500 }}>{prose}</strong>
                </p>
              )}
            </div>
          </details>
        );
      })}

      <section className="card">
        <h2>Grow the palette</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Findings you type often can become chips. Nothing is added without you
          choosing it.
        </p>
        <button className="btn quiet" onClick={loadPromotions} style={{ marginTop: 8 }}>
          Show what I keep typing
        </button>
        {promotions.length > 0 && (
          <div className="rows" style={{ marginTop: 8 }}>
            {promotions.map((p) => (
              <div className="row-item" key={p.text}>
                <span className="who">{p.text}</span>
                <time>{p.count}×</time>
              </div>
            ))}
            <p className="hint">
              Add these to a system&rsquo;s palette in Settings.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
