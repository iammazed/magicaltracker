/**
 * Which pins get to show their name, and on which side of the dot it sits.
 *
 * This file exists because of a report that the map shows "the pink or
 * coloured dots/icons and the words are still not showing up", and because of
 * what `react-native-maps` 1.27.2 actually offers for that. There are exactly
 * two POI props — `showsPointsOfInterests` and `pointsOfInterestFilter` — and
 * both choose WHICH categories Apple draws. Neither says anything about when
 * Apple draws a name beside the icon. That is Apple's own label engine, it
 * takes no input from us, and inside Walt Disney World it has very little to
 * work with: private land, so few named footprints. An unnamed coloured dot
 * from Apple is therefore not a setting we have turned down. It is all Apple
 * has.
 *
 * Which means the only thing that can say what a place is, is this app — and
 * the rule for that was a single count: names appeared below 28 individual
 * pins on screen and vanished above it. A cliff like that fails in the band
 * that matters most. At park zoom the catalog separates into fifteen or twenty
 * singleton pins among thirty cluster badges, every one of them anonymous,
 * which is precisely where somebody is asking what they are looking at.
 *
 * So names are no longer rationed by how many pins there are. Every pin asks
 * for one, and a name is drawn if a box can be found for it that collides with
 * neither a box already drawn nor any other pin's mark. Crowding then gets
 * measured where it actually happens — between two particular boxes a few
 * points apart — rather than guessed from a total.
 *
 * **Four positions, not one.** The first version of this tried only directly
 * below the dot and was measurably WORSE than the count it replaced: one name
 * out of seventeen pins at EPCOT park zoom, because a single cluster badge
 * below a pin was enough to veto its only candidate. Below, above, right,
 * left, in that order of preference, is what a real label engine does and is
 * most of this file's value.
 *
 * Pure geometry, no React, so it is testable with `npx tsx` — the same reason
 * `calendar.ts` and `clock.ts` live outside the hooks.
 */

import type { Viewport } from '@/lib/cluster';

/**
 * A transparent 34pt box around an 18pt dot.
 *
 * Apple asks for 44pt targets and an 18pt pin is less than half that, but 44
 * would have neighbouring pins overlapping each other's hit areas at the
 * closest zoom. `TAP_SLOP` in `catalog-map.tsx` is how that gets solved.
 */
export const PIN_HIT = 34;

/**
 * The label's box is fixed in BOTH dimensions, because the marker's ANCHOR is
 * computed from it.
 *
 * A marker is anchored as a fraction of its own view, so anything beside the
 * dot moves the dot off its coordinate unless the anchor moves with it. For a
 * label above or below, only the height matters and the horizontal anchor
 * stays 0.5 at any width. For one to the left or right the WIDTH is in the
 * anchor too — which is why `labelWidth` is authoritative rather than an
 * estimate: the chip is given that exact width, so the number the collision
 * test uses and the number the anchor uses are the number the chip renders at.
 * A guess would put the dot a few points off its coordinate.
 *
 * It is also why the text is one line with `allowFontScaling` off: a label
 * that grew with the system font size would silently drag its pin off the map.
 */
export const LABEL_H = 15;
export const LABEL_GAP = 1;
export const LABEL_W = 96;

export type LabelSide = 'below' | 'above' | 'right' | 'left';

/**
 * Order of preference.
 *
 * Below first because that is where a map pin's name conventionally goes and
 * it never covers the thing the dot is standing on. Left is last because a
 * name trailing to the left of its dot reads as belonging to whatever is
 * further left.
 */
const SIDES: LabelSide[] = ['below', 'above', 'right', 'left'];

/**
 * Advance width per character at the chip's 10pt semibold, plus its 5pt of
 * padding each side.
 *
 * Approximated rather than measured: measuring text costs a layout pass per
 * label, and since the chip is then GIVEN this width the approximation becomes
 * correct by construction. Erring generous is right — a slightly roomy chip
 * looks like a chip, while a tight one ellipsises a name it had space for.
 */
const CHAR_W = 5.6;
const CHIP_PADDING = 10;

export function labelWidth(name: string): number {
  return Math.round(Math.min(LABEL_W, name.length * CHAR_W + CHIP_PADDING));
}

export type LabelPin = {
  id: string;
  /** Null for a cluster. A cluster is an obstacle and never takes a name —
   *  it is several places and has no one name. */
  name: string | null;
  lat: number;
  lng: number;
  /** Half the width of the mark drawn at this point, in points. */
  half: number;
};

export type MapSize = { width: number; height: number };

export type Rect = { left: number; right: number; top: number; bottom: number };

/** Points of clear space demanded between any two boxes. */
const BREATHING = 2;

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** `slop` widens the box on every side, for hit-testing a finger against it. */
export const contains = (r: Rect, p: { x: number; y: number }, slop = 0) =>
  p.x >= r.left - slop && p.x <= r.right + slop && p.y >= r.top - slop && p.y <= r.bottom + slop;

const grow = (r: Rect, by: number): Rect => ({
  left: r.left - by,
  right: r.right + by,
  top: r.top - by,
  bottom: r.bottom + by,
});

/**
 * Where a point lands on screen, in points from the map's top-left.
 *
 * Exact only while the map is north-up and flat, which is why `catalog-map.tsx`
 * sets `rotateEnabled={false}` and `pitchEnabled={false}`. Latitude is
 * inverted, because it grows upward and screen y grows downward.
 */
export function project(viewport: Viewport, size: MapSize) {
  const perLng = size.width / viewport.longitudeDelta;
  const perLat = size.height / viewport.latitudeDelta;
  return {
    perLng,
    perLat,
    at: (lat: number, lng: number) => ({
      x: (lng - viewport.longitude) * perLng + size.width / 2,
      y: (viewport.latitude - lat) * perLat + size.height / 2,
    }),
  };
}

/** The box a name occupies on a given side of a dot at (x, y). */
export function labelRect(side: LabelSide, x: number, y: number, name: string): Rect {
  const w = labelWidth(name);
  const edge = PIN_HIT / 2 + LABEL_GAP;
  switch (side) {
    case 'below':
      return { left: x - w / 2, right: x + w / 2, top: y + edge, bottom: y + edge + LABEL_H };
    case 'above':
      return { left: x - w / 2, right: x + w / 2, top: y - edge - LABEL_H, bottom: y - edge };
    case 'right':
      return { left: x + edge, right: x + edge + w, top: y - LABEL_H / 2, bottom: y + LABEL_H / 2 };
    case 'left':
      return { left: x - edge - w, right: x - edge, top: y - LABEL_H / 2, bottom: y + LABEL_H / 2 };
  }
}

/**
 * The dot's centre as a fraction of the whole marker view, per side.
 *
 * `catalog-map.tsx` lays the marker out to match — a column for above and
 * below, a row for left and right — so these fractions and that layout are one
 * decision in two files and have to move together.
 */
export function anchorFor(side: LabelSide | undefined, name: string) {
  if (!side) return { x: 0.5, y: 0.5 };
  const w = labelWidth(name);
  const stack = PIN_HIT + LABEL_GAP + LABEL_H;
  const beside = PIN_HIT + LABEL_GAP + w;
  switch (side) {
    case 'below':
      return { x: 0.5, y: PIN_HIT / 2 / stack };
    case 'above':
      return { x: 0.5, y: (LABEL_H + LABEL_GAP + PIN_HIT / 2) / stack };
    case 'right':
      return { x: PIN_HIT / 2 / beside, y: 0.5 };
    case 'left':
      return { x: (w + LABEL_GAP + PIN_HIT / 2) / beside, y: 0.5 };
  }
}

/**
 * Which pins show a name, and on which side, nearest the middle of the screen
 * first.
 *
 * Centre-out rather than alphabetical or north-to-south, because the middle of
 * the map is what somebody is looking at — if a name has to be dropped it
 * should be one at the edge. `first` jumps the queue, which is how the selected
 * pin keeps its name even in a crowd.
 *
 * Off-screen pins are obstacles but never candidates, and a box that would run
 * off the edge is refused: `MKMapView` clips its annotations, so half a name is
 * no name. `clusterPins` keeps a margin of pins mounted beyond the viewport so
 * nothing pops in during a pan, and a name out there would cost a marker
 * redraw for something nobody sees.
 */
export function pickLabels(
  pins: LabelPin[],
  viewport: Viewport,
  size: MapSize,
  first?: string | null,
): Map<string, LabelSide> {
  const chosen = new Map<string, LabelSide>();
  if (!size.width || !size.height) return chosen;
  if (!viewport.latitudeDelta || !viewport.longitudeDelta) return chosen;

  const { at } = project(viewport, size);
  const placed = pins.map((pin, index) => {
    const { x, y } = at(pin.lat, pin.lng);
    return { pin, index, x, y };
  });

  // Every mark on the map blocks a label, whether or not it takes one itself.
  const marks = placed.map(({ pin, x, y }) =>
    grow(
      { left: x - pin.half, right: x + pin.half, top: y - pin.half, bottom: y + pin.half },
      BREATHING,
    ),
  );

  const midX = size.width / 2;
  const midY = size.height / 2;
  const onScreen = ({ x, y }: { x: number; y: number }) =>
    x > -LABEL_W && x < size.width + LABEL_W && y > -PIN_HIT && y < size.height + PIN_HIT;

  const named = placed
    .filter((p) => p.pin.name != null && onScreen(p))
    .sort((a, b) => Math.hypot(a.x - midX, a.y - midY) - Math.hypot(b.x - midX, b.y - midY));

  // Pulled out rather than special-cased in the comparator: one element that
  // sorts before everything else is not a consistent ordering, and Array.sort
  // is entitled to misbehave given one.
  const order = first
    ? [...named.filter((p) => p.pin.id === first), ...named.filter((p) => p.pin.id !== first)]
    : named;

  const inside = (r: Rect) =>
    r.left >= 0 && r.top >= 0 && r.right <= size.width && r.bottom <= size.height;

  const taken: Rect[] = [];
  for (const { pin, index, x, y } of order) {
    const name = pin.name as string;

    /**
     * Two things can be in the way and they are not equally serious.
     *
     * Another NAME is fatal: two chips over each other leave neither
     * readable, so that is an absolute veto. Another pin's mark is a cost —
     * the chip hides a dot or a cluster's number, which is a real loss and a
     * smaller one than the pin going unnamed.
     *
     * Treating both as vetoes is what the first version of this did, and the
     * measurement is unambiguous: two names out of seventeen pins at EPCOT
     * park zoom, against seventeen under the count rule it replaced. The
     * reason is geometry rather than bad luck. `clusterPins` buckets on a grid
     * of `latitudeDelta / 7`, so at park zoom the badges land on a lattice
     * about 88pt apart, and a chip up to 96pt wide cannot be threaded between
     * them at any of the four positions. A rule that can only ever say no in
     * that situation is a rule that answers "no words" with "no words".
     *
     * So: take the best side available, preferring the one that covers fewest
     * marks, and only give up if every side is off the edge or under another
     * name. Crowding where the map is genuinely crowded was always the
     * accepted cost here — an anonymous dot is the worse outcome.
     */
    let best: { side: LabelSide; box: Rect; cost: number } | null = null;

    for (const side of SIDES) {
      const box = labelRect(side, x, y, name);
      if (!inside(box)) continue;

      const padded = grow(box, BREATHING);

      let underName = false;
      for (let i = 0; i < taken.length && !underName; i++) {
        if (overlaps(padded, taken[i])) underName = true;
      }
      if (underName) continue;

      let cost = 0;
      for (let i = 0; i < marks.length; i++) {
        if (i !== index && overlaps(padded, marks[i])) cost++;
      }

      if (!best || cost < best.cost) best = { side, box: padded, cost };
      // Nothing beats a side that covers nothing, so stop looking.
      if (cost === 0) break;
    }

    if (best) {
      taken.push(best.box);
      chosen.set(pin.id, best.side);
    }
  }
  return chosen;
}
