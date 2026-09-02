/**
 * Clinical scores (PRODUCT.md 4c, CLAUDE.md 6a). One generic panel renders
 * any `ScoreDefinition` the active pack declares -- adding a score is
 * authoring pack data, never a new component.
 *
 * The rule this panel exists to enforce, not just describe: a band's `note`
 * is rendered AS WRITTEN, and nothing here ever synthesises an instruction
 * ("admit", "anticoagulate") from the result. If a pack's own wording crosses
 * that line, that is a pack-authoring bug, not something this panel adds.
 *
 * Never opened from a diagnosis -- the doctor picks a score and ticks it
 * themselves (PRODUCT.md rule 3.3), same as investigations.
 */
import { useMemo, useState } from 'react';
import type { ScoreDefinition } from '@domain/pack.ts';
import { computeScore } from '@domain/scores.ts';
import { useStore, newId } from '../store.tsx';
import { PatientStrip } from './PatientStrip.tsx';

export function ScoresPanel() {
  const { rx, pack, setCalculations } = useStore();
  const scores = pack.scores ?? [];
  const [activeId, setActiveId] = useState<string | undefined>(scores[0]?.id);
  const active: ScoreDefinition | undefined = scores.find((s) => s.id === activeId) ?? scores[0];
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const result = useMemo(
    () => (active ? computeScore(active, ticked) : null),
    [active, ticked],
  );
  const total = result?.total ?? 0;
  const band = result?.band ?? null;
  const recorded = (rx.calculations ?? []).filter((c) => c.moduleId === `score:${active?.id}`);
  const [justRecorded, setJustRecorded] = useState(false);

  const selectScore = (id: string) => {
    setActiveId(id);
    setTicked(new Set());
    setJustRecorded(false);
  };

  const toggle = (criterionId: string) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(criterionId)) {
        next.delete(criterionId);
        return next;
      }
      // Mutually-exclusive criteria (CHA2DS2-VASc's two age bands) share a
      // `group` -- ticking one unticks the rest of that group, so the score
      // never visibly shows two exclusive boxes checked at once. computeScore
      // enforces the same rule defensively, but the UI should not even offer
      // the contradictory state.
      const criterion = active?.criteria.find((c) => c.id === criterionId);
      if (criterion?.group) {
        for (const sibling of active!.criteria) {
          if (sibling.group === criterion.group) next.delete(sibling.id);
        }
      }
      next.add(criterionId);
      return next;
    });
    setJustRecorded(false);
  };

  const record = () => {
    if (!active || !band || !result) return;
    setCalculations([
      ...(rx.calculations ?? []),
      {
        id: newId(),
        moduleId: `score:${active.id}`,
        label: active.label,
        value: total,
        unit: `/ ${result.max}`,
        method: band.label,
        inputs: Object.fromEntries(
          active.criteria.map((c) => [c.id, ticked.has(c.id) ? 'yes' : 'no']),
        ),
        computedAt: new Date().toISOString(),
      },
    ]);
    setJustRecorded(true);
  };

  if (scores.length === 0) return null;

  return (
    <section className="card">
      <PatientStrip />
      <h2>Scores</h2>

      {scores.length > 1 && (
        <div className="opt-group">
          <label>Score</label>
          <div className="opts">
            {scores.map((s) => (
              <button
                key={s.id}
                className="opt"
                aria-pressed={active?.id === s.id}
                onClick={() => selectScore(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {active && (
        <>
          <div className="rows" style={{ margin: '10px 0' }}>
            {active.criteria.map((c) => (
              <button
                key={c.id}
                className="opt"
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                aria-pressed={ticked.has(c.id)}
                onClick={() => toggle(c.id)}
              >
                <span>{c.label}</span>
                <span className="mono">+{c.points}</span>
              </button>
            ))}
          </div>

          <div className="growth-grid" style={{ marginBottom: 10 }}>
            <div className="stat">
              <div className="k">{active.label.split(' (')[0]}</div>
              <div className="v">{total}</div>
              <div className="sub">of {result?.max ?? 0}</div>
            </div>
            {band && (
              <div className="stat">
                <div className="k">Band</div>
                <div className="v" style={{ fontSize: 14 }}>
                  {band.label}
                </div>
                {band.note && <div className="sub">{band.note}</div>}
              </div>
            )}
          </div>

          <p className="hint" style={{ marginTop: 0 }}>
            {active.reference}
          </p>

          <div className="record-row">
            <button className="btn" disabled={!band} onClick={record}>
              Record this result
            </button>
            {justRecorded && <span className="pill good">Recorded ✓</span>}
          </div>

          {recorded.length > 0 && (
            <div className="rows" style={{ marginTop: 14 }}>
              <p className="hint" style={{ margin: '0 0 6px' }}>
                Already recorded on this script. Printing is off by default —
                turn it on in Settings → Paper &amp; letterhead.
              </p>
              {recorded.map((c) => (
                <div className="row-item" key={c.id}>
                  <span className="who mono">
                    {c.value} {c.unit}
                  </span>
                  <span className="meta">{c.method}</span>
                  <time>{c.computedAt.slice(11, 16)}</time>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
