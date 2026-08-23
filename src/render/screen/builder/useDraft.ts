/**
 * The builder's editing state: a working copy of the live content, plus every
 * gate that stands between it and a patient.
 *
 * The gates are deliberately stricter here than they are at load time. At load
 * time the app must run on whatever it has, so `validateContentPack` reports
 * an unreviewed red flag as a warning and the shipped pack still prints. HERE a
 * human is present, which is the only moment the reviewing can actually happen
 * -- so the same warning blocks export. That asymmetry is the point of the tool.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContentPack } from '@domain/pack.ts';
import { redFlagWording, unreviewedRedFlags, validateContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';
import { validatePacks } from '@domain/phrases.ts';
import type { Locale } from '@domain/locale.ts';
import { LOCALES } from '@domain/locale.ts';
import type { GenericUsage } from '@domain/generics.ts';
import * as db from '@storage/db.ts';
import { APP_CONTENT_VERSION } from '@data/provider.ts';
import {
  genericVocabulary,
  genericsWithoutDosing,
  nearDuplicates,
  normaliseGeneric,
  orphanedDosing,
  unreconciledBrands,
} from '@domain/generics.ts';

export interface Gate {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

export interface Draft {
  pack: ContentPack;
  phrases: PackRegistry;
  dirty: boolean;
  setPack: (next: ContentPack) => void;
  setPhrases: (next: PackRegistry) => void;
  /** edit one locale's slice without rebuilding the whole registry by hand */
  editLocale: (locale: Locale, patch: (pack: PackRegistry[Locale]) => PackRegistry[Locale]) => void;
  markClean: () => void;
  /** true when this session opened onto work recovered from a previous one */
  restored: boolean;

  vocabulary: GenericUsage[];
  gates: Gate[];
  errors: Gate[];
  /** true when nothing blocks export */
  exportable: boolean;
  stats: {
    brands: number;
    generics: number;
    dosing: number;
    chips: number;
    unreconciled: number;
    unreviewedRedFlags: number;
    genericsWithoutDosing: number;
  };
  /** wording fingerprint for a red flag, across every locale */
  wordingOf: (redFlagId: string) => string;
  /** near-duplicate check for a generic being typed right now */
  checkGeneric: (candidate: string) => ReturnType<typeof nearDuplicates>;
}

export function useDraft(
  initialPack: ContentPack,
  initialPhrases: PackRegistry,
): Draft {
  const [pack, setPackState] = useState<ContentPack>(initialPack);
  const [phrases, setPhrasesState] = useState<PackRegistry>(initialPhrases);
  const [dirty, setDirty] = useState(false);
  const [restored, setRestored] = useState(false);

  /*
    Bring back whatever was being edited last time.

    The draft used to live only in React state, so closing the tab or reloading
    threw away the work with nothing to recover it from -- and Export refused to
    write a file while the pack still had problems, which is precisely when a
    draft exists. An unfinished pack is the normal state of authoring; losing it
    should not be.
  */
  useEffect(() => {
    let cancelled = false;
    void db.loadDraft().then((saved) => {
      if (cancelled || !saved) return;
      setPackState(saved.pack);
      setPhrasesState(saved.phrases);
      setDirty(true);
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
    Autosave, debounced. Typing a phrase should not write to IndexedDB on every
    keystroke, and a second of quiet is short enough that nothing meaningful is
    ever more than a second from being safe.
  */
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void db.saveDraft({
        pack,
        phrases,
        basedOn: { packId: pack.id, appVersion: APP_CONTENT_VERSION },
        updatedAt: new Date().toISOString(),
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [pack, phrases, dirty]);

  /** Forget the stored draft: the edits have been published or thrown away. */
  const dropDraft = useCallback(() => {
    setDirty(false);
    setRestored(false);
    void db.clearDraft();
  }, []);

  const setPack = useCallback((next: ContentPack) => {
    setPackState(next);
    setDirty(true);
  }, []);

  const setPhrases = useCallback((next: PackRegistry) => {
    setPhrasesState(next);
    setDirty(true);
  }, []);

  const editLocale = useCallback<Draft['editLocale']>((locale, patch) => {
    setPhrasesState((prev) => ({ ...prev, [locale]: patch(prev[locale]) }));
    setDirty(true);
  }, []);

  const wordingOf = useCallback(
    (redFlagId: string) =>
      redFlagWording(LOCALES.map((l) => phrases[l].advice.tier2[redFlagId] ?? '')),
    [phrases],
  );

  const vocabulary = useMemo(() => genericVocabulary(pack), [pack]);

  const gates = useMemo<Gate[]>(() => {
    const out: Gate[] = validateContentPack(pack).map((i) => ({ ...i }));

    for (const issue of validatePacks(phrases)) out.push({ ...issue });

    // Escalate the red-flag warning to an error: this is the moment a human
    // can sign off, so this is the moment to insist (PRODUCT.md 9).
    for (const flag of unreviewedRedFlags(pack, wordingOf)) {
      const at = out.findIndex((g) => g.where === `advicePacks.tier2.${flag.id}`);
      if (at >= 0) out.splice(at, 1);
      out.push({
        severity: 'error',
        where: `advicePacks.tier2.${flag.id}`,
        message:
          flag.reason === 'never-reviewed'
            ? 'red flag has never been signed off. Nothing automatic can catch a wrong translation of a return precaution.'
            : 'the wording changed after it was signed off. Review it again.',
      });
    }

    // Two spellings of one generic silently break the formulary/dosing join.
    const seen = new Map<string, string>();
    for (const entry of vocabulary) {
      const collision = seen.get(entry.key);
      if (collision) {
        out.push({
          severity: 'error',
          where: `generic "${entry.name}"`,
          message: `also written as "${collision}". Two spellings of one generic split its dosing in half.`,
        });
      } else seen.set(entry.key, entry.name);
    }

    for (const row of orphanedDosing(pack)) {
      out.push({
        severity: 'error',
        where: `dosing "${row.generic}"`,
        message: 'no medicine in the catalogue uses this generic, so this dose can never be suggested. Usually a spelling difference.',
      });
    }

    for (const entry of genericsWithoutDosing(pack)) {
      out.push({
        severity: 'warning',
        where: `generic "${entry.name}"`,
        message: `${entry.brands} brand${entry.brands === 1 ? '' : 's'} but no cited dose; no suggestion will ever be shown for it.`,
      });
    }

    for (const id of pack.sigTemplates) {
      for (const locale of LOCALES) {
        if (phrases[locale].templates[id] === undefined) {
          out.push({
            severity: 'error',
            where: `sigTemplates.${id}`,
            message: `offered by the pack but not written in "${locale}".`,
          });
        }
      }
    }

    return out;
  }, [pack, phrases, vocabulary, wordingOf]);

  const errors = useMemo(() => gates.filter((g) => g.severity === 'error'), [gates]);

  const stats = useMemo(
    () => ({
      brands: pack.formularySeed.length,
      generics: vocabulary.length,
      dosing: pack.dosing.length,
      chips: Object.values(pack.findingsPalette).reduce((n, list) => n + list.length, 0),
      unreconciled: unreconciledBrands(pack).length,
      unreviewedRedFlags: unreviewedRedFlags(pack, wordingOf).length,
      genericsWithoutDosing: genericsWithoutDosing(pack).length,
    }),
    [pack, vocabulary, wordingOf],
  );

  const checkGeneric = useCallback(
    (candidate: string) => nearDuplicates(candidate, vocabulary),
    [vocabulary],
  );

  return {
    pack,
    phrases,
    dirty,
    setPack,
    setPhrases,
    editLocale,
    markClean: dropDraft,
    restored,
    vocabulary,
    gates,
    errors,
    exportable: errors.length === 0,
    stats,
    wordingOf,
    checkGeneric,
  };
}

/** Normalise on the way in, so the vocabulary never gains a whitespace twin. */
export function cleanGeneric(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export { normaliseGeneric };
