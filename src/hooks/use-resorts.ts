import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * The resort half of the catalog. Mirrors `use-venues` deliberately — same
 * shape, same in-memory filtering, same future swap to on-device SQLite.
 */

export type Resort = {
  id: string;
  name: string;
  area_id: string;
  tier: string;
  transport: string[];
  transport_notes: string | null;
  ownership: string;
  lat: number | null;
  lng: number | null;
  official_url: string | null;
  description: string | null;
  status: string;
};

export const TIER_LABEL: Record<string, string> = {
  value: 'Value',
  moderate: 'Moderate',
  deluxe: 'Deluxe',
  villa: 'Villa',
  campground: 'Campground',
};

export const TRANSPORT_LABEL: Record<string, string> = {
  monorail: 'Monorail',
  skyliner: 'Skyliner',
  bus: 'Bus',
  boat: 'Boat',
  walk: 'Walk',
  shuttle: 'Shuttle',
};

export function useResorts() {
  const [data, setData] = useState<Resort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows, error: e } = await supabase
        .from('resorts')
        .select(
          'id, name, area_id, tier, transport, transport_notes, ownership, ' +
            'lat, lng, official_url, description, status',
        )
        .order('name');
      if (cancelled) return;
      if (e) {
        setError(
          /network|fetch/i.test(e.message)
            ? 'Could not reach the server. Check your connection and try again.'
            : e.message,
        );
      } else {
        setData((rows ?? []) as unknown as Resort[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

export function useResort(id: string | undefined) {
  const { data, loading, error } = useResorts();
  const resort = useMemo(() => data.find((r) => r.id === id) ?? null, [data, id]);
  return { resort, loading, error };
}

export function useFilteredResorts(
  resorts: Resort[],
  { search, tier }: { search: string; tier: string | null },
) {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    return resorts.filter((r) => {
      if (tier && r.tier !== tier) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q);
    });
  }, [resorts, search, tier]);
}
