import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { TIER_COLOR, type Challenge } from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';

/**
 * A passport stamp — a RUBBER stamp, the kind a customs desk presses into a
 * page. Explicitly not a postage stamp: no serrated edge, no perforations,
 * no rectangle with a picture in it.
 *
 * The first version was a ring with an icon in it and read as an icon chip,
 * because that is what it was. What makes an entry stamp recognisable is a
 * short list of things, and it is all of them together rather than any one:
 *
 *   - a THICK outer ring with a thin second ring inside it
 *   - a rule across the middle splitting the face into mark and legend
 *   - short, wide-tracked, all-caps type
 *   - ink that is not quite opaque, over a disc of the same colour
 *   - the status word set on an ARC, following the ring
 *   - pressed crooked
 *
 * Three states, and the distance between them is the point — the complaint
 * that started this was that finishing something "can be missed":
 *
 *   | state       | ring  | disc | lean    | ink        | legend     |
 *   |-------------|-------|------|---------|------------|------------|
 *   | complete    | 3px   | yes  | crooked | gold       | arc        |
 *   | in progress | 1.5px | no   | square  | tier/area  | straight   |
 *   | untouched   | 1px   | no   | square  | faint      | straight   |
 *
 * Only an earned stamp leans. A page of upright outlines with two crooked
 * inked stamps in it reads instantly, at arm's length, with no text.
 *
 * **Everything inside is sized from the measured diameter, not in points.**
 * One stamp is ~99pt wide in the passport grid and 84pt in the home strip,
 * and the version before this used a fixed 22pt mark for both — which is 22%
 * of the grid cell and reads as a small icon lost in a big circle. The
 * proportions below hold at every width.
 */

/** Material names for Android and web, which have no SF Symbols. */
type Glyph = SymbolViewProps['name'];

const g = (ios: string, md: string): Glyph =>
  ({ ios, android: md, web: md }) as Glyph;

/**
 * One glyph per challenge, falling back to the area map and then to a pin.
 *
 * Every symbol here shipped in SF Symbols 4 or earlier. A name iOS does not
 * know renders as empty space rather than an error, and an empty stamp is
 * indistinguishable from a layout bug, so this is not the place to reach for
 * the newest glyph.
 */
const CHALLENGE_GLYPH: Record<string, Glyph> = {
  'monorail-bar-crawl': g('wineglass.fill', 'wine_bar'),
  'crescent-lake-crawl': g('figure.walk', 'directions_walk'),
  'springs-bar-hop': g('bag.fill', 'shopping_bag'),
  'drinking-around-the-world': g('globe.americas.fill', 'public'),
  'snacking-around-the-world': g('takeoutbag.and.cup.and.straw.fill', 'lunch_dining'),
  'character-dining': g('crown.fill', 'workspace_premium'),
  'signature-dining': g('star.circle.fill', 'star'),
  buffets: g('tray.full.fill', 'restaurant_menu'),
  'set-menu': g('list.bullet.rectangle.fill', 'list_alt'),
  'top-dollar': g('dollarsign.circle.fill', 'paid'),
  'street-eats': g('box.truck.fill', 'local_shipping'),
  lounges: g('wineglass.fill', 'wine_bar'),
  cuisines: g('fork.knife.circle.fill', 'restaurant'),

  // The stays half of the passport, which is where the challenges that are
  // not about eating live.
  'monorail-resorts': g('tram.fill', 'tram'),
  'skyliner-resorts': g('cablecar.fill', 'tram'),
  'resort-tiers': g('square.stack.3d.up.fill', 'layers'),
  'resort-collection': g('key.fill', 'key'),
  'all-year-round': g('calendar', 'calendar_month'),
  'park-hopper': g('ticket.fill', 'confirmation_number'),
  transportation: g('arrow.triangle.branch', 'alt_route'),
  fireworks: g('sparkles', 'auto_awesome'),
};

const AREA_GLYPH: Record<string, Glyph> = {
  // Not `building.columns`, which is a courthouse — it was read as "a
  // congressional building" on the first look, correctly. A castle
  // silhouette is the obvious alternative and is exactly the Disney trade
  // dress this app stays away from, so Magic Kingdom gets the magic rather
  // than the building.
  'magic-kingdom': g('wand.and.stars', 'auto_fix_high'),
  epcot: g('globe', 'public'),
  'hollywood-studios': g('film.fill', 'movie'),
  'animal-kingdom': g('tree.fill', 'park'),
  'disney-springs': g('bag.fill', 'shopping_bag'),
  'blizzard-beach': g('drop.fill', 'water_drop'),
  'typhoon-lagoon': g('drop.fill', 'water_drop'),
  'wide-world-of-sports': g('sportscourt.fill', 'sports_soccer'),
  'mk-resort-area': g('bed.double.fill', 'hotel'),
  'epcot-resort-area': g('bed.double.fill', 'hotel'),
  'ak-resort-area': g('bed.double.fill', 'hotel'),
  'springs-resort-area': g('bed.double.fill', 'hotel'),
  'sports-resort-area': g('bed.double.fill', 'hotel'),
  boardwalk: g('bed.double.fill', 'hotel'),
  wdw: g('sparkles', 'auto_awesome'),
};

const FALLBACK = g('mappin.and.ellipse', 'place');

export function stampGlyph(id: string): Glyph {
  if (CHALLENGE_GLYPH[id]) return CHALLENGE_GLYPH[id];
  if (id.startsWith('area-')) return AREA_GLYPH[id.slice(5)] ?? FALLBACK;
  return FALLBACK;
}

/**
 * How far this stamp leans, derived from its id.
 *
 * Deterministic rather than random: a stamp that picked a new angle on every
 * render would wobble on each re-render and look broken rather than hand
 * pressed. Never zero — square to the page is what a printed form looks like,
 * and the lean is a large part of the illusion.
 */
function lean(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  const deg = (Math.abs(h) % 13) - 6; // -6 … +6
  return `${deg === 0 ? 4 : deg}deg`;
}

/** The short form for under a stamp — "Monorail Bar Crawl", not "The
 *  Monorail Bar Crawl". Two lines at 10px is about 34 characters. */
function stampLabel(c: Challenge): string {
  return c.title.replace(/^The /, '');
}

/**
 * The status word bent around the inside of the ring.
 *
 * There is no text-on-a-path in React Native and no SVG in this project's
 * dependencies — `react-native-svg` is not installed, and adding it would
 * move the fingerprint and orphan every build already on a phone. So each
 * letter is its own absolutely-positioned box filling the circle, which puts
 * its transform origin exactly at the centre, and then:
 *
 *     transform: [{ rotate: a }, { translateY: r }]
 *
 * Transforms compose left to right, so the box's frame turns by `a` first and
 * the letter then slides `r` down that turned axis — landing on the circle of
 * radius `r` at angle `a` from the bottom, already rotated tangentially. A
 * POSITIVE angle lands left of bottom-centre and tilts the letter the way the
 * arc does there, which is why the angles count DOWN across the word: the
 * result reads left to right along the bottom of the stamp, right way up.
 *
 * Spacing is one approximated advance width per letter rather than measured
 * glyph metrics. Measuring would cost a layout pass per character for a
 * six-letter word nobody is going to kern.
 */
function ArcText({
  text,
  radius,
  fontSize,
  color,
}: {
  text: string;
  radius: number;
  fontSize: number;
  color: string;
}) {
  const chars = [...text];
  const advance = fontSize * 0.66 + fontSize * 0.16;
  const step = ((advance / radius) * 180) / Math.PI;
  const first = ((chars.length - 1) / 2) * step;

  return (
    <>
      {chars.map((ch, i) => (
        <View
          // Letters repeat, so the index has to be part of the key.
          key={`${i}-${ch}`}
          pointerEvents="none"
          style={[
            styles.arcChar,
            { transform: [{ rotate: `${first - i * step}deg` }, { translateY: radius }] },
          ]}
        >
          <ThemedText
            style={{
              color,
              fontSize,
              lineHeight: fontSize + 2,
              fontWeight: '800',
              // Tracking comes from the angles above, so adding it here would
              // double-count it AND push each glyph off its own centre.
              letterSpacing: 0,
            }}
          >
            {ch}
          </ThemedText>
        </View>
      ))}
    </>
  );
}

export function Stamp({
  challenge: c,
  fresh = false,
  width = '30%',
}: {
  challenge: Challenge;
  /** Earned since the user last looked, so it gets a gold dot. */
  fresh?: boolean;
  /**
   * A percentage inside a wrapping grid, a number inside a horizontal strip —
   * a percentage has nothing to resolve against there and collapses the cell
   * to the width of its label.
   *
   * 30% is three to a row with room to spare. At 31% with a 16pt gap the
   * third cell overflows a 393pt screen by 9pt and silently wraps to two per
   * row, which looks like a layout nobody checked.
   */
  width?: number | string;
}) {
  const theme = useTheme();
  const router = useRouter();

  /**
   * The measured diameter, which everything inside is a fraction of.
   *
   * Seeded from `width` when it is a number so the horizontal strip draws
   * correctly on its first frame; a percentage cannot be resolved here, so
   * the grid draws the rings on frame one and the contents on frame two.
   */
  const [d, setD] = useState(typeof width === 'number' ? width : 0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== d) setD(next);
  };

  const started = c.earned > 0;
  // A tiered challenge inks in its tier's metal; an all-or-nothing one has no
  // tier to show, so it borrows the accent until it is finished and gold.
  const ink = c.complete
    ? theme.gold
    : c.tier
      ? TIER_COLOR[c.tier.name]
      : started
        ? theme.accent
        : theme.textFaint;

  // The proportions. Measured against the grid cell (~99pt) and the home
  // strip (84pt), which are the only two sizes this is used at.
  const inset = Math.max(4, Math.round(d * 0.05));
  const mark = Math.round(d * 0.34);
  const legendSize = Math.max(9, Math.round(d * 0.115));
  const arcSize = Math.max(8, Math.round(d * 0.105));
  // Just inside the inner ring: its inset, a point of air, and half a cap
  // height, since the letter is centred on this radius rather than hung
  // from it.
  const arcRadius = d / 2 - inset - 2 - arcSize * 0.55;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: c.id } })}
      accessibilityRole="button"
      accessibilityLabel={
        `${c.title}. ${c.complete ? 'Earned' : `${c.earned} of ${c.target}`}` +
        (c.tier && !c.complete ? `, ${c.tier.name}` : '') +
        '. Opens the checklist.'
      }
      style={({ pressed }) => [
        styles.cell,
        { width: width as number },
        pressed ? styles.pressed : null,
      ]}
    >
      <View
        onLayout={onLayout}
        style={[
          styles.ring,
          {
            borderColor: ink,
            borderWidth: c.complete ? 3 : started ? 1.5 : 1,
            // Ink is never fully opaque where it has been pressed, and the
            // untouched ones have to recede far enough that a filling page
            // reads as filling.
            opacity: c.complete ? 0.9 : started ? 0.95 : 0.4,
          },
          // Only earned stamps lean. See the table above.
          c.complete ? { transform: [{ rotate: lean(c.id) }] } : null,
        ]}
      >
        {/* The disc, as a tinted overlay rather than a computed rgba — `ink`
            is a theme hex and this needs no colour maths. It is what makes a
            finished stamp read as filled from across the room, and it has to
            be a wash of the INK: the first version filled with `goldSurface`,
            which is the colour of the page it sits on, so there was nothing
            to see. */}
        {c.complete ? (
          <View style={[styles.disc, { backgroundColor: ink, opacity: 0.16 }]} />
        ) : null}

        {/* The second ring. One ring is a badge; two is a stamp — but only if
            you can see it, and at a hairline against a tinted disc you could
            not. A full point, and a point and a half once there is ink in
            the circle to hold its own against. */}
        <View
          style={[
            styles.innerRing,
            {
              borderColor: ink,
              borderWidth: c.complete ? 1.5 : 1,
              left: inset,
              right: inset,
              top: inset,
              bottom: inset,
              opacity: c.complete ? 0.55 : 0.35,
            },
          ]}
        />

        {d > 0 ? (
          <>
            <View
              style={[
                styles.face,
                // Lifted off centre on a finished stamp to leave the arc its
                // own room along the bottom.
                c.complete ? { paddingBottom: Math.round(d * 0.14) } : null,
              ]}
            >
              <SymbolView
                name={stampGlyph(c.id)}
                size={mark}
                weight="semibold"
                tintColor={ink}
              />
              {/* The rule across the middle. On a real entry stamp it
                  separates the office from the date; here it separates the
                  mark from the reading, and it is most of what stops this
                  looking like an app icon in a circle. */}
              <View
                style={[
                  styles.rule,
                  { backgroundColor: ink, width: Math.round(d * 0.28), opacity: 0.55 },
                ]}
              />
              {/* A fraction stays straight. "4/26" on an arc is unreadable at
                  this size and says nothing a curve would add — the arc is
                  there to mark the one state worth marking. */}
              {c.complete ? null : (
                <ThemedText
                  style={[
                    styles.legend,
                    { color: ink, fontSize: legendSize, lineHeight: legendSize + 3 },
                  ]}
                  numberOfLines={1}
                >
                  {c.earned}/{c.target}
                </ThemedText>
              )}
            </View>

            {c.complete ? (
              <ArcText text="EARNED" radius={arcRadius} fontSize={arcSize} color={ink} />
            ) : null}
          </>
        ) : null}
      </View>

      {fresh ? <View style={[styles.freshDot, { backgroundColor: theme.gold }]} /> : null}

      <ThemedText
        type="small"
        numberOfLines={2}
        style={[
          styles.label,
          { color: c.complete ? theme.goldText : started ? theme.text : theme.textFaint },
        ]}
      >
        {stampLabel(c)}
      </ThemedText>
    </Pressable>
  );
}

/**
 * A page of the passport.
 *
 * The aged panel is doing the same job the lean does — saying "keepsake"
 * before a single word is read. It reuses `goldSurface` rather than adding a
 * paper token, because `scripts/check-tokens.mjs` mirrors the token list to
 * the website's CSS and a new one would have to be mirrored too.
 *
 * Deliberately NOT a dashed border: on iOS `borderStyle: 'dashed'` combined
 * with a corner radius renders solid, so the dashes would appear on web and
 * Android only — a difference nobody asked for and nobody here would see.
 */
export function PassportPage({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.page, { backgroundColor: theme.goldSurface, borderColor: theme.gold }]}>
      <View style={styles.pageHead}>
        <ThemedText type="small" style={[styles.pageTitle, { color: theme.goldText }]}>
          {title.toUpperCase()}
        </ThemedText>
        <View style={[styles.rulePage, { backgroundColor: theme.gold }]} />
      </View>
      {caption ? (
        <ThemedText type="small" themeColor="textSecondary">
          {caption}
        </ThemedText>
      ) : null}
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', gap: Spacing.one + 2 },
  pressed: { opacity: 0.6 },
  /** Square by aspect ratio rather than a fixed size, so one stamp fills one
   *  grid cell at every screen width. `borderRadius` past half the width is
   *  clamped, so 999 simply means "a circle". */
  ring: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999 },
  /** Inset and border width are set per stamp from the measured diameter. */
  innerRing: { position: 'absolute', borderRadius: 999 },
  face: { alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  /** Width is proportional; only the thickness is fixed, because a rule that
   *  scaled would be a bar at the top of the range and vanish at the bottom. */
  rule: { height: StyleSheet.hairlineWidth + 0.5 },
  legend: { fontWeight: '800', letterSpacing: 1.1 },
  /** One letter of the arc. Fills the circle so that its transform origin is
   *  the circle's centre — see `ArcText`. */
  arcChar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freshDot: {
    position: 'absolute',
    top: -2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
  page: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pageTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  rulePage: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.5 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Columns are tight and rows are generous on purpose: the horizontal
    // budget is fixed at three cells, while vertical space is what stops a
    // full page of stamps reading as a grid of buttons.
    columnGap: Spacing.two,
    rowGap: Spacing.four,
    justifyContent: 'flex-start',
    // Labels run to one or two lines, so without this a short-labelled stamp
    // stretches to its neighbour's height and its legend drifts off the
    // baseline the rest of the row sits on.
    alignItems: 'flex-start',
  },
});
