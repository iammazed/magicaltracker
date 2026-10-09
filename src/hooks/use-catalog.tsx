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

import {
  BUNDLE_VERSION,
  readCatalog,
  writeCatalog,
  type Catalog,
  type CatalogArea,
  type CatalogResort,
  type CatalogVenue,
} from '@/lib/catalog-db';
import { supabase } from '@/lib/supabase';

/**
 * The catalog, read once for the whole app.
 *
 * This is a provider rather than a hook for the same reason `useVisits` is:
 * each `useState` call makes its own state, so when `useVenues()` was a plain
 * hook, Home, Dining and the Passport each held a separate copy and each fired
 * its own request for all 394 rows on every mount. One store, every screen
 * subscribed, one read.
 *
 * Reads come from SQLite, which `onInit` has already seeded from the bundled
 * JSON. So there is no loading state worth showing and no empty list on a cold
 * start with no signal — the catalog is simply there.
 */

/** Don't re-download 500 KB of restaurants on every launch. */
const REFRESH_AFTER_HOURS = 24;

type CatalogValue = Catalog & {
  loading: boolean;
  /** Set only when a refresh fails. The catalog still works; this is for a
   *  quiet note, never an error screen. */
  refreshError: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

const EMPTY: Catalog = {
  areas: [],
  venues: [],
  resorts: [],
  version: BUNDLE_VERSION,
  source: 'bundle',
};

const CatalogContext = createContext<CatalogValue | null>(null);

const REMOTE_VENUE_COLUMNS =
  'id, name, area_id, sub_area, resort_id, venue_kind, service_type, ' +
  'dining_style, cuisine, price_tier, reservations_recommended, ' +
  'is_character_dinner_dining, is_character_breakfast_dining, is_signature, ' +
  'status, lat, lng, dinner_menu_url, lunch_menu_url, breakfast_menu_url, ' +
  'snack_menu_url, lounge_menu_url, description, tags, keywords';

const REMOTE_RESORT_COLUMNS =
  'id, name, area_id, tier, transport, transport_notes, ownership, lat, lng, ' +
  'official_url, description, status';

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [catalog, setCatalog] = useState<Catalog>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  /** Guards against a second refresh starting while one is in flight — two
   *  concurrent `writeCatalog` calls would fight over the same tables. */
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setCatalog(await readCatalog(db));
  }, [db]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const [venues, resorts, areas] = await Promise.all([
        supabase.from('venues').select(REMOTE_VENUE_COLUMNS).order('name'),
        supabase.from('resorts').select(REMOTE_RESORT_COLUMNS).order('name'),
        supabase.from('areas').select('id, name, kind'),
      ]);

      const failed = venues.error ?? resorts.error ?? areas.error;
      if (failed) throw new Error(failed.message);

      // A successful fetch that returns nothing is a signal something is wrong
      // upstream — an RLS policy, a bad filter — not an instruction to wipe
      // every restaurant off the user's device.
      if (!venues.data?.length || !resorts.data?.length || !areas.data?.length) {
        throw new Error('The server returned an empty catalog.');
      }

      await writeCatalog(
        db,
        {
          areas: areas.data as unknown as CatalogArea[],
          venues: venues.data as unknown as CatalogVenue[],
          resorts: resorts.data as unknown as CatalogResort[],
        },
        { version: BUNDLE_VERSION, source: 'remote' },
      );
      await load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setRefreshError(
        /network|fetch/i.test(raw)
          ? 'Could not reach the server, so this is the catalog from your last update.'
          : raw,
      );
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [db, load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await readCatalog(db);
      if (cancelled) return;
      setCatalog(fresh);
      setLoading(false);

      // Only now, with a usable catalog already on screen, consider the network.
      const written = await db.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM catalog_meta WHERE key = 'written_at'",
      );
      const age = written?.value
        ? (Date.now() - new Date(written.value).getTime()) / 3_600_000
        : Infinity;
      if (!cancelled && (fresh.source === 'bundle' || age > REFRESH_AFTER_HOURS)) {
        void refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, refresh]);

  const value = useMemo<CatalogValue>(
    () => ({ ...catalog, loading, refreshing, refreshError, refresh }),
    [catalog, loading, refreshing, refreshError, refresh],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside <CatalogProvider>');
  return ctx;
}
