/**
 * Examination: chip state model + composition to English prose.
 *
 * Exam is the EASY section, and it is easy precisely because of its language
 * choice: it is English-only, for the doctor/record/pharmacist (PRODUCT.md 6).
 * No translation, no bidi, no plural packs. Do not "improve" it by making it
 * bilingual -- the patient does not read the exam findings, and every locale
 * you add here is a locale you have to keep correct forever.
 *
 * A chip is a stateful control, not a text macro (PRODUCT.md 8):
 *   untouched -> present -> absent -> untouched
 * "Untouched" is represented by the finding being absent from the list, so an
 * unexamined system carries no claim at all, while an explicit `absent` records
 * a pertinent negative -- which matters medico-legally and must be as fast to
 * enter as a positive.
 */
import type { ExamFinding, ExamSystem, FindingState } from './prescription.ts';

/** The next state in the tap cycle. `null` means "back to untouched". */
export function nextFindingState(current: FindingState | null): FindingState | null {
  if (current === null) return 'present';
  if (current === 'present') return 'absent';
  return null;
}

export function findFinding(system: ExamSystem, id: string): ExamFinding | undefined {
  return system.findings.find((f) => f.id === id);
}

/** Apply a tap to a system, returning a new system (pure; no mutation). */
export function toggleFinding(
  system: ExamSystem,
  id: string,
  label: string,
): ExamSystem {
  const current = findFinding(system, id);
  const next = nextFindingState(current?.state ?? null);
  if (next === null) {
    return { ...system, findings: system.findings.filter((f) => f.id !== id) };
  }
  if (!current) {
    return { ...system, findings: [...system.findings, { id, label, state: next }] };
  }
  return {
    ...system,
    findings: system.findings.map((f) => (f.id === id ? { ...f, state: next } : f)),
  };
}

/** Attach or clear a modifier value ("3cm", "grade 2"). */
export function setFindingValue(
  system: ExamSystem,
  id: string,
  value: string | undefined,
): ExamSystem {
  return {
    ...system,
    findings: system.findings.map((f) => {
      if (f.id !== id) return f;
      const next: ExamFinding = { ...f };
      if (value && value.trim()) next.value = value.trim();
      else delete next.value;
      return next;
    }),
  };
}

/** A system with nothing recorded is omitted from the document entirely. */
export function isSystemEmpty(system: ExamSystem): boolean {
  return system.findings.length === 0 && !system.freeText?.trim();
}

export function findingCount(system: ExamSystem): number {
  return system.findings.length + (system.freeText?.trim() ? 1 : 0);
}

/**
 * One finding as English prose.
 *   present + value -> "hepatomegaly 3cm"
 *   present         -> "hepatomegaly"
 *   absent          -> "no neck stiffness"
 *
 * The negation word is prefixed rather than the label being rewritten, so a
 * palette edit can never silently invert a recorded finding.
 */
export function composeFinding(finding: ExamFinding): string {
  const label = finding.label.trim();
  const withValue = finding.value ? `${label} ${finding.value.trim()}` : label;
  return finding.state === 'absent' ? `no ${withValue}` : withValue;
}

/**
 * One system as English prose, positives first.
 * Positives lead because that is what the reader is scanning for; the pertinent
 * negatives still print, they just do not bury the abnormal finding.
 */
export function composeSystem(system: ExamSystem, label: string): string | null {
  if (isSystemEmpty(system)) return null;
  const present = system.findings.filter((f) => f.state === 'present').map(composeFinding);
  const absent = system.findings.filter((f) => f.state === 'absent').map(composeFinding);
  const free = system.freeText?.trim();
  const parts = [...present, ...absent];
  if (free) parts.push(free);
  if (parts.length === 0) return null;
  return `${label}: ${parts.join(', ')}`;
}

/** The whole examination, one line per examined system. Unexamined ones vanish. */
export function composeExamination(
  systems: ExamSystem[],
  labelOf: (systemId: string) => string,
): string[] {
  return systems
    .map((s) => composeSystem(s, labelOf(s.system)))
    .filter((line): line is string => line !== null);
}
