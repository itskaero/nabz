/**
 * Layer 2: the per-doctor / per-clinic profile.
 *
 * Set once, then never thought about again. This is also the natural anchor for
 * the v2 per-doctor licence, which is why it is a separate, separately stored
 * object rather than fields sprinkled through app settings (CLAUDE.md 7).
 */
import type { Locale, SectionLanguage } from '@domain/locale.ts';
import type { ClinicSettings } from '@domain/clinic.ts';
import { defaultClinicSettings } from '@domain/clinic.ts';
import type { RoleGate } from '@domain/roles.ts';
import { openGate } from '@domain/roles.ts';
import type { Margins, PaperSize, SectionId } from './appDefaults.ts';
import { appDefaults } from './appDefaults.ts';

/**
 * THREE modes, not a toggle (PRODUCT.md 10). The preview renders whichever the
 * doctor chose, including the blank reserved zone in `pad` mode -- otherwise
 * "preview == print" is false for exactly the doctors who print on a pre-printed
 * pad, which in a Pakistani private clinic is most of them.
 */
export type LetterheadMode =
  /** the app draws the doctor block as text on plain paper */
  | 'text'
  /** the app draws the doctor block plus an uploaded clinic logo */
  | 'text+logo'
  /** pre-printed pad: the app draws NOTHING at the top and reserves a zone */
  | 'pad';

/**
 * The registration field is locale-aware by design: PMDC in Pakistan, GMC in
 * the UK, and so on. Hardcoding "PMDC" would be exactly the Pakistan-only
 * assumption the architecture is meant to avoid (PRODUCT.md 10).
 */
export interface RegistrationField {
  /** e.g. 'PMDC', 'GMC', 'NMC' */
  authority: string;
  number: string;
}

export interface DoctorBlock {
  name: string;
  qualifications: string;
  registration: RegistrationField;
  clinicName: string;
  clinicAddress?: string;
  phone?: string;
  timings?: string;
}

export interface DoctorProfile {
  doctor: DoctorBlock;
  paper: PaperSize;
  margins: Margins;
  letterhead: {
    mode: LetterheadMode;
    /** height of the zone left blank in `pad` mode, in mm */
    reservedTopMm: number;
    /** data: URL of the clinic logo, used only in 'text+logo' */
    logoDataUrl?: string;
  };
  /** per-section overrides on top of appDefaults.sectionLanguage */
  sectionLanguage: Partial<Record<SectionId, SectionLanguage>>;
  /** which content pack this doctor practises from */
  packId: string;
  /** ids of exam systems this doctor has hidden from their palette */
  hiddenExamSystems: string[];
  /**
   * Findings this doctor has added to a system's palette, plus the ones the app
   * has offered to promote from repeated free text (PRODUCT.md 8, self-growing).
   */
  extraFindings: Record<string, Array<{ id: string; label: string }>>;
  growth: { reference: 'WHO' | 'CDC' };
  /**
   * The clinic layer (queue, fees). Off by default and invisible until turned
   * on: this is a prescription app first, a clinic system second.
   */
  clinic: ClinicSettings;
  /**
   * PIN gate for the clinical side on a shared machine. Not a security
   * boundary -- see domain/roles.ts. The real boundary is that on a two-station
   * setup the records are not on the reception machine at all.
   */
  roleGate: RoleGate;
  uiLocale: Locale;
  /** ISO date of the last successful export; drives the backup nag */
  lastBackupAt?: string;
}

export const defaultDoctorProfile: DoctorProfile = {
  doctor: {
    name: '',
    qualifications: '',
    registration: { authority: 'PMDC', number: '' },
    clinicName: '',
  },
  paper: appDefaults.paper,
  margins: appDefaults.margins,
  letterhead: { mode: 'text', reservedTopMm: 45 },
  sectionLanguage: {},
  packId: 'paediatrics',
  hiddenExamSystems: [],
  extraFindings: {},
  growth: { reference: 'WHO' },
  clinic: defaultClinicSettings,
  roleGate: openGate,
  uiLocale: 'en',
};

/**
 * Resolve the language for one section: profile override, else app default.
 * The two layers are read here and nowhere else, so neither can be quietly
 * flattened into the other.
 */
export function languageFor(profile: DoctorProfile, section: SectionId): SectionLanguage {
  return profile.sectionLanguage[section] ?? appDefaults.sectionLanguage[section];
}

/** Every locale this document will actually print in. */
export function localesInUse(profile: DoctorProfile): Locale[] {
  const set = new Set<Locale>();
  (Object.keys(appDefaults.sectionLanguage) as SectionId[]).forEach((s) => {
    const lang = languageFor(profile, s);
    set.add(lang.primary);
    if (lang.secondary) set.add(lang.secondary);
  });
  return [...set];
}

export function isProfileComplete(profile: DoctorProfile): boolean {
  const d = profile.doctor;
  return (
    d.name.trim() !== '' && d.registration.number.trim() !== '' && d.clinicName.trim() !== ''
  );
}
