import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { todayISO, type Visit } from '@/lib/local-db';

/**
 * The visit log, shared across the whole app.
 *
 * This is a provider rather than a plain hook for a reason: each call to
 * useState creates its OWN state, so a per-screen hook would mean the modal
 * saves a visit, refreshes its private copy, and the list and detail screens
 * behind it keep showing stale data. One store, every screen subscribed.
 *
 * Storage is on-device SQLite and visits sync to Supabase later. That ordering
 * is deliberate: forcing signup before anyone can log anything is the biggest
 * install-to-active killer, and a write that needs the network fails in
 * exactly the dead zones where people want to log a meal.
 */

/** A venue's rating is its MOST RECENT visit, not an average — someone's
 *  opinion after their fourth meal supersedes their first. */
export type VenueVisitSummary = { count: number; latest: Visit | null };

type VisitsValue = {
  visits: Visit[];
  byVenue: Map<string, VenueVisitSummary>;
  visitedCount: number;
  loading: boolean;
  addVisit: (input: AddVisitInput) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export type AddVisitInput = {
  venueId: string;
  visitedOn?: string;
  rating?: number | null;
  wouldReturn?: boolean | null;
  partySize?: number | null;
  note?: string | null;
};

const VisitsContext = createContext<VisitsValue | null>(null);

function uuid(): string {
  // Good enough for local row ids; the server assigns its own on sync.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function VisitsProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<Visit>(
      'SELECT * FROM visits ORDER BY visited_on DESC, created_at DESC',
    );
    setVisits(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addVisit = useCallback(
    async (input: AddVisitInput) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO visits
           (id, venue_id, visited_on, rating, would_return, party_size, note,
            created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        uuid(),
        input.venueId,
        input.visitedOn ?? todayISO(),
        input.rating ?? null,
        input.wouldReturn == null ? null : input.wouldReturn ? 1 : 0,
        input.partySize ?? null,
        input.note ?? null,
        now,
        now,
      );
      await refresh();
    },
    [db, refresh],
  );

  const deleteVisit = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM visits WHERE id = ?', id);
      await refresh();
    },
    [db, refresh],
  );

  /** venue_id -> { count, latest }. Built once per change, so a 394-row list
   *  does not run 394 lookups on every render. */
  const byVenue = useMemo(() => {
    const map = new Map<string, VenueVisitSummary>();
    for (const v of visits) {
      const cur = map.get(v.venue_id);
      // `visits` is already sorted newest first, so the first one wins.
      if (!cur) map.set(v.venue_id, { count: 1, latest: v });
      else cur.count += 1;
    }
    return map;
  }, [visits]);

  const value = useMemo<VisitsValue>(
    () => ({
      visits,
      byVenue,
      visitedCount: byVenue.size,
      loading,
      addVisit,
      deleteVisit,
      refresh,
    }),
    [visits, byVenue, loading, addVisit, deleteVisit, refresh],
  );

  return <VisitsContext.Provider value={value}>{children}</VisitsContext.Provider>;
}

export function useVisits(): VisitsValue {
  const ctx = useContext(VisitsContext);
  if (!ctx) throw new Error('useVisits must be used inside <VisitsProvider>');
  return ctx;
}

export function useVenueVisits(venueId: string) {
  const { visits, addVisit, deleteVisit } = useVisits();
  const forVenue = useMemo(
    () => visits.filter((v) => v.venue_id === venueId),
    [visits, venueId],
  );
  return { visits: forVenue, latest: forVenue[0] ?? null, addVisit, deleteVisit };
}
