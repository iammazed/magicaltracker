import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { usePassport, type Challenge } from '@/hooks/use-passport';
import { getSetting, setSetting } from '@/lib/local-db';

/**
 * Which achievements the user has reached but not yet looked at.
 *
 * Two separate jobs, and keeping them separate is what makes this behave:
 *
 * **The badge** is `current \ seen` — milestones reached minus milestones
 * acknowledged. Only `seen` is stored, so the unread count is derived and
 * cannot drift out of step with reality. Opening the Passport marks
 * everything seen and the badge clears.
 *
 * **The banner** fires on a transition observed WITHIN a session, tracked in
 * a ref that is seeded on the first computation after load. That distinction
 * matters: a badge should survive a relaunch, and a celebration should not.
 * Being congratulated on launch for something you earned last Tuesday is
 * confusing, not exciting.
 */

const SEEN_KEY = 'achievements_seen';

export type Unlock = {
  /** Stable identity of the milestone: the challenge plus the step reached. */
  key: string;
  challengeId: string;
  title: string;
  /** `Bronze` … `Platinum`, or null for an all-or-nothing challenge. */
  tier: string | null;
  earned: number;
  target: number;
};

/**
 * The milestone a challenge is CURRENTLY at, or null if it has not reached
 * one.
 *
 * One per challenge, not one per tier crossed. Somebody who logs a backlog
 * and jumps straight from nothing to Gold should be told they got Gold —
 * three banners climbing the ladder they skipped would bury the real news.
 */
export function currentMilestone(c: Challenge): Unlock | null {
  const base = { challengeId: c.id, title: c.title, earned: c.earned, target: c.target };
  if (c.tiered) {
    return c.tier ? { ...base, key: `${c.id}@${c.tier.name}`, tier: c.tier.name } : null;
  }
  return c.complete ? { ...base, key: `${c.id}@earned`, tier: null } : null;
}

type AchievementsValue = {
  /** Reached but not yet looked at. Drives the tab badge. */
  unseen: Unlock[];
  /** Waiting to be celebrated. The banner shows `queue[0]`. */
  queue: Unlock[];
  /** Dismiss the banner currently showing. */
  dismiss: () => void;
  /** Called by the Passport: everything reached is now acknowledged. */
  markAllSeen: () => void;
};

const AchievementsContext = createContext<AchievementsValue | null>(null);

export function AchievementsProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { loading, challenges } = usePassport();

  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [queue, setQueue] = useState<Unlock[]>([]);

  /**
   * Milestones present at the previous computation this session, so the
   * banner fires on a change rather than on a state. Null until seeded.
   */
  const known = useRef<Set<string> | null>(null);

  const current = useMemo(
    () => (loading ? [] : challenges.map(currentMilestone).filter((m): m is Unlock => m !== null)),
    [loading, challenges],
  );

  // Load the acknowledged set once.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const raw = await getSetting(db, SEEN_KEY);
      if (!alive) return;
      let stored: string[] = [];
      try {
        const parsed: unknown = JSON.parse(raw ?? '[]');
        if (Array.isArray(parsed)) stored = parsed as string[];
      } catch {
        stored = [];
      }
      setSeen(new Set(stored));
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  const persist = useCallback(
    (next: Set<string>) => {
      setSeen(next);
      void setSetting(db, SEEN_KEY, JSON.stringify([...next])).catch(() => {
        // A failed write costs a repeated badge, not data. Not worth a report.
      });
    },
    [db],
  );

  /**
   * Seed, then diff.
   *
   * The first computation after the store loads establishes the baseline and
   * celebrates nothing. Without that, onboarding — which backfills twenty-odd
   * visits in one go — would open the app on a stack of banners for
   * achievements the user did not just earn, and a device pulling a synced
   * account's history would celebrate meals eaten years ago.
   */
  useEffect(() => {
    if (seen === null || loading) return;
    const keys = new Set(current.map((m) => m.key));

    if (known.current === null) {
      known.current = keys;
      // A brand-new install has never stored anything. Everything reached at
      // this point predates the feature, so acknowledge it silently.
      if (seen.size === 0 && keys.size > 0) persist(keys);
      return;
    }

    const fresh = current.filter((m) => !known.current?.has(m.key));
    known.current = keys;
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [current, seen, loading, persist]);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  const markAllSeen = useCallback(() => {
    if (seen === null) return;
    const keys = current.map((m) => m.key);
    if (keys.every((k) => seen.has(k))) return;
    persist(new Set([...seen, ...keys]));
  }, [current, seen, persist]);

  const unseen = useMemo(
    () => (seen === null ? [] : current.filter((m) => !seen.has(m.key))),
    [current, seen],
  );

  const value = useMemo<AchievementsValue>(
    () => ({ unseen, queue, dismiss, markAllSeen }),
    [unseen, queue, dismiss, markAllSeen],
  );

  return (
    <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>
  );
}

export function useAchievements(): AchievementsValue {
  const ctx = useContext(AchievementsContext);
  if (!ctx) throw new Error('useAchievements must be used inside <AchievementsProvider>');
  return ctx;
}
