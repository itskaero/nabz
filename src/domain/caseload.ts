/**
 * Who you saw, and when.
 *
 * THE QUESTION NOTHING ELSE ANSWERS
 * ---------------------------------
 * `HistoryPanel` is a search box -- `searchHistory` returns nothing until two
 * characters are typed -- and `PatientPicker` ranks candidates against a name
 * you are already typing. Both assume you know who you are looking for. "Who
 * did I see last month" is the question a doctor asks when following somebody
 * up, and until now the app could not be asked it.
 *
 * So: months, and the patients in them.
 *
 * Framework-free, and it takes encounters a caller has already loaded. The
 * arranging is the interesting part -- which month a visit falls in, what one
 * row per patient means when they came three times, which diagnosis to show --
 * and all of it is testable without a database.
 *
 * It decides nothing clinical. A chip is a diagnosis somebody recorded; the
 * count beside a month is a count. Nothing here ranks, flags or suggests.
 */
import type { Prescription } from './prescription.ts';

/** `YYYY-MM`. Lexicographic order is chronological order, which is the point. */
export type MonthKey = string;

export interface CaseloadMonth {
  key: MonthKey;
  /** how many ENCOUNTERS, not how many patients -- see `CaseloadRow.visits` */
  encounters: number;
}

export interface CaseloadRow {
  /**
   * Absent for an encounter that was never linked to a patient record. Those
   * rows cannot be grouped with anything and are returned separately, because
   * silently folding two unidentified walk-ins into one row would invent a
   * patient.
   */
  patientId?: string;
  /** the name as it was printed that day, when there is no record to read */
  name: string;
  visits: number;
  /** ISO date of the most recent visit in the window */
  lastSeen: string;
  /**
   * The diagnoses from the LATEST encounter in the window -- what you last
   * thought this was.
   */
  diagnosis: string[];
  /**
   * How many OTHER distinct diagnoses the earlier visits in this window
   * recorded. Shown as "+N" so a month holding three different illnesses does
   * not read as one.
   */
  otherDiagnoses: number;
  /** newest first; each opens that day's document */
  encounterIds: string[];
}

export interface Caseload {
  month: MonthKey;
  rows: CaseloadRow[];
  /** encounters with no `patientId`, each its own row */
  unlinked: CaseloadRow[];
}

export function monthOf(isoDate: string): MonthKey {
  return isoDate.slice(0, 7);
}

/**
 * The half-open range for a month: `[first of this month, first of the next)`.
 *
 * Exclusive upper bound on the next month's first day, so there is no
 * month-length arithmetic anywhere and no `2026-09-31` sitting in the source
 * looking like a bug. Both ends are plain `YYYY-MM-DD` strings because
 * `prescriptions.byDate` indexes `rx.date`, which is one.
 */
export function monthWindow(key: MonthKey): { from: string; toExclusive: string } {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${key}-01`,
    toExclusive: `${nextYear}-${pad(nextMonth)}-01`,
  };
}

/**
 * The months that HAVE encounters, newest first.
 *
 * Generated rather than taken from a fixed window, for the reason
 * `shell/navModel.ts` gives about generating the nav from `pack.modules`: a
 * destination with nothing behind it is a button leading nowhere. A month the
 * doctor did not work is not offered.
 */
export function monthsWithVisits(dates: string[]): CaseloadMonth[] {
  const counts = new Map<MonthKey, number>();
  for (const d of dates) {
    if (!d) continue;
    const key = monthOf(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, encounters]) => ({ key, encounters }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

function fold(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * One row per patient for the encounters in one window.
 *
 * `names` maps a patient id to the name on their record, so a row shows the
 * current name rather than whatever was typed on the oldest script. Falls back
 * to the printed name when the record has been deleted -- a visit that
 * happened is still a visit.
 *
 * `encounters` is expected to be already restricted to the window; this does
 * not filter by date, because the caller got them from a key range and
 * re-deriving the range here would be two places to get the boundary wrong.
 */
export function caseload(
  month: MonthKey,
  encounters: Prescription[],
  names: Map<string, string> = new Map(),
): Caseload {
  const newestFirst = [...encounters].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );

  const byPatient = new Map<string, Prescription[]>();
  const unlinkedEncounters: Prescription[] = [];
  for (const rx of newestFirst) {
    if (!rx.patientId) {
      unlinkedEncounters.push(rx);
      continue;
    }
    const list = byPatient.get(rx.patientId);
    if (list) list.push(rx);
    else byPatient.set(rx.patientId, [rx]);
  }

  const toRow = (patientId: string | undefined, group: Prescription[]): CaseloadRow => {
    const latest = group[0]!;
    const shown = latest.diagnosis.filter((d) => d.trim());
    const seen = new Set(shown.map(fold));
    let others = 0;
    for (const rx of group.slice(1)) {
      for (const d of rx.diagnosis) {
        const key = fold(d);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        others += 1;
      }
    }
    return {
      ...(patientId ? { patientId } : {}),
      name: (patientId ? names.get(patientId) : undefined) ?? latest.patient.name.trim() ?? '',
      visits: group.length,
      lastSeen: latest.date,
      diagnosis: shown,
      otherDiagnoses: others,
      encounterIds: group.map((rx) => rx.id),
    };
  };

  const rows = [...byPatient.entries()]
    .map(([patientId, group]) => toRow(patientId, group))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.name.localeCompare(b.name));

  return {
    month,
    rows,
    unlinked: unlinkedEncounters.map((rx) => toRow(undefined, [rx])),
  };
}

/**
 * A month as a doctor would say it. "This month" for the current one, because
 * the only thing anybody checks more often than last month is today.
 */
export function monthLabel(key: MonthKey, now = new Date()): string {
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (key === thisMonth) return 'This month';
  const [year, month] = [Number(key.slice(0, 4)), Number(key.slice(5, 7))];
  const name = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][month - 1];
  // The year only when it is not the current one: "September" is unambiguous
  // in October and "September 2025" is noise.
  return year === now.getFullYear() ? (name ?? key) : `${name ?? key} ${year}`;
}
