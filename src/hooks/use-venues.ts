import { useMemo } from 'react';

import { useCatalog } from '@/hooks/use-catalog';
import type { CatalogArea, CatalogVenue } from '@/lib/catalog-db';

/**
 * The venue half of the catalog.
 *
 * This used to query Supabase on every mount. It now reads from the in-memory
 * catalog that `CatalogProvider` loaded out of SQLite, which is what makes the
 * app work in a dead zone — and the screens never knew the difference, which
 * is exactly what this indirection was for.
 */

export type VenueListItem = CatalogVenue;
export type Area = CatalogArea;

/** Kinds that are not a place you sit down to eat. Kept here because both the
 *  list filters and the map legend need the same answer. */
export const EVENT_KIND = 'event';

export function useVenues() {
  const { venues, loading, refreshing, refreshError, refresh } = useCatalog();

  // Permanently-closed venues stay in the catalog — the passport needs to know
  // they existed — but nobody browsing dinner wants to see them.
  const data = useMemo(
    () => venues.filter((v) => v.status !== 'permanently-closed'),
    [venues],
  );

  return { data, loading, refreshing, error: refreshError, reload: refresh };
}

export function useAreas() {
  const { areas, loading } = useCatalog();
  return { data: areas, loading, error: null as string | null };
}

export type VenueFilters = {
  search: string;
  areaId: string | null;
  /** `null` means every kind. `'event'` is how events are reached at all. */
  kind: string | null;
  serviceType: string | null;
  priceTiers: number[];
  reservationsOnly: boolean;
  characterOnly: boolean;
  signatureOnly: boolean;
  unvisitedOnly: boolean;
};

export const NO_FILTERS: VenueFilters = {
  search: '',
  areaId: null,
  kind: null,
  serviceType: null,
  priceTiers: [],
  reservationsOnly: false,
  characterOnly: false,
  signatureOnly: false,
  unvisitedOnly: false,
};

/** How many refinements are on, for the "Filters · 3" badge. Search and area
 *  are excluded: both have their own visible control on the screen. */
export function activeFilterCount(f: VenueFilters): number {
  return (
    (f.kind ? 1 : 0) +
    (f.serviceType ? 1 : 0) +
    (f.priceTiers.length ? 1 : 0) +
    (f.reservationsOnly ? 1 : 0) +
    (f.characterOnly ? 1 : 0) +
    (f.signatureOnly ? 1 : 0) +
    (f.unvisitedOnly ? 1 : 0)
  );
}

/**
 * Filters in memory rather than re-querying.
 *
 * The whole catalog is ~400 rows and already loaded, so a round trip per
 * keystroke would be slower and would break the moment the device is offline.
 */
export function useFilteredVenues(
  venues: VenueListItem[],
  filters: Partial<VenueFilters>,
  /** Venue ids the user has already logged. Only needed for `unvisitedOnly`. */
  visited?: Set<string> | Map<string, unknown>,
) {
  const f = { ...NO_FILTERS, ...filters };

  return useMemo(() => {
    const q = f.search.trim().toLowerCase();

    return venues.filter((v) => {
      if (f.areaId && v.area_id !== f.areaId) return false;

      // With no kind chosen, events are hidden. They are ticketed parties and
      // festivals, not somewhere you eat, so mixing 26 of them into a dinner
      // list is noise — but they are one chip away rather than unreachable.
      if (f.kind) {
        if (v.venue_kind !== f.kind) return false;
      } else if (v.venue_kind === EVENT_KIND) return false;

      if (f.serviceType && !v.service_type.includes(f.serviceType)) return false;
      if (f.priceTiers.length && !f.priceTiers.includes(v.price_tier)) return false;
      if (f.reservationsOnly && !v.reservations_recommended) return false;
      if (
        f.characterOnly &&
        !v.is_character_dinner_dining &&
        !v.is_character_breakfast_dining
      ) {
        return false;
      }
      if (f.signatureOnly && !v.is_signature) return false;
      if (f.unvisitedOnly && visited && hasVisit(visited, v.id)) return false;

      if (!q) return true;
      // Keywords are free-form search fodder — 'alcohol', 'bakery', a resort
      // nickname — so they are searchable but never read by the badge engine.
      return (
        v.name.toLowerCase().includes(q) ||
        (v.cuisine ?? '').toLowerCase().includes(q) ||
        (v.sub_area ?? '').toLowerCase().includes(q) ||
        v.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [
    venues,
    visited,
    f.search,
    f.areaId,
    f.kind,
    f.serviceType,
    f.priceTiers,
    f.reservationsOnly,
    f.characterOnly,
    f.signatureOnly,
    f.unvisitedOnly,
  ]);
}

function hasVisit(visited: Set<string> | Map<string, unknown>, id: string) {
  return visited.has(id);
}
