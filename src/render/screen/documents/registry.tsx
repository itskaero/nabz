/**
 * Section id -> the component that edits it (CLAUDE.md 6d).
 *
 * The render-layer half of `domain/documents`: that file knows what a document
 * kind IS; this one knows how to EDIT each of its sections, and is the only
 * place a `SectionId` gets attached to a component. Kept out of `domain/` for
 * the same reason `modules/registry.tsx` is -- domain code stays framework-free.
 *
 * `Record<SectionId, ...>` over the closed union means adding a section
 * anywhere makes this file fail to compile until it says how to edit it. A
 * document kind therefore cannot list a tab that leads nowhere, which is the
 * bug the module nav had before `pack.modules` drove it.
 */
import type { ComponentType } from 'react';
import type { SectionId } from '@config/appDefaults.ts';
import { ListSection } from '../sections/ListSection.tsx';
import { ExamSection } from '../sections/ExamSection.tsx';
import { LabsSection } from '../sections/LabsSection.tsx';
import { MedicationsSection } from '../sections/MedicationsSection.tsx';
import { AdviceSection } from '../sections/AdviceSection.tsx';
import { StaySection } from '../sections/StaySection.tsx';

function Problems() {
  return (
    <ListSection
      field="problems"
      title="Presenting complaints"
      placeholder="e.g. Fever for 3 days"
      note="Free text. Suggestions come from what you have written before."
    />
  );
}

function Diagnosis() {
  return (
    <ListSection
      field="diagnosis"
      title="Diagnosis"
      placeholder="e.g. Community-acquired pneumonia"
      strong
      note="Free text on purpose — diagnosis is judgement, not a list to pick from."
    />
  );
}

export const SECTION_PANEL: Record<SectionId, ComponentType> = {
  problems: Problems,
  stay: StaySection,
  examination: ExamSection,
  diagnosis: Diagnosis,
  labs: LabsSection,
  medications: MedicationsSection,
  advice: AdviceSection,
};

/** The default tab wording. A kind may override it (`DocumentKindMeta.sectionLabel`). */
export const SECTION_LABEL: Record<SectionId, string> = {
  problems: 'Problems',
  stay: 'Admission',
  examination: 'Exam',
  diagnosis: 'Diagnosis',
  labs: 'Tests',
  medications: 'Medicines',
  advice: 'Advice',
};
