/**
 * Catalog rows → `MapPlace`, for every screen that shows a map.
 *
 * `CatalogMap` deliberately knows nothing about venues or resorts, so each
 * caller maps its own rows. That was two call sites and two `useMemo`s, which
 * was fine; the "show on map" screen made it three, and three copies of
 * "which colour ramp and which two strings" is how a venue ends up labelled
 * one way on the Dining map and another on the screen you reach from a
 * restaurant.
 *
 * Plain functions rather than hooks: the callers already memoise, and a hook
 * here would force them to.
 */

import { AreaTone, TierTone } from '@/constants/theme';
import { formatCuisine, formatSubArea } from '@/lib/labels';
import type { MapPlace } from '@/components/catalog-map';
import type { Resort } from '@/hooks/use-resorts';
import { TIER_LABEL, TRANSPORT_LABEL } from '@/hooks/use-resorts';
import type { VenueListItem } from '@/hooks/use-venues';

/** `areaName` maps area id → display name; ids fall through unchanged when a
 *  venue references an area the catalog has not loaded. */
export function venuePlaces(
  venues: VenueListItem[],
  areaName: Record<string, string>,
): MapPlace[] {
  return venues.map((v) => ({
    id: v.id,
    name: v.name,
    lat: v.lat,
    lng: v.lng,
    tone: AreaTone[v.area_id] ?? 'brandTeal',
    line1:
      (areaName[v.area_id] ?? v.area_id) +
      (v.sub_area ? ` · ${formatSubArea(v.sub_area)}` : ''),
    line2: [formatCuisine(v.cuisine), '$'.repeat(Math.max(1, Math.min(4, v.price_tier)))]
      .filter(Boolean)
      .join('  ·  '),
  }));
}

export function resortPlaces(resorts: Resort[]): MapPlace[] {
  return resorts.map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    // TierTone, not AreaTone — a resort's colour is its tier, which is how it
    // is coloured on the list and on the trip screen too.
    tone: TierTone[r.tier] ?? 'brandTeal',
    line1:
      (TIER_LABEL[r.tier] ?? r.tier) +
      (r.ownership === 'partner' ? '  ·  Partner hotel' : ''),
    line2: r.transport.map((t) => TRANSPORT_LABEL[t] ?? t).join(', '),
  }));
}
