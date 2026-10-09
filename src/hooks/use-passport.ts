import { useMemo } from 'react';

import { useResorts } from '@/hooks/use-resorts';
import { useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

/**
 * The passport.
 *
 * Two rules decide what the denominators are, and both exist so that 100% is
 * reachable by someone who tries:
 *
 *   - Events are excluded. A seasonal dessert party must not make a park
 *     uncompletable for anyone who visits in June.
 *   - Permanently closed venues are excluded. You cannot eat somewhere that
 *     no longer exists.
 *
 * Resort coverage counts only `disney-owned`. Shades of Green is restricted
 * to US military eligibility and the partner hotels are a different product;
 * including them would make the badge unreachable for reasons unrelated to
 * effort.
 */

export const WORLD_SHOWCASE = [
  'mexico', 'norway', 'china', 'germany', 'italy', 'american-adventure',
  'japan', 'morocco', 'france', 'united-kingdom', 'canada',
];

export type Coverage = {
  id: string;
  label: string;
  visited: number;
  total: number;
  pct: number;
};

/**
 * Large challenges are tiered so they do not read as one impossible number.
 * "4 of 61 in Disney Springs" is discouraging; "Bronze earned, 16 more for
 * Silver" is a next step.
 *
 * Pavilion challenges are deliberately NOT tiered — eleven countries is a
 * small, complete set, and a partial Drinking Around the World is not a
 * thing anyone would claim.
 */
export const TIERS = [
  { name: 'Bronze', at: 0.25 },
  { name: 'Silver', at: 0.5 },
  { name: 'Gold', at: 0.75 },
  { name: 'Platinum', at: 1 },
] as const;

export type Tier = (typeof TIERS)[number];

export type Challenge = {
  id: string;
  title: string;
  blurb: string;
  earned: number;
  target: number;
  complete: boolean;
  /** Tiered challenges show a medal and a next step; others are all-or-nothing. */
  tiered: boolean;
  /** Highest tier reached, or null below 25%. */
  tier: Tier | null;
  /** The next tier to aim at, or null once Platinum is earned. */
  nextTier: Tier | null;
  /** How many more visits to reach `nextTier`. */
  toNext: number;
  /** For pavilion challenges: which ones are still missing. */
  remaining?: string[];
};

/** The visit count a tier requires. Rounded up, so 25% of 30 is 8, not 7.5. */
export function tierTarget(tier: Tier, total: number): number {
  return Math.ceil(total * tier.at);
}

function tierProgress(earned: number, total: number) {
  if (total === 0) {
    return { tier: null, nextTier: null, toNext: 0, complete: false };
  }
  let tier: Tier | null = null;
  let nextTier: Tier | null = null;
  for (const t of TIERS) {
    if (earned >= tierTarget(t, total)) tier = t;
    else {
      nextTier = t;
      break;
    }
  }
  return {
    tier,
    nextTier,
    toNext: nextTier ? tierTarget(nextTier, total) - earned : 0,
    complete: earned >= total,
  };
}

/** venue_id -> tags / sub_area, needed for the tag-based challenges but not
 *  worth loading on the list screen. */
type TagRow = { id: string; tags: string[]; sub_area: string | null; area_id: string };

function useVenueTags() {
  const [rows, setRows] = useState<TagRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('venues')
        .select('id, tags, sub_area, area_id');
      if (!cancelled) setRows((data ?? []) as unknown as TagRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return rows;
}

export function usePassport() {
  const { data: venues, loading: venuesLoading } = useVenues();
  const { data: resorts, loading: resortsLoading } = useResorts();
  const { byVenue, byResort } = useVisits();
  const tagRows = useVenueTags();

  const [areaNames, setAreaNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('areas').select('id, name, kind');
      if (cancelled) return;
      const rows = (data ?? []) as { id: string; name: string; kind: string }[];
      setAreaNames(Object.fromEntries(rows.map((a) => [a.id, a.name])));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Only places you can actually eat at, and that still exist. */
  const eligible = useMemo(
    () => venues.filter((v) => v.venue_kind !== 'event' && v.status !== 'permanently-closed'),
    [venues],
  );

  const overall = useMemo<Coverage>(() => {
    const visited = eligible.filter((v) => byVenue.has(v.id)).length;
    return {
      id: 'overall',
      label: 'All dining',
      visited,
      total: eligible.length,
      pct: eligible.length ? visited / eligible.length : 0,
    };
  }, [eligible, byVenue]);

  const byArea = useMemo<Coverage[]>(() => {
    const groups = new Map<string, { visited: number; total: number }>();
    for (const v of eligible) {
      const g = groups.get(v.area_id) ?? { visited: 0, total: 0 };
      g.total += 1;
      if (byVenue.has(v.id)) g.visited += 1;
      groups.set(v.area_id, g);
    }
    return [...groups.entries()]
      .map(([id, g]) => ({
        id,
        label: areaNames[id] ?? id,
        visited: g.visited,
        total: g.total,
        pct: g.total ? g.visited / g.total : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [eligible, byVenue, areaNames]);

  const resortCoverage = useMemo<Coverage>(() => {
    const own = resorts.filter((r) => r.ownership === 'disney-owned');
    const visited = own.filter((r) => byResort.has(r.id)).length;
    return {
      id: 'resorts',
      label: 'Disney resorts',
      visited,
      total: own.length,
      pct: own.length ? visited / own.length : 0,
    };
  }, [resorts, byResort]);

  const challenges = useMemo<Challenge[]>(() => {
    const visitedIds = new Set(byVenue.keys());

    /** Pavilion challenges count PAVILIONS COVERED, not venues visited —
     *  a drink at either Mexico bar completes Mexico. */
    const pavilionChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge => {
      const covered = new Set(
        tagRows
          .filter((r) => r.tags?.includes(tag) && visitedIds.has(r.id) && r.sub_area)
          .map((r) => r.sub_area as string),
      );
      const remaining = WORLD_SHOWCASE.filter((p) => !covered.has(p));
      return {
        id,
        title,
        blurb,
        earned: WORLD_SHOWCASE.length - remaining.length,
        target: WORLD_SHOWCASE.length,
        complete: remaining.length === 0,
        tiered: false,
        tier: null,
        nextTier: null,
        toNext: 0,
        remaining,
      };
    };

    const tagChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge => {
      const all = tagRows.filter((r) => r.tags?.includes(tag));
      const earned = all.filter((r) => visitedIds.has(r.id)).length;
      return {
        id,
        title,
        blurb,
        earned,
        target: all.length,
        tiered: true,
        ...tierProgress(earned, all.length),
      };
    };

    const areaChallenges: Challenge[] = byArea.map((a) => ({
      id: `area-${a.id}`,
      title: a.label,
      blurb: `Eat your way through ${a.label}.`,
      earned: a.visited,
      target: a.total,
      tiered: true,
      ...tierProgress(a.visited, a.total),
    }));

    return [
      ...areaChallenges,
      pavilionChallenge(
        'drinking-around-the-world',
        'Drinking Around the World',
        'A drink in each of the eleven World Showcase pavilions.',
        'world-showcase-bar',
      ),
      pavilionChallenge(
        'snacking-around-the-world',
        'Snacking Around the World',
        'A snack in each of the eleven World Showcase pavilions.',
        'world-showcase-snack',
      ),
      tagChallenge(
        'character-dining',
        'Character Dining',
        'Every character dining experience on property.',
        'character-dining',
      ),
      tagChallenge(
        'signature-dining',
        'Signature Dining',
        'Every signature restaurant at Walt Disney World.',
        'signature',
      ),
    ];
  }, [tagRows, byVenue, byArea]);

  return {
    loading: venuesLoading || resortsLoading,
    overall,
    byArea,
    resortCoverage,
    challenges,
  };
}
