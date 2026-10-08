import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * The catalog data layer.
 *
 * Everything that reads venues goes through this hook, so the SOURCE can
 * change without touching a single screen. Today it fetches from Supabase.
 * When the offline layer lands, this becomes a read from on-device SQLite with
 * background sync — park wifi is bad enough that logging a meal must not
 * depend on having bars — and the screens will not know the difference.
 */

/** The columns a list row actually needs. Fetching all 28 wastes bandwidth. */
const LIST_COLUMNS =
  'id, name, area_id, sub_area, resort_id, venue_kind, service_type, ' +
  'cuisine, price_tier, is_signature, status, lat, lng';

export type VenueListItem = {
  id: string;
  name: string;
  area_id: string;
  sub_area: string | null;
  resort_id: string | null;
  venue_kind: string;
  service_type: string[];
  cuisine: string | null;
  price_tier: number;
  is_signature: boolean;
  status: string;
  lat: number | null;
  lng: number | null;
};

export type Area = { id: string; name: string; kind: string };

type State<T> = {
  data: T;
  loading: boolean;
  /** User-facing message, already phrased for display. Null when fine. */
  error: string | null;
};

function message(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // Supabase surfaces offline as a bare "Network request failed", which tells
  // a user in a dead zone nothing useful.
  if (/network|fetch/i.test(raw)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return raw;
}

export function useVenues() {
  const [state, setState] = useState<State<VenueListItem[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from('venues')
        .select(LIST_COLUMNS)
        .neq('status', 'permanently-closed')
        .order('name');

      if (error) throw new Error(error.message);
      // supabase-js can only infer row types from a select string it can see
      // literally; LIST_COLUMNS is a variable, so it falls back to a generic
      // type and the cast has to go through unknown.
      setState({ data: (data ?? []) as unknown as VenueListItem[], loading: false, error: null });
    } catch (e) {
      setState({ data: [], loading: false, error: message(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}

export function useAreas() {
  const [state, setState] = useState<State<Area[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, name, kind')
        .order('name');
      if (cancelled) return;
      setState({
        data: (data ?? []) as Area[],
        loading: false,
        error: error ? message(new Error(error.message)) : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Filters in memory rather than re-querying.
 *
 * The whole catalog is ~400 rows and already loaded, so a round trip per
 * keystroke would be slower and would break the moment the device is offline.
 */
export function useFilteredVenues(
  venues: VenueListItem[],
  { search, areaId }: { search: string; areaId: string | null },
) {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    return venues.filter((v) => {
      if (areaId && v.area_id !== areaId) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.cuisine ?? '').toLowerCase().includes(q)
      );
    });
  }, [venues, search, areaId]);
}
