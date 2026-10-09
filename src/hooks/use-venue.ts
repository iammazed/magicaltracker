import { useMemo } from 'react';

import { useCatalog } from '@/hooks/use-catalog';
import type { CatalogVenue } from '@/lib/catalog-db';

/**
 * One venue, for the detail screen.
 *
 * This used to be three Supabase round trips — the venue, then its area name,
 * then its resort name — which meant opening a restaurant in a dead zone
 * showed an error. Everything it needs is in the on-device catalog, so the
 * screen now resolves synchronously from data already in memory.
 */

export type VenueDetail = CatalogVenue;

export type VenueContext = {
  areaName: string | null;
  resortName: string | null;
};

export function useVenue(id: string | undefined) {
  const { venues, areas, resorts, loading } = useCatalog();

  const venue = useMemo(
    () => (id ? venues.find((v) => v.id === id) ?? null : null),
    [venues, id],
  );

  const context = useMemo<VenueContext>(() => {
    if (!venue) return { areaName: null, resortName: null };
    return {
      areaName: areas.find((a) => a.id === venue.area_id)?.name ?? null,
      resortName: venue.resort_id
        ? resorts.find((r) => r.id === venue.resort_id)?.name ?? null
        : null,
    };
  }, [venue, areas, resorts]);

  // A missing venue after loading is a genuine error — a stale link, or an id
  // that left the catalog in a refresh.
  const error = !loading && id && !venue ? 'That place is no longer in the catalog.' : null;

  return { venue, context, loading, error };
}

/** The five meal-period menus, in the order a day happens. */
export function menuLinks(v: VenueDetail): { label: string; url: string }[] {
  const all: { label: string; url: string | null }[] = [
    { label: 'Breakfast', url: v.breakfast_menu_url },
    { label: 'Lunch', url: v.lunch_menu_url },
    { label: 'Dinner', url: v.dinner_menu_url },
    { label: 'Snacks', url: v.snack_menu_url },
    { label: 'Lounge', url: v.lounge_menu_url },
  ];
  return all.filter((m): m is { label: string; url: string } => Boolean(m.url));
}
