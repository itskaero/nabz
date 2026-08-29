/**
 * The clinical-tool module registry (CLAUDE.md 6d).
 *
 * Framework-free by design -- `render/screen/modules/registry.tsx` maps each
 * id to a lazy-loaded panel; this file only knows what a module IS: its label
 * and which patient facts it needs before it can compute anything. `ModuleId`
 * (`domain/pack.ts`) stays a closed union, so this map is exhaustive by
 * construction -- TypeScript refuses to compile if a case goes missing, which
 * is what "declaring an id that doesn't exist should fail the build" means in
 * practice.
 *
 * A pack's nav is generated from `pack.modules` filtered through this map
 * (App.tsx), replacing what used to be one hardcoded Growth button gated on
 * device role alone and never on whether the active pack actually offers it.
 */
import type { ModuleId } from '../pack.ts';

export interface ModuleMeta {
  id: ModuleId;
  label: string;
  /** patient facts the panel needs before it can compute anything */
  requires: ReadonlyArray<'sex' | 'ageDays' | 'weightKg' | 'heightCm' | 'creatinine'>;
}

export const MODULE_META: Record<ModuleId, ModuleMeta> = {
  growth: { id: 'growth', label: 'Growth', requires: ['sex', 'ageDays'] },
  gfr: { id: 'gfr', label: 'eGFR', requires: ['sex', 'ageDays'] },
  bmi: { id: 'bmi', label: 'BMI / BSA', requires: ['weightKg', 'heightCm'] },
};

/** The modules a pack enables, resolved to their metadata, in offer order. */
export function modulesFor(enabled: ModuleId[]): ModuleMeta[] {
  return enabled.map((id) => MODULE_META[id]).filter((m): m is ModuleMeta => Boolean(m));
}
