import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { todayISO, type Trip, type TripPlan } from '@/lib/local-db';

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

function useTripsStore() {
  const db = useSQLiteContext();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [t, p] = await Promise.all([
      db.getAllAsync<Trip>('SELECT * FROM trips ORDER BY start_date ASC'),
      db.getAllAsync<TripPlan>('SELECT * FROM trip_plans ORDER BY created_at ASC'),
    ]);
    setTrips(t);
    setPlans(p);
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

  return {
    trips,
    plans,
    loading,
    activeTrip,
    plansFor,
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
