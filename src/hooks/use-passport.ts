import { useMemo } from 'react';

import { useCatalog } from '@/hooks/use-catalog';
import { useResorts } from '@/hooks/use-resorts';
import { useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';
import { formatSubArea, titleCase } from '@/lib/labels';

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

/**
 * Medal colours, and they are literals on purpose: bronze is bronze in both
 * schemes, and a tier that changed colour with the OS would stop reading as a
 * medal. Defined here beside `TIERS` rather than in the Passport screen,
 * because the achievement banner needs the same four and two copies of a
 * colour map drift.
 */
export const TIER_COLOR: Record<string, string> = {
  Bronze: '#B08D57',
  Silver: '#A8B2BC',
  Gold: '#E5B45F',
  Platinum: '#8FD6D2',
};

/**
 * One line of a challenge's checklist.
 *
 * Challenges used to be a bar and a count, which said how far along you were
 * but never what was actually being counted — a Bronze in Disney Springs with
 * no way to find out which sixteen of the sixty-one you had been to. The cards
 * are tappable now, and this is what the detail screen renders.
 *
 * Most steps are one place, so `venueId` is set and tapping opens it. A World
 * Showcase pavilion is the exception: the step is the pavilion, several places
 * inside it would satisfy it, and there is no single venue to open — so
 * `venueId` is null and `options` carries them instead.
 */
export type ChallengeStep = {
  /** A venue id, or a World Showcase pavilion slug. */
  id: string;
  label: string;
  done: boolean;
  /** Where a tap goes, or null when more than one place satisfies this step. */
  venueId: string | null;
  /** The area, to tell two similarly named places apart. */
  where?: string;
  /** Pavilion steps only: the places that would tick this off. */
  options?: { id: string; name: string; done: boolean }[];
};

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
  /**
   * Everything the challenge counts, done and not. Present on all of them,
   * because the detail screen is reachable from every card.
   */
  steps: ChallengeStep[];
  /**
   * The names still missing, but ONLY where the set is short enough to read
   * inline on the card. Left undefined on the tiered challenges on purpose —
   * "Still to go" listing forty-five restaurants is the wall of text the
   * detail screen exists to replace.
   */
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

export function usePassport() {
  const { data: venues, loading: venuesLoading } = useVenues();
  const { data: resorts, loading: resortsLoading } = useResorts();
  const { byVenue, byResort } = useVisits();
  const { areas } = useCatalog();

  // The tag-driven challenges read `tags` and `sub_area`, which every catalog
  // row now carries. This used to be a second query because the list select
  // omitted those columns to save bandwidth.
  const tagRows = venues;

  const areaNames = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a.name])),
    [areas],
  );

  /** For naming a resort venue by its resort rather than its resort area. */
  const resortNames = useMemo(
    () => Object.fromEntries(resorts.map((r) => [r.id, r.name])),
    [resorts],
  );

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

    /**
     * One step per place, which is what all but the pavilion challenges want.
     *
     * `scope` decides the second line. A challenge spanning the property names
     * the area, because "Space 220" means nothing without "EPCOT"; a challenge
     * already scoped to one park names the LAND instead, since repeating "Magic
     * Kingdom" down forty rows says nothing while "Fantasyland" tells you
     * whether the walk is on your way.
     *
     * **A venue at a resort names the RESORT**, which is the fix for a list
     * that was technically complete and practically useless. The Monorail Bar
     * Crawl promises "Grand Floridian, Contemporary and Polynesian" and then
     * labelled all ten of its bars "MK Resorts" — the one thing you need to
     * know in order to plan the crawl was the thing it would not tell you,
     * because every one of them shares an area and none of them has a
     * `sub_area`. The same applies to signature dining, half of which is at
     * the resorts.
     */
    const venueSteps = (
      rows: typeof venues,
      scope: 'property' | 'area' = 'property',
    ): ChallengeStep[] =>
      rows.map((r) => ({
        id: r.id,
        label: r.name,
        done: visitedIds.has(r.id),
        venueId: r.id,
        where:
          scope === 'area'
            ? r.sub_area
              ? formatSubArea(r.sub_area)
              : undefined
            : r.resort_id
              ? resortNames[r.resort_id] ?? areaNames[r.area_id] ?? r.area_id
              : areaNames[r.area_id] ?? r.area_id,
      }));

    /** Pavilion challenges count PAVILIONS COVERED, not venues visited —
     *  a drink at either Mexico bar completes Mexico. */
    const pavilionChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge => {
      const inPavilion = new Map<string, typeof tagRows>();
      for (const r of tagRows) {
        if (!r.tags?.includes(tag) || !r.sub_area) continue;
        const list = inPavilion.get(r.sub_area) ?? [];
        list.push(r);
        inPavilion.set(r.sub_area, list);
      }

      // Mapped over WORLD_SHOWCASE rather than over what the catalog happens
      // to hold, so a pavilion with no tagged venue yet still shows up as a
      // step you cannot tick rather than silently shrinking the target.
      const steps: ChallengeStep[] = WORLD_SHOWCASE.map((p) => {
        const options = (inPavilion.get(p) ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          done: visitedIds.has(r.id),
        }));
        return {
          id: p,
          label: titleCase(p),
          done: options.some((o) => o.done),
          // One place in the pavilion is still a direct tap; several is a
          // choice, and picking one for the user would be guessing.
          venueId: options.length === 1 ? options[0].id : null,
          options,
        };
      });
      const missing = steps.filter((st) => !st.done);

      return {
        id,
        title,
        blurb,
        earned: steps.length - missing.length,
        target: steps.length,
        complete: missing.length === 0,
        tiered: false,
        tier: null,
        nextTier: null,
        toNext: 0,
        steps,
        remaining: missing.map((st) => st.label),
      };
    };

    /**
     * Every venue carrying a tag, all or nothing, naming what is left.
     *
     * Distinct from `tagChallenge`, which tiers. The same reasoning as the
     * pavilions: a short, closed set that people set out to COMPLETE is not
     * improved by a Bronze medal at a quarter of the way through, and nobody
     * claims a partial bar crawl. Tiers exist to make "4 of 61" survivable;
     * "4 of 10" is already a next step.
     *
     * `remaining` holds venue names rather than ids, because it is rendered
     * straight into "Still to go".
     */
    const setChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge => {
      // `tags` is string[] here, not the pipe-joined CSV form — `catalog-db`
      // parses the JSON column on the way out — so this is exact membership.
      const steps = venueSteps(tagRows.filter((r) => r.tags?.includes(tag)));
      const done = steps.filter((st) => st.done).length;
      return {
        id,
        title,
        blurb,
        earned: done,
        target: steps.length,
        complete: steps.length > 0 && done === steps.length,
        tiered: false,
        tier: null,
        nextTier: null,
        toNext: 0,
        steps,
        remaining: steps.filter((st) => !st.done).map((st) => st.label),
      };
    };

    const tagChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge => {
      const steps = venueSteps(tagRows.filter((r) => r.tags?.includes(tag)));
      const earned = steps.filter((st) => st.done).length;
      return {
        id,
        title,
        blurb,
        earned,
        target: steps.length,
        tiered: true,
        steps,
        ...tierProgress(earned, steps.length),
      };
    };

    // `byArea` carries the counts; the steps need the rows behind them, and
    // they come from `eligible` so the checklist and the denominator cannot
    // disagree about events and closed venues.
    const areaVenues = new Map<string, typeof eligible>();
    for (const v of eligible) {
      const list = areaVenues.get(v.area_id) ?? [];
      list.push(v);
      areaVenues.set(v.area_id, list);
    }

    const areaChallenges: Challenge[] = byArea.map((a) => ({
      id: `area-${a.id}`,
      title: a.label,
      blurb: `Every place to eat in ${a.label}.`,
      earned: a.visited,
      target: a.total,
      tiered: true,
      steps: venueSteps(areaVenues.get(a.id) ?? [], 'area'),
      ...tierProgress(a.visited, a.total),
    }));

    return [
      ...areaChallenges,
      setChallenge(
        'monorail-bar-crawl',
        'The Monorail Bar Crawl',
        'A drink at every bar on the monorail loop — Grand Floridian, Contemporary and Polynesian.',
        'monorail-bar-crawl',
      ),
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
  }, [tagRows, byVenue, byArea, eligible, areaNames, resortNames]);

  return {
    loading: venuesLoading || resortsLoading,
    overall,
    byArea,
    resortCoverage,
    challenges,
  };
}

/**
 * One challenge by id, for the detail screen.
 *
 * Deliberately the whole hook and a `find` rather than a narrower query. The
 * rules that decide what counts — events excluded, closed venues excluded,
 * pavilions counted by pavilion, tiers rounded up — are the thing that must
 * not fork, and a second implementation that reads the same tables is exactly
 * how a detail screen ends up disagreeing with the card that opened it.
 */
export function useChallenge(id: string | undefined) {
  const { challenges, loading } = usePassport();
  const challenge = useMemo(
    () => (id ? challenges.find((c) => c.id === id) ?? null : null),
    [challenges, id],
  );
  return { challenge, loading };
}
