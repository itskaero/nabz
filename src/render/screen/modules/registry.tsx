/**
 * Module id -> lazy panel (CLAUDE.md 6d). The render-layer half of the
 * registry in `domain/modules/index.ts` -- that file knows what a module IS;
 * this one knows how to SHOW it, and is the only place a `ModuleId` gets
 * attached to a component. Kept out of `domain/` on purpose: domain code
 * stays framework-free.
 *
 * `Record<ModuleId, ...>` over the closed union means adding a case here is
 * mandatory the moment a new `ModuleId` is added anywhere -- TypeScript
 * refuses to compile a registry missing one, the same guarantee
 * `domain/modules/index.ts`'s `MODULE_META` relies on.
 *
 * Lazy on purpose: a pack that does not enable `growth` should not ship the
 * WHO/CDC LMS tables to a browser that will never render that panel, and the
 * same now goes for eGFR.
 */
import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { ModuleId } from '@domain/pack.ts';

const GrowthPanel = lazy(() =>
  import('../components/GrowthPanel.tsx').then((m) => ({ default: m.GrowthPanel })),
);
const GfrPanel = lazy(() =>
  import('../components/GfrPanel.tsx').then((m) => ({ default: m.GfrPanel })),
);
const BmiPanel = lazy(() =>
  import('../components/BmiPanel.tsx').then((m) => ({ default: m.BmiPanel })),
);

export const MODULE_PANEL: Record<ModuleId, LazyExoticComponent<ComponentType>> = {
  growth: GrowthPanel,
  gfr: GfrPanel,
  bmi: BmiPanel,
};
