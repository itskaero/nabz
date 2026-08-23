/**
 * Keep the queue current wherever the doctor happens to be looking.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * Polling used to live inside the queue screen, so it only ran while that
 * screen was open. A doctor writing a script — which is most of the day — was
 * not syncing at all: reception added patients, nothing arrived, and the queue
 * only caught up when the doctor happened to look at it. Worse, it looked
 * identical to the sync being broken.
 *
 * So the timer belongs to the shell, not to one screen.
 *
 * WHY TWO INTERVALS
 * -----------------
 * On the queue screen a stale row is visible and wrong, so ten seconds. Away
 * from it nobody is reading the list, and the only thing that matters is being
 * current by the time they look — a minute is plenty, and it keeps a clinic's
 * wifi and the station's disk quiet through a long consultation.
 *
 * Syncing on tab-focus matters more than either: coming back to the app is
 * exactly when someone is about to read the queue.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { pairedCode, syncClinicLayer } from '@storage/clinicSync.ts';

const FOREGROUND_MS = 10_000;
const BACKGROUND_MS = 60_000;

export interface BackgroundSync {
  /** Bumped whenever a sync brought something back, so views can refresh. */
  tick: number;
  /** ISO time of the last successful sync, or null. */
  syncedAt: string | null;
  /** Run one now; resolves true when the station answered. */
  syncNow: () => Promise<boolean>;
}

export function useBackgroundSync(options: {
  enabled: boolean;
  /** true while the queue is on screen, which is when staleness is visible */
  watching: boolean;
}): BackgroundSync {
  const { enabled, watching } = options;
  const [tick, setTick] = useState(0);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  // Kept in a ref so the interval effect does not restart on every sync.
  const running = useRef(false);

  const syncNow = useCallback(async () => {
    if (running.current) return false;
    running.current = true;
    try {
      const merged = await syncClinicLayer();
      if (!merged) return false;
      setSyncedAt(new Date().toISOString());
      // Only wake the views when something actually came back. A tick on every
      // poll would re-render the queue six times a minute for nothing.
      if (merged.queue.length > 0 || merged.patients.length > 0) {
        setTick((n) => n + 1);
      }
      return true;
    } catch {
      // A station that is off, or a device not yet paired, are both ordinary
      // states in a clinic. The queue screen reports them; a timer should not.
      return false;
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !pairedCode()) return;
    let stopped = false;

    const beat = () => {
      if (stopped || document.hidden) return;
      void syncNow();
    };

    beat();
    const timer = setInterval(beat, watching ? FOREGROUND_MS : BACKGROUND_MS);
    // Returning to the app is the moment someone is about to read the queue.
    const onVisible = () => {
      if (!document.hidden) beat();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, watching, syncNow]);

  return { tick, syncedAt, syncNow };
}
