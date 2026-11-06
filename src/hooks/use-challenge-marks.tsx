import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ChallengeMark } from '@/lib/local-db';

/**
 * The quest steps someone ticked by hand.
 *
 * ## Why any of this exists
 *
 * Every other stamp in the passport is DERIVED. A stamp is the shadow of a
 * meal or a night already in the log, so there is nothing to store and nothing
 * to tick — you log the dinner and the stamp follows. That is the right design
 * for everything the app can observe, and it is why the passport has never had
 * a checkbox in it.
 *
 * The quests are the exception, and each one fails differently:
 *
 *   - **Four Parks, One Day** is scored off MEALS in four parks on one date.
 *     Park hopping is a thing you do with your feet; a day spent riding rides
 *     in all four parks and eating nothing counts for nothing.
 *   - **The Transportation Challenge** infers a mode of transport from a
 *     resort you ate or slept at. But the monorail runs between Magic Kingdom
 *     and EPCOT, the Skyliner stops at two parks, and the ferry needs no
 *     resort at all — so the most obvious ways to ride each of them are
 *     exactly the ones it cannot see.
 *   - **Under the Fireworks** counts reserved views, because a dessert party
 *     is a catalog row and standing on Main Street is not. Nobody pays to
 *     watch fireworks.
 *   - **All Year Round** reads the dates on the log, which is close — but a
 *     day trip with no meal and no hotel leaves no date behind.
 *
 * In each case the app is not WRONG about what it saw; it simply cannot see
 * the thing being asked about. A manual tick is the only honest answer, and
 * pretending otherwise would mean four stamps that quietly under-report
 * forever.
 *
 * ## Additive only
 *
 * A mark can ADD a tick the log did not earn. It can never remove one the log
 * did. There is no "not done" row and no override: un-ticking is a delete,
 * which drops the step back to whatever the log says.
 *
 * That asymmetry is the safety property, and it is worth stating exactly what
 * it does and does not promise.
 *
 * It DOES guarantee that nothing the log earned can be taken away by a tap.
 * A step backed by a logged meal is not even tappable, so there is no sequence
 * of taps that un-earns a stamp the log is holding up. It also makes a mark
 * placed before a meal was logged harmless: the step was already done, and the
 * row sits there agreeing.
 *
 * It does NOT mean a stamp can never be lost. Un-ticking a mark that was
 * carrying a stamp on its own drops that stamp back to incomplete — which is
 * correct, because retracting a claim should retract what the claim earned.
 * The celebration does not fire a second time if it is re-ticked:
 * `achievements_seen` only ever grows, so the milestone key stays
 * acknowledged.
 *
 * ## Shape
 *
 * One row per ticked step, keyed by challenge and step together, and carrying
 * NOTHING else — no date, no place, no note. The step id is the whole claim.
 * "I rode the Skyliner" is the fact worth keeping; when, and from where, is a
 * trip diary this is not, and storing it would be collecting data no part of
 * the app reads.
 *
 * Marks sync, unlike step counts. This is the same kind of thing as a visit —
 * something a person entered about their own trip — so losing it to a
 * reinstall would be the same loss, and it gets the same backup.
 */

/**
 * The composite key, with a NUL between the halves.
 *
 * A step id can be an area slug, a transport mode, a month, a venue id or a
 * lower-cased cuisine name — and cuisine names contain spaces, so any
 * printable separator is one someone could in principle collide with. NUL
 * cannot appear in either half.
 */
export function markKey(challengeId: string, stepId: string): string {
  return `${challengeId}\u0000${stepId}`;
}

type MarksValue = {
  /** Every ticked step, as `markKey` strings. One object identity per change,
   *  so it is safe as a `useMemo` dependency. */
  marks: Set<string>;
  loading: boolean;
  /** Ticks a step, or un-ticks it if it was already marked. Returns the state
   *  it ended in, so a caller can fire a haptic for one and not the other. */
  toggle: (challengeId: string, stepId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const MarksContext = createContext<MarksValue | null>(null);

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function ChallengeMarksProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<ChallengeMark[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await db.getAllAsync<ChallengeMark>('SELECT * FROM challenge_marks');
    setRows(r);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const marks = useMemo(
    () => new Set(rows.map((r) => markKey(r.challenge_id, r.step_id))),
    [rows],
  );

  const toggle = useCallback(
    async (challengeId: string, stepId: string) => {
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM challenge_marks WHERE challenge_id = ? AND step_id = ?',
        challengeId,
        stepId,
      );

      if (existing) {
        await db.runAsync('DELETE FROM challenge_marks WHERE id = ?', existing.id);
        await refresh();
        return false;
      }

      const now = new Date().toISOString();
      /**
       * OR IGNORE against the unique index rather than trusting the SELECT
       * above. Two taps landing inside one another — a double tap on a slow
       * frame — would both read "no row" and both insert, and the second would
       * throw a constraint error into a button handler. Ignoring it means the
       * step is marked either way, which is what the tap asked for.
       */
      await db.runAsync(
        `INSERT OR IGNORE INTO challenge_marks
           (id, challenge_id, step_id, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        uuid(),
        challengeId,
        stepId,
        now,
        now,
      );
      await refresh();
      return true;
    },
    [db, refresh],
  );

  const value = useMemo(
    () => ({ marks, loading, toggle, refresh }),
    [marks, loading, toggle, refresh],
  );

  return <MarksContext.Provider value={value}>{children}</MarksContext.Provider>;
}

/**
 * Falls back to an empty, inert set rather than throwing.
 *
 * `usePassport` reads this, and the passport is rendered in places that have
 * no business knowing whether a provider is mounted — the achievement banner
 * among them. A missing provider showing the log-derived progress is the
 * correct degradation; marks are additive, so "none of them" is a valid
 * answer, not a broken one.
 */
const NONE: MarksValue = {
  marks: new Set(),
  loading: false,
  toggle: async () => false,
  refresh: async () => {},
};

export function useChallengeMarks(): MarksValue {
  // Module-level, not built per call: a fresh object here would be a new
  // identity on every render, and `usePassport` puts this straight into a
  // `useMemo` dependency list.
  return useContext(MarksContext) ?? NONE;
}
