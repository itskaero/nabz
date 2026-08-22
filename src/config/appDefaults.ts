/**
 * Layer 1: shipped defaults.
 *
 * "The app's default A4" and "my clinic's letterhead" are different scopes and
 * live in different files (CLAUDE.md 7). Merging them into one blob is how you
 * end up unable to answer "did the doctor choose this, or did we?" -- which
 * matters the day a script prints wrong.
 *
 * Nothing clinical and nothing locale-specific belongs here.
 */
import type { Locale, SectionLanguage } from '@domain/locale.ts';

export type PaperSize = 'A4' | 'Letter';

/** Millimetres. The PDF renderer works in mm and converts once, at the edge. */
export interface PaperSpec {
  widthMm: number;
  heightMm: number;
}

export const PAPER: Record<PaperSize, PaperSpec> = {
  A4: { widthMm: 210, heightMm: 297 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
};

export interface Margins {
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
}

export type SectionId =
  | 'problems'
  | 'examination'
  | 'diagnosis'
  | 'medications'
  | 'advice';

export interface AppDefaults {
  paper: PaperSize;
  margins: Margins;
  /**
   * PRODUCT.md 6: language follows AUDIENCE, per section. Medications and
   * advice are the patient's; the rest are the record's.
   */
  sectionLanguage: Record<SectionId, SectionLanguage>;
  /**
   * Legibility floor for the Urdu patient block, in points. A cheap mono laser
   * turns small Nastaliq into mud, and the patient block is the one thing in
   * the document that has to survive that printer (PRODUCT.md 10).
   */
  urduMinPt: number;
  /** base size for English clinical text */
  latinBasePt: number;
  /** how loudly to nag about backups; see PRODUCT.md 12 */
  backupReminderDays: number;
  defaultLocale: Locale;
}

export const appDefaults: AppDefaults = {
  paper: 'A4',
  margins: { topMm: 16, rightMm: 14, bottomMm: 16, leftMm: 14 },
  sectionLanguage: {
    problems: { primary: 'en' },
    examination: { primary: 'en' },
    diagnosis: { primary: 'en' },
    // Never Urdu alone: the English is the safety net a pharmacist reads
    // (PRODUCT.md rule 3.5).
    medications: { primary: 'en', secondary: 'ur-PK' },
    advice: { primary: 'ur-PK', secondary: 'en' },
  },
  urduMinPt: 11,
  latinBasePt: 9.5,
  backupReminderDays: 7,
  defaultLocale: 'en',
};

export default appDefaults;
