/**
 * The section strip, which still scrolls -- but now says so.
 *
 * A prescription has six sections and a discharge summary seven; at 390px
 * about four fit. That strip is staying horizontal (stacking it would eat the
 * screen it is trying to save), so the job here is to stop it from LOOKING
 * finished at the right edge.
 *
 * Two signals, because one is missable. A fade over the edge that has more
 * behind it, and a count -- `4/7` -- that survives being looked at rather than
 * glanced past. Both appear only when the strip actually overflows: on a desk
 * monitor where all seven fit, a fade would imply content that is not there.
 *
 * The language tags are not decoration. They are the product model made
 * visible: this is not a "bilingual app", it is an app where each section
 * speaks to whoever reads it (PRODUCT.md 6).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SectionId } from '@config/appDefaults.ts';

export interface SectionTab {
  id: SectionId;
  label: string;
  /** `EN`, `UR`, or `EN·UR` -- which language this section prints in */
  tag: string;
  count: number;
}

type Edge = 'none' | 'start' | 'end' | 'both';

export function SectionTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: SectionTab[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<Edge>('none');

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const slack = el.scrollWidth - el.clientWidth;
    // 1px rather than 0: sub-pixel layout rounding otherwise reports a strip
    // that fits exactly as permanently scrollable.
    if (slack <= 1) return setEdge('none');
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft >= slack - 1;
    setEdge(atStart ? 'end' : atEnd ? 'start' : 'both');
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
    // Re-measured when the section list changes: a discharge summary has one
    // more tab than a prescription, which can be the one that overflows.
  }, [measure, tabs.length]);

  const index = tabs.findIndex((t) => t.id === active);

  return (
    <div className="tabs-strip" data-edge={edge}>
      <div className="tabs" role="tablist" ref={ref}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            aria-selected={active === t.id}
            onClick={() => onSelect(t.id)}
          >
            <strong>
              {t.label}
              {t.count > 0 && <span className="badge">{t.count}</span>}
            </strong>
            <span>{t.tag}</span>
          </button>
        ))}
      </div>
      {edge !== 'none' && (
        /*
          aria-hidden: a screen reader already announces "tab 4 of 7" from the
          tablist itself, and hearing the same fact twice in two wordings is
          worse than hearing it once.
        */
        <span className="tabs-count" aria-hidden="true">
          {index >= 0 ? index + 1 : 1}/{tabs.length}
        </span>
      )}
    </div>
  );
}
