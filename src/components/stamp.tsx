import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { TIER_COLOR, type Challenge } from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';

/**
 * A passport stamp.
 *
 * The tab has been called Passport since the first commit and rendered a
 * column of identical grey cards — a spreadsheet wearing the name of a
 * keepsake. A passport's whole visual grammar is the stamp: a ring of ink,
 * pressed slightly crooked, accumulating across a page. That is what people
 * open a passport to look at, and it is the thing worth screenshotting.
 *
 * Three states, and the distance between them is deliberate — the complaint
 * that started this was that finishing something "can be missed":
 *
 *   | state       | ring             | lean      | ink        |
 *   |-------------|------------------|-----------|------------|
 *   | complete    | 2.5px + wash     | crooked   | gold       |
 *   | in progress | 1.5px, no fill   | square    | tier/area  |
 *   | untouched   | 1px, faint       | square    | faint      |
 *
 * Only an earned stamp leans. A page of upright outlines with two crooked
 * inked stamps in it reads instantly, at arm's length, with no text.
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
  'drinking-around-the-world': g('globe.americas.fill', 'public'),
  'snacking-around-the-world': g('takeoutbag.and.cup.and.straw.fill', 'lunch_dining'),
  'character-dining': g('crown.fill', 'workspace_premium'),
  'signature-dining': g('star.circle.fill', 'star'),
};

const AREA_GLYPH: Record<string, Glyph> = {
  'magic-kingdom': g('building.columns.fill', 'account_balance'),
  epcot: g('globe', 'public'),
  'hollywood-studios': g('film.fill', 'movie'),
  'animal-kingdom': g('leaf.fill', 'park'),
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
 * and the lean is the entire illusion.
 */
function lean(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  const deg = (Math.abs(h) % 13) - 6; // -6 … +6
  return `${deg === 0 ? 4 : deg}deg`;
}

/** The short form for under a stamp — "Magic Kingdom", not "Every place to
 *  eat in Magic Kingdom". Two lines at 10px is about 22 characters. */
function stampLabel(c: Challenge): string {
  return c.title.replace(/^The /, '');
}

export function Stamp({
  challenge: c,
  fresh = false,
  size = 64,
  width = '30%',
}: {
  challenge: Challenge;
  /** Earned since the user last looked, so it gets a gold dot. */
  fresh?: boolean;
  size?: number;
  /** A percentage inside a wrapping grid, a number inside a horizontal
   *  strip — a percentage width has nothing to resolve against there and
   *  collapses the cell to the width of its label.
   *
   *  30% is three to a row with room to spare. At 31% with a 16pt gap the
   *  third cell overflows a 393pt screen by 9pt and silently wraps to two
   *  per row, which looks like a layout that was never checked. */
  width?: number | string;
}) {
  const theme = useTheme();
  const router = useRouter();

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

  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: ink,
    borderWidth: c.complete ? 2.5 : started ? 1.5 : 1,
    // The wash is what makes a finished stamp read as *filled* from across
    // the room. `goldSurface` is cream in light mode and an aged brown in
    // dark, which is the right paper in both.
    backgroundColor: c.complete ? theme.goldSurface : 'transparent',
    opacity: started ? 1 : 0.45,
  };

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
        style={[
          styles.ring,
          ring,
          // Only earned stamps lean. See the table above.
          c.complete ? { transform: [{ rotate: lean(c.id) }] } : null,
        ]}
      >
        {/* The inner hairline is what separates a stamp from a plain icon
            chip. Real stamps are a ring inside a ring. */}
        <View
          style={[
            styles.innerRing,
            {
              borderRadius: size / 2,
              borderColor: ink,
              opacity: c.complete ? 0.4 : 0.22,
            },
          ]}
        />
        <SymbolView
          name={stampGlyph(c.id)}
          size={Math.round(size * 0.36)}
          weight="semibold"
          tintColor={ink}
        />
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
      <ThemedText type="small" style={[styles.count, { color: ink }]}>
        {c.complete ? 'EARNED' : `${c.earned}/${c.target}`}
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
 * with a corner radius renders solid, so the dash would appear on web and
 * Android only — a difference nobody asked for and nobody would see here.
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
        <View style={[styles.rule, { backgroundColor: theme.gold }]} />
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
  cell: { alignItems: 'center', gap: 3 },
  pressed: { opacity: 0.6 },
  ring: { alignItems: 'center', justifyContent: 'center' },
  innerRing: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  freshDot: {
    position: 'absolute',
    top: 0,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
  count: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  page: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pageTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.5 },
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
    // stretches to its neighbour's height and its count drifts off the
    // baseline the rest of the row sits on.
    alignItems: 'flex-start',
  },
});
