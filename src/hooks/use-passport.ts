import { useMemo } from 'react';

import { useCatalog } from '@/hooks/use-catalog';
import { markKey, useChallengeMarks } from '@/hooks/use-challenge-marks';
import { TIER_LABEL, TRANSPORT_LABEL, useResorts } from '@/hooks/use-resorts';
import { useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';
import { MONTH_LABELS, formatDate, parseISO } from '@/lib/calendar';
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

/**
 * The resorts around Crescent Lake, which is a real walk rather than a
 * marketing grouping: BoardWalk, Yacht and Beach Club, Swan, Dolphin and Swan
 * Reserve all share one promenade, so a crawl between them needs no bus.
 */
export const CRESCENT_LAKE = [
  'boardwalk-inn', 'yacht-club-resort', 'beach-club-resort',
  'swan-hotel', 'dolphin-hotel', 'swan-reserve',
];

/**
 * Catalog cuisine values that are not cuisines. `lounge` describes the room,
 * and `international` and `european` describe nothing in particular — a step
 * nobody can plan a meal around does not belong in a checklist.
 */
const NOT_A_CUISINE = new Set(['lounge', 'international', 'european']);

/**
 * The monorail resorts, grouped BY RESORT rather than by catalog row.
 *
 * Six rows carry `monorail`, because each of the three resorts has a DVC
 * half: Bay Lake Tower is the Contemporary, the Villas are the Grand
 * Floridian, the Bungalows are the Polynesian. The challenge people mean when
 * they say "the monorail resorts" is the three resorts, and scoring it over
 * six rows would quietly require buying into Disney Vacation Club — so a stay
 * at either half ticks the resort off, and both halves are listed as ways in.
 */
export const MONORAIL_RESORTS = [
  {
    id: 'grand-floridian',
    label: 'Grand Floridian',
    rows: ['grand-floridian-resort-and-spa', 'villas-at-grand-floridian-resort'],
  },
  {
    id: 'polynesian',
    label: 'Polynesian Village',
    rows: ['polynesian-village-resort', 'polynesian-villas-and-bungalows'],
  },
  {
    id: 'contemporary',
    label: 'Contemporary',
    rows: ['contemporary-resort', 'bay-lake-tower-contemporary-resort'],
  },
];

/** Resort tiers, in the order the price list runs. */
const RESORT_TIERS = ['value', 'moderate', 'deluxe', 'campground'];

/** The four theme parks by `area_id` — the water parks are not parks for the
 *  purposes of hopping between them. */
export const PARKS = ['magic-kingdom', 'epcot', 'hollywood-studios', 'animal-kingdom'];

/**
 * The challenges that are not about eating, which earn their own page in the
 * passport rather than sitting among twenty stamps about restaurants.
 *
 * A list here rather than a flag on the challenge, because the passport is
 * the only thing that needs to know and the alternative is a field every
 * builder has to remember to set.
 */
export const STAY_CHALLENGE_IDS = [
  'monorail-resorts',
  'skyliner-resorts',
  'resort-tiers',
  'resort-collection',
];

/**
 * The ones that are neither a meal nor a night: where you were, when, and how
 * you got around. Ordered as the page should read them.
 */
export const QUEST_CHALLENGE_IDS = [
  'park-hopper',
  'transportation',
  'fireworks',
  'all-year-round',
];

/**
 * The challenges whose steps can be ticked by hand.
 *
 * Exactly the quests, and the reason they are exactly the quests is that they
 * are the only ones the app cannot observe. Everything else in the passport is
 * the shadow of a meal or a night in the log: you cannot have eaten at Space
 * 220 without logging it, so a checkbox there would be a second, contradictory
 * source of truth for something already known.
 *
 * The quests are different in kind. Four parks in one day is scored off meals,
 * so a day spent riding rides counts for nothing. The transportation challenge
 * infers a mode from a resort you ate or slept at, which misses the monorail
 * between Magic Kingdom and EPCOT, the Skyliner between two parks, and the
 * ferry entirely. The fireworks challenge counts reserved views because paid
 * events are the rows the catalog holds, and nobody has to pay to watch
 * fireworks. All Year Round reads dates off the log, which a day trip with no
 * meal and no hotel never leaves behind.
 *
 * In each case the app is not wrong about what it saw — it cannot see the
 * thing being asked about. See `src/hooks/use-challenge-marks.tsx` for why a
 * mark can only ever ADD a tick.
 */
export const MANUAL_CHALLENGE_IDS = QUEST_CHALLENGE_IDS;

/** The order the five ways of getting around should be listed in, which is
 *  not alphabetical and is not the order the catalog happens to hold. */
const TRANSPORT_ORDER = ['monorail', 'skyliner', 'boat', 'bus', 'walk'];

/**
 * "Disney's Polynesian Village Resort" → "Polynesian Village Resort".
 *
 * The possessive is on nearly every row and distinguishes nothing, and these
 * names have to fit a checklist row and a chip.
 */
function shortResort(name: string): string {
  return name.replace(/^(Disney's|Walt Disney World|The)\s+/, '');
}

/** The month of an ISO date as a 0-11 index, or -1 if it is not a date. */
function monthOf(iso: string | null | undefined): number {
  const p = iso ? parseISO(iso) : null;
  return p ? p.month : -1;
}

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
 *
 * A step with NEITHER is a step the catalog does not hold at all — a month of
 * the year, a park covered on a single day. Those are real steps with nothing
 * to open, which is why `options` is left undefined rather than empty: an
 * empty array means "this is a choice and the catalog has nothing to offer",
 * and the detail screen says so.
 */
export type ChallengeStep = {
  /** A venue id, or a World Showcase pavilion slug. */
  id: string;
  label: string;
  done: boolean;
  /** Where a tap goes, or null when more than one place satisfies this step. */
  venueId: string | null;
  /**
   * Which detail screen `venueId` and `options` open. Omitted means a venue,
   * since all but the stays challenges count meals.
   */
  kind?: 'venue' | 'resort';
  /** The area, to tell two similarly named places apart. */
  where?: string;
  /** Pavilion steps only: the places that would tick this off. */
  options?: { id: string; name: string; done: boolean }[];
  /**
   * True when this step can be ticked by hand — see `MANUAL_CHALLENGE_IDS`.
   * Set per step rather than read off the challenge so a row can render its
   * own control without being handed its parent.
   */
  manual?: boolean;
  /**
   * True when the tick came from a manual mark AND the log did not already
   * earn it.
   *
   * The distinction is worth showing. "Done because you logged four meals in
   * four parks" and "done because you said so" are both done, but only the
   * second is something a person can take back, and a row that offered to
   * un-tick a step the log earned would be offering something it cannot
   * deliver.
   */
  marked?: boolean;
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
  /** True when its steps can be ticked by hand. See `MANUAL_CHALLENGE_IDS`. */
  manual: boolean;
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
  // `visits` and `stays` in full, not just the per-place rollups: the
  // challenges that are not about places at all — a month of the year, four
  // parks in one day — are scored off the DATES on the log.
  const { byVenue, byResort, visits, stays } = useVisits();
  const { areas } = useCatalog();
  // The quest steps someone ticked by hand. Additive only — see the hook.
  const { marks } = useChallengeMarks();

  const areaNames = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a.name])),
    [areas],
  );

  /** For naming a resort venue by its resort rather than its resort area. */
  const resortNames = useMemo(
    () => Object.fromEntries(resorts.map((r) => [r.id, r.name])),
    [resorts],
  );

  /**
   * Only places you can actually eat at, and that still exist.
   *
   * EVERY challenge counts from this list, tag-driven ones included. They
   * used to count from the raw catalog, and the Signature Dining challenge
   * was the proof that it mattered: "The Magic of New Year's Eve at
   * California Grill" carries the `signature` tag and is an EVENT, so
   * finishing the challenge required attending a specific New Year's Eve
   * party. That is precisely the case the rule at the top of this file
   * exists to prevent, and the rule was being applied to the area
   * percentages but not to the challenges.
   *
   * `tags` and `sub_area` are read off these rows directly — every catalog
   * row carries them now, which it did not when the list query trimmed
   * columns to save bandwidth.
   */
  const eligible = useMemo(
    () => venues.filter((v) => v.venue_kind !== 'event' && v.status !== 'permanently-closed'),
    [venues],
  );

  /**
   * `eligible` plus the events — and the distinction is not the one the rule
   * at the top of this file makes, so it needs stating.
   *
   * That rule keeps events out of a DENOMINATOR. It is right for a flat
   * challenge, where one more tagged row is one more thing you are required to
   * do: the Signature Dining bug was exactly that, a New Year's Eve party
   * standing between someone and a finished challenge.
   *
   * It is wrong for a GROUPED challenge, where an event can only ever add a
   * WAY IN and never a requirement. `data/README.md` has said so all along —
   * "a tequila tasting in Mexico is unambiguously a drink in Mexico" — and
   * routing the pavilions through `eligible` quietly stopped six real ways in
   * from counting: La Cava, Rose & Crown's fireworks package, Shiki-Sai's, and
   * the three festival packages at the American Adventure. Somebody who did
   * the Rose & Crown package HAS drunk in the United Kingdom, and the app was
   * telling them they had not.
   *
   * Closed rows are filtered again here rather than relied upon: `useVenues`
   * already drops them, and this keeps the rule true of this list on its own.
   */
  const withEvents = useMemo(
    () => venues.filter((v) => v.status !== 'permanently-closed'),
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

  /**
   * Resorts you could actually book a night at, which is `eligible`'s
   * counterpart for the stays half of the passport.
   *
   * Disney-owned only — the reasoning is at the top of the file — and open,
   * for the same reason a closed restaurant is not in a denominator. Both the
   * resort percentage and the stay challenges count from here so the two can
   * never disagree about what the total is.
   */
  const stayable = useMemo(
    () =>
      resorts.filter(
        (r) => r.ownership === 'disney-owned' && r.status !== 'permanently-closed',
      ),
    [resorts],
  );

  const resortCoverage = useMemo<Coverage>(() => {
    const visited = stayable.filter((r) => byResort.has(r.id)).length;
    return {
      id: 'resorts',
      label: 'Disney resorts',
      visited,
      total: stayable.length,
      pct: stayable.length ? visited / stayable.length : 0,
    };
  }, [stayable, byResort]);

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
      rows
        .map((r) => ({
          id: r.id,
          label: r.name,
          done: visitedIds.has(r.id),
          venueId: r.id,
          where:
            scope === 'area'
              ? r.sub_area
                ? formatSubArea(r.sub_area)
                : undefined
              : r.resort_id && resortNames[r.resort_id]
                ? shortResort(resortNames[r.resort_id])
                : areaNames[r.area_id] ?? r.area_id,
        }))
        // Grouped by that second line, then alphabetical inside it. The
        // catalog's own order is alphabetical by name across the whole list,
        // which scatters a crawl: the three Contemporary bars came out first,
        // fourth and eighth, interleaved with the Grand Floridian's, so a
        // list that named every resort correctly still could not be walked in
        // the order it was printed. Same reasoning for the park challenges,
        // where this groups by land.
        .sort(
          (a, b) =>
            (a.where ?? '').localeCompare(b.where ?? '') || a.label.localeCompare(b.label),
        );

    /**
     * The common tail of every checklist challenge: count the ticks, then
     * fill in either the tier ladder or the all-or-nothing fields.
     *
     * One place rather than six. Four builders were each writing out the same
     * eight properties, and the only thing that varied between them was which
     * rows became steps — which is the only thing a builder should decide.
     */
    const fromSteps = (
      id: string,
      title: string,
      blurb: string,
      rawSteps: ChallengeStep[],
      tiered = false,
      manual = false,
    ): Challenge => {
      /**
       * Manual marks fold in HERE, in the one place every challenge passes
       * through, rather than in the four quest builders.
       *
       * Doing it per builder was the first shape and it was wrong twice over:
       * four copies of the same two lines, and — worse — each builder would
       * have had to remember to recount, because `earned` is derived from
       * `done` on the line below. A builder that marked its steps and forgot
       * to recount would show ticked boxes above a count that disagreed with
       * them.
       *
       * `done: st.done || marked` is the additive rule in code. A step the log
       * already earned stays done no matter what the marks say, so a stale
       * mark cannot subtract and an un-tick cannot un-earn.
       */
      const steps: ChallengeStep[] = manual
        ? rawSteps.map((st) => {
            const marked = marks.has(markKey(id, st.id));
            return {
              ...st,
              manual: true,
              done: st.done || marked,
              // Only interesting when the mark is doing the work. A step the
              // log earned is not something the user can take back.
              marked: marked && !st.done,
            };
          })
        : rawSteps;

      const earned = steps.filter((st) => st.done).length;
      if (tiered) {
        return {
          id,
          title,
          blurb,
          earned,
          target: steps.length,
          tiered: true,
          manual,
          steps,
          ...tierProgress(earned, steps.length),
        };
      }
      return {
        id,
        title,
        blurb,
        earned,
        target: steps.length,
        complete: steps.length > 0 && earned === steps.length,
        tiered: false,
        manual,
        tier: null,
        nextTier: null,
        toNext: 0,
        steps,
        // Names rather than ids, because this is rendered straight into
        // "Still to go". Left off the tiered ones on purpose — see the type.
        remaining: steps.filter((st) => !st.done).map((st) => st.label),
      };
    };

    /** Pavilion challenges count PAVILIONS COVERED, not venues visited —
     *  a drink at either Mexico bar completes Mexico. */
    const pavilionChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge => {
      // `withEvents`, not `eligible` — see the note on it. A pavilion step is
      // a group, so an event here is one more way in, never one more
      // requirement.
      const inPavilion = new Map<string, typeof eligible>();
      for (const r of withEvents) {
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
      return fromSteps(id, title, blurb, steps);
    };

    /**
     * Every venue carrying a tag, all or nothing, naming what is left.
     *
     * Distinct from `tagChallenge`, which tiers. The same reasoning as the
     * pavilions: a short, closed set that people set out to COMPLETE is not
     * improved by a Bronze medal at a quarter of the way through, and nobody
     * claims a partial bar crawl. Tiers exist to make "4 of 61" survivable;
     * "4 of 10" is already a next step.
     */
    const setChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge =>
      // `tags` is string[] here, not the pipe-joined CSV form — `catalog-db`
      // parses the JSON column on the way out — so this is exact membership.
      fromSteps(id, title, blurb, venueSteps(eligible.filter((r) => r.tags?.includes(tag))));

    const tagChallenge = (
      id: string,
      title: string,
      blurb: string,
      tag: string,
    ): Challenge =>
      fromSteps(
        id,
        title,
        blurb,
        venueSteps(eligible.filter((r) => r.tags?.includes(tag))),
        true,
      );

    /**
     * Any slice of the catalog the existing columns can already describe.
     *
     * Everything built with this comes from `venue_kind`, `dining_style`,
     * `price_tier`, `resort_id` and `area_id` — no new tags, so these ship
     * over the air instead of waiting on a catalog import and a new binary.
     */
    const pickChallenge = (
      id: string,
      title: string,
      blurb: string,
      pick: (r: (typeof eligible)[number]) => boolean,
      tiered = false,
    ): Challenge => fromSteps(id, title, blurb, venueSteps(eligible.filter(pick)), tiered);

    /**
     * One step per resort, counted in STAYS rather than meals.
     *
     * The other half of the app, and until now the half with nothing to earn:
     * every challenge on the passport was a thing you ate or drank. These read
     * off `byResort`, which is the stay log, so none of them require a meal.
     */
    const resortSteps = (rows: typeof stayable): ChallengeStep[] =>
      rows
        .map((r) => ({
          id: r.id,
          label: shortResort(r.name),
          done: byResort.has(r.id),
          venueId: r.id,
          kind: 'resort' as const,
          where: `${TIER_LABEL[r.tier] ?? titleCase(r.tier)} · ${areaNames[r.area_id] ?? r.area_id}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const stayChallenge = (
      id: string,
      title: string,
      blurb: string,
      pick: (r: (typeof stayable)[number]) => boolean,
      tiered = false,
    ): Challenge => fromSteps(id, title, blurb, resortSteps(stayable.filter(pick)), tiered);

    /**
     * A stay challenge whose steps are groups of resorts, any one of which
     * ticks the step off. The same shape as a World Showcase pavilion, and
     * for the same reason: the step is the thing people mean, not the row the
     * catalog happens to keep.
     */
    const groupedStayChallenge = (
      id: string,
      title: string,
      blurb: string,
      groups: { id: string; label: string; rows: string[] }[],
    ): Challenge => {
      const steps: ChallengeStep[] = groups.map((grp) => {
        const options = grp.rows
          .map((rid) => stayable.find((r) => r.id === rid))
          .filter((r): r is (typeof stayable)[number] => !!r)
          .map((r) => ({ id: r.id, name: shortResort(r.name), done: byResort.has(r.id) }));
        return {
          id: grp.id,
          label: grp.label,
          done: options.some((o) => o.done),
          venueId: options.length === 1 ? options[0].id : null,
          kind: 'resort' as const,
          options,
        };
      });
      return fromSteps(id, title, blurb, steps);
    };

    /**
     * Every resort tier, from a tent to the Grand Floridian.
     *
     * Grouped by `tier` off the catalog rather than listed, so a new resort
     * joins the step it belongs to instead of needing a code change. Mapped
     * over `RESORT_TIERS` rather than over what the catalog holds, so a tier
     * with nothing in it is a step you cannot tick rather than a target that
     * silently shrank.
     */
    const tierStayChallenge = (): Challenge =>
      groupedStayChallenge(
        'resort-tiers',
        'Every Kind of Stay',
        'A night in each tier — Value, Moderate, Deluxe, and a tent in the woods.',
        RESORT_TIERS.map((t) => ({
          id: t,
          label: TIER_LABEL[t] ?? titleCase(t),
          rows: stayable.filter((r) => r.tier === t).map((r) => r.id),
        })),
      );

    /**
     * A visit or a stay in all twelve months.
     *
     * **Only exactly dated visits count.** The onboarding backfill writes
     * today's date with `date_exact = 0` against everything someone ticks
     * off, so counting those would hand whoever installed the app in March a
     * free March for a hundred meals they had years ago — and the one month
     * it filled would be the one month they could never earn honestly.
     *
     * Stays have no such flag because they are always entered with their real
     * check-in date.
     *
     * A stay credits every month it TOUCHES, not just the month it started
     * in. Checking in on 30 October and out on 3 November means you were here
     * in November, and a challenge about being here would be wrong to say
     * otherwise.
     */
    const yearChallenge = (): Challenge => {
      const hit = new Set<number>();
      for (const v of visits) if (v.date_exact) hit.add(monthOf(v.visited_on));
      for (const s of stays) {
        const from = parseISO(s.check_in);
        if (!from) continue;
        const to = (s.check_out && parseISO(s.check_out)) || from;
        // Capped, because the loop is driven by two dates typed by hand and a
        // check-out in 2124 must not hang the passport.
        let { year, month } = from;
        for (let i = 0; i < 24; i += 1) {
          hit.add(month);
          if (year > to.year || (year === to.year && month >= to.month)) break;
          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
        }
      }
      const steps: ChallengeStep[] = MONTH_LABELS.map((label, i) => ({
        id: `month-${i + 1}`,
        label,
        done: hit.has(i),
        venueId: null,
      }));
      return fromSteps(
        'all-year-round',
        'All Year Round',
        'Be at Walt Disney World in every month of the year. Not in one year — ever.',
        steps,
        false,
        // A day trip with no meal and no hotel leaves no date on the log, so
        // a month you were genuinely here can read as missed.
        true,
      );
    };

    /**
     * The four parks in a single day.
     *
     * Scored on your BEST day rather than cumulatively, which is the whole
     * point of it: four parks across four trips is not park hopping. So the
     * day with the most parks on it is the score, and the steps show which
     * parks that day covered — three of four means one day got close, not
     * that three parks are permanently banked.
     */
    const parkHopperChallenge = (): Challenge => {
      const areaOf = new Map(eligible.map((v) => [v.id, v.area_id]));
      const byDay = new Map<string, Set<string>>();
      for (const v of visits) {
        if (!v.date_exact) continue;
        const area = areaOf.get(v.venue_id);
        if (!area || !PARKS.includes(area)) continue;
        const set = byDay.get(v.visited_on) ?? new Set<string>();
        set.add(area);
        byDay.set(v.visited_on, set);
      }
      let bestDay = '';
      let best = new Set<string>();
      for (const [day, set] of byDay) {
        if (set.size > best.size) {
          bestDay = day;
          best = set;
        }
      }
      const steps: ChallengeStep[] = PARKS.map((p) => ({
        id: p,
        label: areaNames[p] ?? titleCase(p),
        done: best.has(p),
        venueId: null,
        where: best.has(p) ? formatDate(bestDay) : undefined,
      }));
      return fromSteps(
        'park-hopper',
        'Four Parks, One Day',
        'All four theme parks between one sunrise and the next. Logged meals tick a park off automatically; tick the rest yourself.',
        steps,
        false,
        // Park hopping is done with your feet. A day in all four parks that
        // involved no sit-down meal is invisible to the log and is still the
        // thing this challenge is about.
        true,
      );
    };

    /**
     * Every way of getting around the property.
     *
     * A resort counts as REACHED if you stayed there or ate there, because
     * both mean you travelled to it — you cannot have dinner at the
     * Polynesian without taking the monorail, a boat or a bus. What the app
     * cannot know is which one you actually took: there is no transport log,
     * and nothing short of one would let this say "the monorail, the Skyliner,
     * a bus and a ferry in the same trip". So it counts what is knowable and
     * says exactly that in the blurb.
     *
     * Steps carry no `options`. Bus serves all 31 resorts and a row of 31
     * chips is not a checklist, so the second line names them where there are
     * few and counts them where there are many.
     */
    const transportChallenge = (): Challenge => {
      const transportOf = new Map(resorts.map((r) => [r.id, r.transport]));

      const reached = new Set<string>();
      for (const r of resorts) if (byResort.has(r.id)) reached.add(r.id);
      for (const v of eligible) if (v.resort_id && visitedIds.has(v.id)) reached.add(v.resort_id);

      const modesReached = new Set<string>();
      for (const id of reached) {
        for (const mode of transportOf.get(id) ?? []) modesReached.add(mode);
      }

      const steps: ChallengeStep[] = TRANSPORT_ORDER.map((mode) => {
        const served = resorts.filter((r) => r.transport.includes(mode));
        return {
          id: mode,
          label: TRANSPORT_LABEL[mode] ?? titleCase(mode),
          done: modesReached.has(mode),
          venueId: null,
          where:
            served.length <= 4
              ? served.map((r) => shortResort(r.name)).join(', ')
              : `${served.length} resorts`,
        };
      });

      return fromSteps(
        'transportation',
        'The Transportation Challenge',
        'Ride every way of getting around — monorail, Skyliner, boat, bus and on foot. Tick off whatever you have ridden.',
        steps,
        false,
        // The monorail runs between Magic Kingdom and EPCOT, the Skyliner
        // stops at two parks and the ferry needs no resort at all, so the
        // most obvious way to ride each of them involves no resort to infer
        // it from.
        true,
      );
    };

    /**
     * Fireworks, from the places that sell you a view of them.
     *
     * Counted from `withEvents`, because every one of these IS an event — a
     * dessert party, a dining package, a cocktail reception on a top floor.
     * The rule that keeps events out of a denominator exists so a seasonal
     * party cannot make a park uncompletable; it has nothing to say about a
     * challenge that is deliberately and visibly about seasonal parties, and
     * nobody opens this one expecting to finish it in a week.
     *
     * Tiered for that reason. Two of these run only at Halloween and two only
     * at Christmas, so all-or-nothing would mean three trips in three seasons
     * before the first sign of progress.
     */
    const fireworksChallenge = (): Challenge =>
      fromSteps(
        'fireworks',
        'Under the Fireworks',
        'Dessert parties, dining packages and rooftops — plus anywhere else you have watched a show from.',
        venueSteps(withEvents.filter((r) => r.tags?.includes('fireworks'))),
        true,
        // Nobody has to pay to watch fireworks. The catalog can only hold the
        // reserved views because those are the ones that are bookable, so the
        // free ones have to be claimable by hand or this counts a fraction of
        // the times someone stood under a show.
        true,
      );

    /**
     * One step per cuisine, ticked by any one place that serves it.
     *
     * The same shape as the pavilions — the step is the cuisine, several
     * places satisfy it, so `venueId` is null unless exactly one does.
     *
     * **Lower-cased before grouping.** The catalog holds both `american` and
     * `American`, and both `Norwegian` and `norwegian`, so without this one
     * cuisine becomes two steps and the second is one almost nobody would
     * ever tick. Fixing the CSV would be better; surviving it is required
     * either way, because the import runs on data people type.
     */
    const cuisineChallenge = (): Challenge => {
      const byCuisine = new Map<string, { id: string; name: string; done: boolean }[]>();
      for (const r of eligible) {
        for (const raw of (r.cuisine ?? '').split('|')) {
          const key = raw.trim().toLowerCase();
          if (!key || NOT_A_CUISINE.has(key)) continue;
          const list = byCuisine.get(key) ?? [];
          list.push({ id: r.id, name: r.name, done: visitedIds.has(r.id) });
          byCuisine.set(key, list);
        }
      }
      const steps: ChallengeStep[] = [...byCuisine.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, options]) => ({
          id: key,
          label: titleCase(key),
          done: options.some((o) => o.done),
          venueId: options.length === 1 ? options[0].id : null,
          options,
        }));
      return fromSteps(
        'cuisines',
        'A Taste of Everywhere',
        'Something from every kind of kitchen on property.',
        steps,
      );
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
      // Coverage of a place, scored off meals. Nothing to tick by hand: you
      // cannot have eaten somewhere without logging it.
      manual: false,
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

      // ── Crawls ────────────────────────────────────────────────────────
      pickChallenge(
        'crescent-lake-crawl',
        'The Crescent Lake Crawl',
        'Every lounge around Crescent Lake — BoardWalk, Yacht and Beach Club, Swan and Dolphin.',
        (r) => r.venue_kind === 'lounge' && !!r.resort_id && CRESCENT_LAKE.includes(r.resort_id),
      ),
      pickChallenge(
        'springs-bar-hop',
        'The Disney Springs Bar Hop',
        'Every bar and lounge at Disney Springs, in whatever order the evening takes.',
        (r) => r.venue_kind === 'lounge' && r.area_id === 'disney-springs',
      ),

      // ── Collections ───────────────────────────────────────────────────
      pickChallenge(
        'buffets',
        'The Buffet Line',
        'Every all-you-care-to-eat buffet on property.',
        (r) => r.dining_style.includes('buffet'),
      ),
      pickChallenge(
        'street-eats',
        'Street Eats',
        'Every cart, wagon and food truck — the places with no front door.',
        (r) => r.venue_kind === 'food-truck' || r.venue_kind === 'cart',
      ),
      pickChallenge(
        'set-menu',
        'Set Menu',
        'Prix-fixe and family-style dining, where the kitchen decides.',
        (r) => r.dining_style.some((d) => d === 'prix-fixe' || d === 'family-style'),
        true,
      ),
      pickChallenge(
        'top-dollar',
        'Top Dollar',
        'Every four-dollar-sign restaurant at Walt Disney World.',
        (r) => r.price_tier === 4,
        true,
      ),
      pickChallenge(
        'lounges',
        'Lounge Lizard',
        'Every lounge and bar on property, all seventy-odd of them.',
        (r) => r.venue_kind === 'lounge',
        true,
      ),
      cuisineChallenge(),

      // ── Stays ─────────────────────────────────────────────────────────
      // Everything above this line is something you ate or drank, which was
      // the whole passport until now. These are scored off the stay log and
      // the dates on it, so none of them need a meal.
      groupedStayChallenge(
        'monorail-resorts',
        'The Monorail Resorts',
        'A night at the Grand Floridian, the Polynesian and the Contemporary — the three you can reach without a bus.',
        MONORAIL_RESORTS,
      ),
      stayChallenge(
        'skyliner-resorts',
        'The Skyliner Line',
        'A night at every resort on the Skyliner.',
        (r) => r.transport.includes('skyliner'),
      ),
      tierStayChallenge(),
      stayChallenge(
        'resort-collection',
        'Resort Collector',
        'A night at every Disney-owned resort at Walt Disney World.',
        () => true,
        true,
      ),
      // ── Quests ────────────────────────────────────────────────────────
      // Neither a meal nor a night: where you were, when, and how you moved.
      // In `QUEST_CHALLENGE_IDS` order, because that is the order the
      // passport page prints them in and two orderings would drift.
      parkHopperChallenge(),
      transportChallenge(),
      fireworksChallenge(),
      yearChallenge(),
    ];
  }, [
    byVenue,
    byResort,
    byArea,
    eligible,
    withEvents,
    stayable,
    resorts,
    visits,
    stays,
    areaNames,
    resortNames,
    marks,
  ]);

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
