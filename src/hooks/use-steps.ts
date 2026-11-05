import { Pedometer } from 'expo-sensors';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { todayISO, type StepDay } from '@/lib/local-db';

/**
 * Steps, rolled out of the sensor into SQLite before iOS forgets them.
 *
 * ## Why this is a rollup and not a read
 *
 * CMPedometer keeps **seven days**. Ask it about the trip you took last month
 * and it returns nothing — not an error, just no data. So "how far did we walk
 * at Magic Kingdom in October" is not a question the sensor can ever answer;
 * it is a question that can only be answered by something that was copying the
 * totals down at the time. That is this hook, and it is why the step table has
 * no business being derived on demand.
 *
 * The rollup runs on mount and on every return to the foreground, re-reading
 * the whole seven-day window rather than just today. Someone who opens the app
 * once a week still gets all seven days; someone who leaves it closed for ten
 * loses the first three, and nothing can recover them. That gap is real and is
 * documented rather than hidden.
 *
 * ## Distance is deliberately absent
 *
 * `getStepCountAsync` returns steps only. Distance would have to come from
 * `CMPedometer`'s own estimate, which is derived from stride length the phone
 * guesses from height — wrong by a wide margin for most people and impossible
 * to correct. A step count is a number someone can trust; "4.2 miles" invites
 * an argument the app cannot win.
 */
export type StepsValue = {
  /** False until the first rollup has settled, so the UI can avoid flashing a
   *  zero before the real number arrives. */
  ready: boolean;
  /** iOS without motion hardware, a simulator, or Android without Health
   *  Connect. Nothing below is meaningful when this is false. */
  available: boolean;
  /** Undetermined until asked. Denied is a final state the UI must handle:
   *  only Settings can undo it, so there is no point asking twice. */
  permission: 'granted' | 'denied' | 'undetermined';
  /** Today's steps, or null when unknown. */
  today: number | null;
  /** Everything stored, newest first. */
  byDay: StepDay[];
  /** Total across an inclusive local-date range — a trip, usually. */
  totalBetween: (fromISO: string, toISO: string) => number;
  /** Asks for motion access, then rolls up if it was granted. */
  request: () => Promise<boolean>;
  /** Re-reads the sensor window and re-reads the table. */
  refresh: () => Promise<void>;
};

/** The seven local day-keys the sensor can still answer for, oldest first. */
function sensorWindow(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let back = 6; back >= 0; back -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`,
    );
  }
  return days;
}

/** Local midnight to local midnight. `end` is clamped to now for today, because
 *  asking a sensor about the rest of the afternoon is asking about the future. */
function boundsOf(day: string): { start: Date; end: Date } {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const midnight = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const now = new Date();
  return { start, end: midnight > now ? now : midnight };
}

export function useSteps(): StepsValue {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [permission, setPermission] =
    useState<StepsValue['permission']>('undetermined');
  const [byDay, setByDay] = useState<StepDay[]>([]);

  const read = useCallback(async () => {
    const rows = await db.getAllAsync<StepDay>(
      'SELECT day, steps FROM step_days ORDER BY day DESC',
    );
    setByDay(rows);
  }, [db]);

  /**
   * Copy the sensor's seven days into the table.
   *
   * Each day is written with `MAX(existing, incoming)` rather than overwritten.
   * A past day's total is stable, so re-reading it should be a no-op — but if
   * motion access is revoked, or the phone was restored from a backup, the
   * sensor answers 0 for days that really had 12,000 steps, and a plain
   * overwrite would quietly destroy the only copy. MAX cannot lose data; the
   * worst it can do is keep a number that is too high, which is recoverable
   * and visible, whereas a zeroed trip is neither.
   *
   * Failures are per-day on purpose. A range the sensor refuses (the oldest
   * day drifting past the seven-day edge mid-run is the likely one) should cost
   * that day, not the six that would have come after it.
   */
  const rollUp = useCallback(async () => {
    const now = new Date().toISOString();
    for (const day of sensorWindow()) {
      const { start, end } = boundsOf(day);
      if (end <= start) continue;
      try {
        const { steps } = await Pedometer.getStepCountAsync(start, end);
        if (!Number.isFinite(steps) || steps < 0) continue;
        await db.runAsync(
          `INSERT INTO step_days (day, steps, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (day) DO UPDATE SET
             steps = MAX(step_days.steps, excluded.steps),
             updated_at = excluded.updated_at`,
          [day, Math.round(steps), now],
        );
      } catch {
        // Expected for a day the sensor no longer covers. Not worth reporting:
        // there is nothing the user could do about it and nothing broken.
      }
    }
    await read();
  }, [db, read]);

  const refresh = useCallback(async () => {
    if (!(await Pedometer.isAvailableAsync())) {
      setAvailable(false);
      setReady(true);
      return;
    }
    setAvailable(true);
    const perm = await Pedometer.getPermissionsAsync();
    const state = perm.granted
      ? 'granted'
      : perm.canAskAgain
        ? 'undetermined'
        : 'denied';
    setPermission(state);
    if (state === 'granted') await rollUp();
    else await read();
    setReady(true);
  }, [rollUp, read]);

  const request = useCallback(async () => {
    const perm = await Pedometer.requestPermissionsAsync();
    setPermission(perm.granted ? 'granted' : perm.canAskAgain ? 'undetermined' : 'denied');
    if (perm.granted) await rollUp();
    return perm.granted;
  }, [rollUp]);

  useEffect(() => {
    void refresh();
    // Returning to the foreground is the only reliable moment to roll up: the
    // app cannot read the sensor while suspended, so every gap closes here or
    // not at all.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const totalBetween = useCallback(
    (fromISO: string, toISO: string) =>
      byDay.reduce(
        (sum, row) => (row.day >= fromISO && row.day <= toISO ? sum + row.steps : sum),
        0,
      ),
    [byDay],
  );

  const today = useMemo(() => {
    const key = todayISO();
    return byDay.find((r) => r.day === key)?.steps ?? null;
  }, [byDay]);

  return {
    ready,
    available,
    permission,
    today,
    byDay,
    totalBetween,
    request,
    refresh,
  };
}
