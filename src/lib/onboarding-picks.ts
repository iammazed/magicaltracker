import type { CatalogVenue } from '@/lib/catalog-db';

/**
 * The venues onboarding asks about.
 *
 * The plan calls for "the 25 most popular restaurants", and there is no
 * popularity data yet — it arrives once visits sync and `venue_stats` has
 * something in it. So this is a **recognisability proxy** built only from flags
 * already verified in the catalog, rather than a list typed from memory. That
 * distinction matters: a hand-written list is exactly where a restaurant that
 * closed in 2019 gets in.
 *
 * Swap this for real counts when they exist. The shape of the answer does not
 * change.
 */

/**
 * Signature and character dining weigh most: those are the bookings people
 * plan a trip around and remember years later. Reservations-recommended is a
 * decent stand-in for demand. Table service breaks ties, because "have you
 * eaten here?" is a question about a meal, not a pretzel cart.
 */
function recognisability(v: CatalogVenue): number {
  return (
    (v.is_signature ? 3 : 0) +
    (v.is_character_dinner_dining || v.is_character_breakfast_dining ? 3 : 0) +
    (v.reservations_recommended ? 2 : 0) +
    (v.service_type.includes('table') ? 1 : 0)
  );
}

/**
 * Below this, a venue is not recognisable enough to be worth a tap.
 *
 * Without a floor, spreading picks across areas drags in whatever each area's
 * best candidate happens to be — which meant a pool bar at Blizzard Beach and
 * a resort sports bar sitting next to Cinderella's Royal Table.
 */
const MIN_SCORE = 5;

/** So one dense area cannot take over the whole list. */
const MAX_PER_AREA = 4;

export const ONBOARDING_TARGET = 24;

export function onboardingPicks(
  venues: CatalogVenue[],
  limit = ONBOARDING_TARGET,
): CatalogVenue[] {
  const ranked = venues
    .filter(
      (v) =>
        // Open, not an event, and not somewhere that no longer exists. Asking
        // "have you eaten at X?" about a closed restaurant is a bad first
        // impression even when the answer is yes.
        v.status === 'open' &&
        v.venue_kind !== 'event' &&
        recognisability(v) >= MIN_SCORE,
    )
    .map((v) => ({ v, score: recognisability(v) }))
    .sort((a, b) => b.score - a.score || a.v.name.localeCompare(b.v.name));

  // Round-robin by area, highest-scoring first within each, so the list spans
  // the property instead of being nine EPCOT restaurants.
  const byArea = new Map<string, CatalogVenue[]>();
  for (const { v } of ranked) {
    const bucket = byArea.get(v.area_id);
    if (bucket) bucket.push(v);
    else byArea.set(v.area_id, [v]);
  }

  const areas = [...byArea.keys()].sort(
    (a, b) => (byArea.get(b)?.length ?? 0) - (byArea.get(a)?.length ?? 0),
  );

  const picked: CatalogVenue[] = [];
  for (let round = 0; round < MAX_PER_AREA && picked.length < limit; round++) {
    for (const area of areas) {
      const candidate = byArea.get(area)?.[round];
      if (candidate) picked.push(candidate);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}
