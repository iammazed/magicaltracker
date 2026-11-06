import { PARKS, type Challenge, type Coverage } from '@/hooks/use-passport';

/**
 * What can go on the share card, and which of it is on there.
 *
 * Separate from both the card and the share screen because three things need
 * the same list and none of them should own it: the card renders the chosen
 * stats, the screen offers the choice, and the stored preference is a list of
 * ids that has to still mean something next release.
 *
 * ## Three, and not a settable number
 *
 * The footer is one row on a square image. Four stats at this type size start
 * to wrap on a phone-width card, and a wrapped footer on an image somebody
 * posts is not a bug they can report — they just do not post it. So the cap is
 * a property of the layout, enforced here where the selection is made rather
 * than discovered in the renderer.
 */

export type ShareStat = {
  id: string;
  /** All caps, short enough to sit under the value without wrapping. */
  label: string;
  /** Pre-formatted, because "48" and "9/12" are both right for different
   *  stats and the card should not be deciding that. */
  value: string;
};

/** The most that fit across the footer of a square card. */
export const MAX_SHARE_STATS = 3;

/**
 * The three the card has always shown.
 *
 * Places, stamps and resorts: the headline, the game, and the one most people
 * are surprised by. Kept as the default so that nobody has to visit the
 * chooser to get a sensible card, and so an existing user's card does not
 * change shape under them on upgrade.
 */
export const DEFAULT_SHARE_STATS = ['places', 'stamps', 'resorts'];

/** Where the chosen ids live, in `app_settings`. */
export const SHARE_STATS_KEY = 'share_card_stats';

/**
 * Everything the card COULD show, in a fixed order.
 *
 * Fixed, because this is also the order of the chooser and a list that
 * reordered itself by value would move the thing someone was reaching for.
 *
 * Every one of these is already computed for some other screen. That is the
 * criterion for being on this list at all: a stat invented for the share card
 * would be a number nobody could find anywhere else in the app, which on an
 * image shared publicly is the beginning of "where did that come from?".
 */
export function shareStatOptions({
  overall,
  resortCoverage,
  byArea,
  challenges,
}: {
  overall: Coverage;
  resortCoverage: { visited: number; total: number };
  byArea: Coverage[];
  challenges: Challenge[];
}): ShareStat[] {
  /** A challenge's progress as a fraction, or null if it is not in the set. */
  const fraction = (id: string): string | null => {
    const c = challenges.find((x) => x.id === id);
    return c ? `${c.earned}/${c.target}` : null;
  };

  /**
   * Theme parks where at least one meal is logged.
   *
   * Counted off `byArea` rather than off the park-hopper challenge, which
   * scores a single DAY — four parks across four trips is four parks here and
   * correctly zero there.
   */
  const parks = PARKS.filter((p) => (byArea.find((a) => a.id === p)?.visited ?? 0) > 0).length;

  const all: (ShareStat | null)[] = [
    {
      id: 'places',
      label: 'PLACES',
      // A bare count, not a fraction. This is the number someone says out
      // loud, and "48 places" carries where "48/394" invites the reader to do
      // the division and find it small.
      value: `${overall.visited}`,
    },
    {
      id: 'coverage',
      label: 'OF THE WORLD',
      value: `${Math.round(overall.pct * 100)}%`,
    },
    {
      id: 'stamps',
      label: 'STAMPS',
      value: `${challenges.filter((c) => c.complete).length}/${challenges.length}`,
    },
    {
      id: 'resorts',
      label: 'RESORTS',
      value: `${resortCoverage.visited}/${resortCoverage.total}`,
    },
    { id: 'parks', label: 'PARKS', value: `${parks}/${PARKS.length}` },
    // Null when the catalog no longer carries the challenge these read, which
    // is why the array is nullable and filtered rather than built straight.
    // A chooser row promising MONTHS and a card showing "undefined/undefined"
    // is the failure being avoided.
    monthsStat(fraction('all-year-round')),
    cuisinesStat(fraction('cuisines')),
  ];

  return all.filter((s): s is ShareStat => s !== null);
}

function monthsStat(value: string | null): ShareStat | null {
  return value ? { id: 'months', label: 'MONTHS', value } : null;
}

function cuisinesStat(value: string | null): ShareStat | null {
  return value ? { id: 'cuisines', label: 'CUISINES', value } : null;
}

/**
 * Turns stored ids into stats to render.
 *
 * Order comes from `options`, NOT from the stored list, so the card reads the
 * same way whichever order someone happened to tap them in — and an id that no
 * longer exists is dropped rather than rendered as a gap. That is also what
 * makes the stored value safe across releases: it is a set of names, and a
 * name this version does not know is simply not shown.
 */
export function resolveShareStats(options: ShareStat[], chosen: string[]): ShareStat[] {
  const want = new Set(chosen);
  return options.filter((s) => want.has(s.id)).slice(0, MAX_SHARE_STATS);
}

/** Parses what came out of `app_settings`, tolerating anything. */
export function parseShareStats(raw: string | null): string[] {
  if (!raw) return DEFAULT_SHARE_STATS;
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return DEFAULT_SHARE_STATS;
    // An empty array is a real choice — the ring on its own — and must
    // survive a round trip rather than being read back as "unset".
    return list.filter((x): x is string => typeof x === 'string').slice(0, MAX_SHARE_STATS);
  } catch {
    return DEFAULT_SHARE_STATS;
  }
}
