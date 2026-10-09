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

export function useResorts() {
  const { resorts, loading, refreshError } = useCatalog();
  return { data: resorts, loading, error: refreshError };
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
