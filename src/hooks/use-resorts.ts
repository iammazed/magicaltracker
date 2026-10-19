import { useMemo } from 'react';

import { useCatalog } from '@/hooks/use-catalog';
import type { CatalogResort } from '@/lib/catalog-db';

/**
 * The resort half of the catalog. Mirrors `use-venues` deliberately — same
 * shape, same in-memory filtering, and the same read from the on-device
 * catalog rather than from Supabase.
 */

export type Resort = CatalogResort;

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

/**
 * A failed background refresh is NOT a load error, and the difference matters
 * in a local-first app.
 *
 * `refreshError` is only ever surfaced when there is nothing to show. With the
 * catalog already in SQLite, a server that cannot be reached is a non-event —
 * the screens have every row they need. Handing the refresh error straight to
 * screens meant Resorts rendered a full-page "Could not load resorts" over 35
 * resorts it was holding, and `useResort` inherited it so every resort detail
 * screen did the same.
 *
 * Gating it here rather than in each screen is deliberate: a screen that
 * forgets the `length === 0` check cannot reintroduce the bug, because the hook
 * no longer has an error to give it. Settings reads `useCatalog()` directly
 * when it wants to report staleness.
 */
export function useResorts() {
  const { resorts, loading, refreshError } = useCatalog();
  return {
    data: resorts,
    loading,
    error: resorts.length === 0 ? refreshError : null,
  };
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
