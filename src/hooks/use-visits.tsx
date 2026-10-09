import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { todayISO, type Stay, type Visit } from '@/lib/local-db';

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
  stays: Stay[];
  byResort: Map<string, { count: number; latest: Stay | null }>;
  stayedCount: number;
  loading: boolean;
  addVisit: (input: AddVisitInput) => Promise<void>;
  /** Bulk backfill for onboarding. Returns how many were new. */
  addVisitsBulk: (
    venueIds: string[],
    options?: { dateExact?: boolean },
  ) => Promise<number>;
  deleteVisit: (id: string) => Promise<void>;
  addStay: (input: AddStayInput) => Promise<void>;
  deleteStay: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export type AddStayInput = {
  resortId: string;
  checkIn?: string;
  checkOut?: string | null;
  rating?: number | null;
  roomType?: string | null;
  note?: string | null;
};

export type AddVisitInput = {
  venueId: string;
  visitedOn?: string;
  rating?: number | null;
  wouldReturn?: boolean | null;
  partySize?: number | null;
  /** Premium. Stored as a JSON array. */
  dishes?: string[] | null;
  /** Premium. Local file URIs, stored as a JSON array. */
  photos?: string[] | null;
  /** False for an onboarding backfill, where the date is a placeholder. */
  dateExact?: boolean;
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
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [v, s] = await Promise.all([
      db.getAllAsync<Visit>(
        'SELECT * FROM visits ORDER BY visited_on DESC, created_at DESC',
      ),
      db.getAllAsync<Stay>(
        'SELECT * FROM stays ORDER BY check_in DESC, created_at DESC',
      ),
    ]);
    setVisits(v);
    setStays(s);
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
            dishes, photos, date_exact, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        uuid(),
        input.venueId,
        input.visitedOn ?? todayISO(),
        input.rating ?? null,
        input.wouldReturn == null ? null : input.wouldReturn ? 1 : 0,
        input.partySize ?? null,
        input.note ?? null,
        input.dishes?.length ? JSON.stringify(input.dishes) : null,
        input.photos?.length ? JSON.stringify(input.photos) : null,
        input.dateExact === false ? 0 : 1,
        now,
        now,
      );
      await refresh();
    },
    [db, refresh],
  );

  /**
   * Onboarding writes 20-odd visits at once.
   *
   * One transaction and one prepared statement, then a single refresh — the
   * alternative is 20 separate `addVisit` calls, each re-reading the whole
   * visit table and re-rendering every subscribed screen.
   *
   * Venues the user has already logged are skipped rather than duplicated,
   * which matters because onboarding can be re-run from Settings.
   */
  const addVisitsBulk = useCallback(
    async (venueIds: string[], { dateExact = false }: { dateExact?: boolean } = {}) => {
      // Asked of the database rather than of `byVenue`, both because that
      // state is declared further down this file and because a query cannot be
      // stale. Multiple visits per venue are legal, so there is no unique
      // constraint to lean on here.
      const existing = await db.getAllAsync<{ venue_id: string }>(
        'SELECT DISTINCT venue_id FROM visits',
      );
      const already = new Set(existing.map((r) => r.venue_id));
      const fresh = venueIds.filter((id) => !already.has(id));
      if (!fresh.length) return 0;

      const now = new Date().toISOString();
      const stmt = await db.prepareAsync(
        `INSERT INTO visits
           (id, venue_id, visited_on, rating, would_return, party_size, note,
            dishes, photos, date_exact, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, NULL)`,
      );
      try {
        await db.withTransactionAsync(async () => {
          for (const venueId of fresh) {
            await stmt.executeAsync([
              uuid(),
              venueId,
              todayISO(),
              dateExact ? 1 : 0,
              now,
              now,
            ]);
          }
        });
      } finally {
        await stmt.finalizeAsync();
      }
      await refresh();
      return fresh.length;
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

  const addStay = useCallback(
    async (input: AddStayInput) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO stays
           (id, resort_id, check_in, check_out, rating, room_type, note,
            created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        uuid(),
        input.resortId,
        input.checkIn ?? todayISO(),
        input.checkOut ?? null,
        input.rating ?? null,
        input.roomType ?? null,
        input.note ?? null,
        now,
        now,
      );
      await refresh();
    },
    [db, refresh],
  );

  const deleteStay = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM stays WHERE id = ?', id);
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

  const byResort = useMemo(() => {
    const map = new Map<string, { count: number; latest: Stay | null }>();
    for (const s of stays) {
      const cur = map.get(s.resort_id);
      if (!cur) map.set(s.resort_id, { count: 1, latest: s });
      else cur.count += 1;
    }
    return map;
  }, [stays]);

  const value = useMemo<VisitsValue>(
    () => ({
      visits,
      byVenue,
      visitedCount: byVenue.size,
      stays,
      byResort,
      stayedCount: byResort.size,
      loading,
      addVisit,
      addVisitsBulk,
      deleteVisit,
      addStay,
      deleteStay,
      refresh,
    }),
    [visits, byVenue, stays, byResort, loading, addVisit, addVisitsBulk, deleteVisit,
     addStay, deleteStay, refresh],
  );

  return <VisitsContext.Provider value={value}>{children}</VisitsContext.Provider>;
}

export function useVisits(): VisitsValue {
  const ctx = useContext(VisitsContext);
  if (!ctx) throw new Error('useVisits must be used inside <VisitsProvider>');
  return ctx;
}

export function useResortStays(resortId: string) {
  const { stays, addStay, deleteStay } = useVisits();
  const forResort = useMemo(
    () => stays.filter((s) => s.resort_id === resortId),
    [stays, resortId],
  );
  return { stays: forResort, latest: forResort[0] ?? null, addStay, deleteStay };
}

export function useVenueVisits(venueId: string) {
  const { visits, addVisit, deleteVisit } = useVisits();
  const forVenue = useMemo(
    () => visits.filter((v) => v.venue_id === venueId),
    [visits, venueId],
  );
  return { visits: forVenue, latest: forVenue[0] ?? null, addVisit, deleteVisit };
}
