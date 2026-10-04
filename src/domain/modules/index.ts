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
  /*
    `heightCm` rather than `ageDays`: weight-for-height is keyed by the
    measurement, not by age, and a protocol that admits on MUAC alone does not
    need the age at all. The panel asks for what its protocol actually uses.
  */
  malnutrition: {
    id: 'malnutrition',
    label: 'Malnutrition',
    requires: ['sex', 'weightKg', 'heightCm'],
  },
  /*
    `weightKg` and nothing else.

    Age narrows WHICH row of a pack's dosing applies and the panel says so when
    it is known, but a weight alone is enough to turn a mg/kg row into
    milligrams -- and a child who has been weighed but whose birthday nobody
    recorded is the ordinary walk-in, not an edge case. Requiring the date of
    birth would close the calculator for exactly the patient who needs it.
  */
  dosecalc: { id: 'dosecalc', label: 'Dose calculator', requires: ['weightKg'] },
};

/** The modules a pack enables, resolved to their metadata, in offer order. */
export function modulesFor(enabled: ModuleId[]): ModuleMeta[] {
  return enabled.map((id) => MODULE_META[id]).filter((m): m is ModuleMeta => Boolean(m));
}
