import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  todayISO,
  type DayKind,
  type Trip,
  type TripDay,
  type TripPlan,
} from '@/lib/local-db';

/**
 * Trips and the planning list.
 *
 * A trip is the spine of the app: it is what a countdown counts down to, what
 * a visit gets attributed to, and what someone opens the app for in the
 * eleven months when they are not at a park.
 *
 * `trip_plans` is deliberately separate from `visits`. A plan is somewhere you
 * INTEND to go; a visit is somewhere you went. Collapsing them would mean
 * either the passport counts places you never ate at, or the planning list
 * disappears the moment you log the meal.
 *
 * A provider rather than a plain hook, for the same reason as `useVisits`:
 * per-screen useState means adding a venue to a trip refreshes one copy and
 * leaves every other screen stale.
 */

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Whole days from today until `date`. Negative once it has passed. */
export function daysUntil(date: string): number {
  const today = new Date(`${todayISO()}T00:00:00`);
  const then = new Date(`${date}T00:00:00`);
  return Math.round((then.getTime() - today.getTime()) / 86_400_000);
}

export type TripStatus = 'upcoming' | 'current' | 'past';

export function tripStatus(t: Trip): TripStatus {
  const today = todayISO();
  if (today < t.start_date) return 'upcoming';
  if (today > t.end_date) return 'past';
  return 'current';
}

/**
 * Every date from `start` to `end`, inclusive.
 *
 * `Date.UTC` throughout, like everything else that does date arithmetic here:
 * `new Date('2027-04-03')` parses as midnight UTC and renders in local time,
 * so west of Greenwich every day would come out as the one before.
 */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  let t = Date.UTC(ys, ms - 1, ds);
  const last = Date.UTC(ye, me - 1, de);
  // A guard, not an optimisation: a trip whose dates got swapped would
  // otherwise spin until the tab crashed.
  while (t <= last && out.length < 400) {
    const d = new Date(t);
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`,
    );
    t += 86_400_000;
  }
  return out;
}

function useTripsStore() {
  const db = useSQLiteContext();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [t, p, d] = await Promise.all([
      db.getAllAsync<Trip>('SELECT * FROM trips ORDER BY start_date ASC'),
      db.getAllAsync<TripPlan>('SELECT * FROM trip_plans ORDER BY created_at ASC'),
      db.getAllAsync<TripDay>('SELECT * FROM trip_days ORDER BY day ASC'),
    ]);
    setTrips(t);
    setPlans(p);
    setDays(d);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTrip = useCallback(
    async (input: {
      name: string;
      startDate: string;
      endDate: string;
      resortId?: string | null;
    }) => {
      const now = new Date().toISOString();
      const id = uuid();
      await db.runAsync(
        `INSERT INTO trips (id, name, start_date, end_date, resort_id, note,
                            created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
        id,
        input.name,
        input.startDate,
        input.endDate,
        input.resortId ?? null,
        now,
        now,
      );
      await refresh();
      return id;
    },
    [db, refresh],
  );

  const deleteTrip = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM trip_plans WHERE trip_id = ?', id);
      await db.runAsync('DELETE FROM trips WHERE id = ?', id);
      await refresh();
    },
    [db, refresh],
  );

  const setResort = useCallback(
    async (tripId: string, resortId: string | null) => {
      await db.runAsync(
        'UPDATE trips SET resort_id = ?, updated_at = ?, synced_at = NULL WHERE id = ?',
        resortId,
        new Date().toISOString(),
        tripId,
      );
      await refresh();
    },
    [db, refresh],
  );

  /** Idempotent — tapping "add to trip" twice should not create two rows. */
  const addPlan = useCallback(
    async (tripId: string, venueId: string) => {
      await db.runAsync(
        `INSERT OR IGNORE INTO trip_plans (id, trip_id, venue_id, booked, note,
                                           created_at, synced_at)
         VALUES (?, ?, ?, 0, NULL, ?, NULL)`,
        uuid(),
        tripId,
        venueId,
        new Date().toISOString(),
      );
      await refresh();
    },
    [db, refresh],
  );

  const removePlan = useCallback(
    async (tripId: string, venueId: string) => {
      await db.runAsync(
        'DELETE FROM trip_plans WHERE trip_id = ? AND venue_id = ?',
        tripId,
        venueId,
      );
      await refresh();
    },
    [db, refresh],
  );

  const toggleBooked = useCallback(
    async (id: string, booked: boolean) => {
      await db.runAsync(
        'UPDATE trip_plans SET booked = ?, synced_at = NULL WHERE id = ?',
        booked ? 1 : 0,
        id,
      );
      await refresh();
    },
    [db, refresh],
  );

  /** The trip the home screen leads with: one in progress beats the next one. */
  const activeTrip = useMemo(() => {
    const current = trips.find((t) => tripStatus(t) === 'current');
    if (current) return current;
    return trips.find((t) => tripStatus(t) === 'upcoming') ?? null;
  }, [trips]);

  const plansFor = useCallback(
    (tripId: string) => plans.filter((p) => p.trip_id === tripId),
    [plans],
  );

  /** Stored days for a trip, keyed by date for the screen to merge against
   *  the full range. Days with nothing decided have no row. */
  const daysFor = useCallback(
    (tripId: string) => {
      const map = new Map<string, TripDay>();
      for (const d of days) if (d.trip_id === tripId) map.set(d.day, d);
      return map;
    },
    [days],
  );

  /**
   * Writes one field of one day, creating the row if this is the first thing
   * decided about it.
   *
   * An upsert on `(trip_id, day)` rather than a read-then-insert-or-update:
   * two taps in quick succession on the same day would otherwise race, both
   * see no row, and both insert — which the unique index would reject and the
   * user would see as a tap that did nothing.
   *
   * `COALESCE(excluded.x, trip_days.x)` is wrong here and worth saying why:
   * clearing a park back to "not decided" is a real action, so a null has to
   * overwrite. Only the field being set is passed; the other keeps its stored
   * value through the explicit reference below.
   *
   * `areaId` and `kind` are mutually exclusive and enforced here rather than
   * trusted from the caller: a rest day is not in a park, and the server has
   * a CHECK constraint that will reject a row claiming both. Catching it at
   * the write means a bad combination fails now, in front of the person who
   * caused it, instead of silently never syncing.
   */
  const setDay = useCallback(
    async (
      tripId: string,
      day: string,
      patch: { areaId?: string | null; kind?: DayKind | null; note?: string | null },
    ) => {
      const now = new Date().toISOString();
      // Setting one side clears the other, so either field alone is enough to
      // change what a day is.
      const area = patch.areaId ?? null;
      const kind = area ? null : patch.kind ?? null;
      const hasArea = 'areaId' in patch || !!kind;
      const hasKind = 'kind' in patch || !!area;
      const hasNote = 'note' in patch;
      await db.runAsync(
        `INSERT INTO trip_days
           (id, trip_id, day, area_id, kind, note, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT (trip_id, day) DO UPDATE SET
           area_id    = ${hasArea ? 'excluded.area_id' : 'trip_days.area_id'},
           kind       = ${hasKind ? 'excluded.kind' : 'trip_days.kind'},
           note       = ${hasNote ? 'excluded.note' : 'trip_days.note'},
           updated_at = excluded.updated_at,
           -- Back to unsynced, so the next push sends the change. Forgetting
           -- this is the bug where an edit looks saved and never leaves.
           synced_at  = NULL`,
        uuid(),
        tripId,
        day,
        hasArea ? area : null,
        hasKind ? kind : null,
        hasNote ? patch.note ?? null : null,
        now,
        now,
      );
      await refresh();
    },
    [db, refresh],
  );

  return {
    trips,
    plans,
    days,
    loading,
    activeTrip,
    plansFor,
    daysFor,
    setDay,
    addTrip,
    deleteTrip,
    setResort,
    addPlan,
    removePlan,
    toggleBooked,
    refresh,
  };
}


type TripsValue = ReturnType<typeof useTripsStore>;

const TripsContext = createContext<TripsValue | null>(null);

export function TripsProvider({ children }: { children: React.ReactNode }) {
  const value = useTripsStore();
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsValue {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used inside <TripsProvider>');
  return ctx;
}
