/**
 * App state. One prescription in progress, plus the doctor's profile.
 *
 * The rules this file is responsible for keeping true:
 *  - a NEW prescription starts empty. It never inherits anything from the last
 *    patient, and there is no code path that fills it from a name match
 *    (PRODUCT.md rule 3.4).
 *  - `refillFrom` copies the CLINICAL content of a prior visit that the doctor
 *    searched for and explicitly selected, and deliberately does not copy the
 *    patient block: a refill is "these medicines again", not "this person
 *    again", and re-typing the name is a cheap guard against the wrong chart.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  AdviceItem,
  ExamSystem,
  LabOrder,
  MedicationLine,
  Patient,
  Prescription,
} from '@domain/prescription.ts';
import { emptyPrescription } from '@domain/prescription.ts';
import type { Patch } from '@domain/patch.ts';
import { applyPatch } from '@domain/patch.ts';
import type { DoctorProfile } from '@config/doctorProfile.ts';
import { defaultDoctorProfile } from '@config/doctorProfile.ts';
import { DEFAULT_PACK_ID } from '@data/packs/index.ts';
import type { ContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import type { ResolvedContent } from '@data/provider.ts';
import { resolveContent, shippedContent } from '@data/provider.ts';
import type { PatientRecord } from '@domain/patient.ts';
import * as db from '@storage/db.ts';

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface Store {
  rx: Prescription;
  profile: DoctorProfile;
  /** live content pack -- the doctor's edited copy if they have one */
  pack: ContentPack;
  /** live locale packs, same */
  phrases: PackRegistry;
  /** non-empty when an edited copy exists but failed validation and was ignored */
  contentRejected: string[];
  /** re-read content after the builder publishes */
  refreshContent: () => Promise<void>;
  dirty: boolean;
  savedAt: string | null;

  /**
   * The identified patient for THIS encounter, if one has been chosen.
   *
   * Null is the normal case for a walk-in and must stay usable -- identifying a
   * patient is an accelerator, never a gate. Choosing one is always an explicit
   * human act (see PatientPicker); nothing here matches a name to a record on
   * its own.
   */
  patient: PatientRecord | null;
  /** Attach an identified patient and copy their details into the script. */
  identifyPatient: (record: PatientRecord) => void;
  /** Detach without clearing what has been typed. */
  clearPatient: () => void;

  setPatient: (patch: Patch<Patient>) => void;
  setList: (field: 'problems' | 'diagnosis', items: string[]) => void;
  setExam: (systems: ExamSystem[]) => void;
  /**
   * Takes an updater, not a value.
   *
   * Two chips tapped in quick succession both read `rx.labs` from the render
   * that was on screen when they were tapped, so passing a computed array makes
   * the second tap overwrite the first -- a silently dropped investigation.
   * Reproduced in a browser: tapping CBC then Chest X-ray left only the X-ray.
   */
  setLabs: (update: (prev: LabOrder[]) => LabOrder[]) => void;
  setMedications: (lines: MedicationLine[]) => void;
  setAdvice: (items: AdviceItem[]) => void;
  setFollowUp: (days: number | null) => void;

  save: () => Promise<void>;
  /**
   * Which queue visit this script belongs to, when it was opened from the
   * queue. Saving the script closes that visit -- see db.completeQueueEntry.
   */
  openFromQueue: (entryId: string) => void;
  /** true while the open script belongs to a queue visit */
  fromQueue: boolean;
  startNew: () => void;
  refillFrom: (prior: Prescription) => void;
  setProfile: (profile: DoctorProfile) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<DoctorProfile>(defaultDoctorProfile);
  const [rx, setRx] = useState<Prescription>(() =>
    emptyPrescription(DEFAULT_PACK_ID, newId()),
  );
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [content, setContent] = useState<ResolvedContent>(shippedContent);
  const [patient, setPatientRecord] = useState<PatientRecord | null>(null);
  const [queueEntryId, setQueueEntryId] = useState<string | null>(null);
  const loadedProfile = useRef(false);

  const refreshContent = useCallback(async () => {
    setContent(await resolveContent());
  }, []);

  useEffect(() => {
    if (loadedProfile.current) return;
    loadedProfile.current = true;
    void db.loadProfile().then((stored) => {
      if (stored) setProfileState({ ...defaultDoctorProfile, ...stored });
    });
    // Renders with the shipped packs for one frame, then swaps to the edited
    // copy if there is a valid one. Blocking the whole app on a storage read
    // would be a worse trade than a single re-render.
    void refreshContent();
    void db.requestPersistence();
  }, [refreshContent]);

  const patch = useCallback((updater: (prev: Prescription) => Prescription) => {
    setRx((prev) => updater(prev));
    setDirty(true);
  }, []);

  const value = useMemo<Store>(() => {
    return {
      rx,
      profile,
      pack: content.pack,
      phrases: content.phrases,
      contentRejected: content.rejected,
      refreshContent,
      dirty,
      savedAt,
      patient,

      identifyPatient: (record) => {
        setPatientRecord(record);
        // Identity flows into the script; CLINICAL content does not. This is
        // the whole of the concession in PRODUCT.md rule 3.4 -- the last
        // prescription is still an explicit manual search-and-select.
        patch((prev) => ({
          ...prev,
          patientId: record.id,
          patient: {
            ...prev.patient,
            name: record.name,
            ...(record.dob ? { dob: record.dob } : {}),
            ...(record.sex ? { sex: record.sex } : {}),
            ...(record.phone ? { contact: record.phone } : {}),
            ...(record.fileNo ? { reference: record.fileNo } : {}),
          },
        }));
      },

      clearPatient: () => {
        setPatientRecord(null);
        patch((prev) => {
          const next = { ...prev };
          delete next.patientId;
          return next;
        });
      },

      setPatient: (p) => patch((prev) => ({ ...prev, patient: applyPatch(prev.patient, p) })),
      setList: (field, items) => patch((prev) => ({ ...prev, [field]: items })),
      setExam: (systems) => patch((prev) => ({ ...prev, examination: systems })),
      setLabs: (update) => patch((prev) => ({ ...prev, labs: update(prev.labs) })),
      setMedications: (lines) => patch((prev) => ({ ...prev, medications: lines })),
      setAdvice: (items) => patch((prev) => ({ ...prev, advice: items })),
      setFollowUp: (days) =>
        patch((prev) => ({
          ...prev,
          followUp: days && days > 0 ? { in: { value: days, unit: 'day' } } : undefined,
        })),

      openFromQueue: (entryId) => setQueueEntryId(entryId),
      fromQueue: queueEntryId !== null,
      save: async () => {
        await db.savePrescription(rx);
        // The doctor has written the script, so the visit is over. Asking them
        // to also tap "done" is asking for the same fact twice, and it is the
        // tap that gets forgotten.
        if (queueEntryId) await db.completeQueueEntry(queueEntryId, rx.id);
        // Learn from what was actually written, so the doctor's own vocabulary
        // is what autocompletes next time -- not a stock list.
        await Promise.all([
          ...rx.problems.map((t) => db.learn('problem', t)),
          ...rx.diagnosis.map((t) => db.learn('diagnosis', t)),
          ...rx.medications.map((m) =>
            db.learn('drug', m.drug.brand || m.drug.generic || m.drug.raw || ''),
          ),
          ...rx.examination.flatMap((s) =>
            s.freeText?.trim() ? [db.learn('finding', s.freeText.trim())] : [],
          ),
          ...rx.advice.flatMap((a) => (a.kind === 3 ? [db.learn('advice', a.text)] : [])),
        ]);
        setDirty(false);
        setSavedAt(new Date().toISOString());
      },

      startNew: () => {
        setRx(emptyPrescription(profile.packId, newId()));
        setPatientRecord(null);
        // A new script is a new encounter: it must not close the previous
        // patient's visit when it is saved.
        setQueueEntryId(null);
        setDirty(false);
        setSavedAt(null);
      },

      refillFrom: (prior) => {
        // Clinical content only. The patient block stays blank on purpose.
        setPatientRecord(null);
        setQueueEntryId(null);
        setRx({
          ...emptyPrescription(profile.packId, newId()),
          problems: [...prior.problems],
          diagnosis: [...prior.diagnosis],
          examination: prior.examination.map((s) => ({
            ...s,
            findings: s.findings.map((f) => ({ ...f })),
          })),
          medications: prior.medications.map((m) => ({ ...m, id: newId() })),
          advice: prior.advice.map((a) => ({ ...a, id: newId() })),
        });
        setDirty(true);
        setSavedAt(null);
      },

      setProfile: (next) => {
        setProfileState(next);
        void db.saveProfile(next);
      },
    };
  }, [rx, profile, content, refreshContent, dirty, savedAt, patient, patch, queueEntryId]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
