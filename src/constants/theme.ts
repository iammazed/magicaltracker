/**
 * MagicalTracker design tokens.
 *
 * `Colors.light` and `Colors.dark` MUST have identical keys — `ThemeColor` is
 * derived from the intersection of both, so a key missing from one silently
 * disappears from the type.
 *
 * Read colors through `useTheme()`, never as literals in a component. A literal
 * that only works in one scheme is the classic unreadable-in-dark-mode bug.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Text — three tiers, deep slate-teal rather than pure black.
    //
    // Only the faintest tier moved when the surfaces below were re-anchored.
    // It was 3.32:1 on white and would have been 2.74:1 on the new ground,
    // which is 11pt meta text nobody could read; this holds 3.28:1 there and
    // improves to 3.83:1 on a card, so the three tiers keep their spacing.
    text: '#12212A',
    textSecondary: '#52666F',
    textFaint: '#6E838B',

    /*
     * Surfaces — tinted paper, with lighter cards floating above it.
     *
     * ## Light mode was white, and that was measurable rather than a matter
     * ## of taste
     *
     * The old pair was a ground of F4F7F7 under cards of pure white. In
     * CIELAB that is 3.0 L* of separation carrying 1.0 chroma — so the cards
     * did not read as cards, and not one surface in the scheme carried any
     * hue at all. Dark mode, by contrast, separates its ground and its card
     * by 8.8 L* at 7.7 chroma, which is why only one of the two schemes ever
     * looked like this app.
     *
     * These values match dark mode's numbers rather than guessing at
     * "warmer": 6.1 L* of separation at 6.5 chroma, held at hue 185–190 so
     * the paper is the brand's teal and not a grey that happens to be green.
     * Cards are no longer pure white either — a 98.5 L* near-white with a
     * trace of the same hue, which keeps the contrast of white without the
     * glare of it.
     *
     * `backgroundSelected` sits 5.8 L* below the ground, because a pressed
     * state on a tinted ground has to travel further than one on white
     * before a thumb notices it.
     */
    background: '#DBEDEA',
    backgroundElement: '#F6FCFB',
    backgroundSelected: '#C5DEDB',

    border: '#C1D7D4',
    // 1.30:1 against a card and 1.11:1 against the ground. The mirrored value
    // was 1.03:1 on the ground — a hairline you could not see at all, which
    // matters because the collapsed filter bar draws one straight onto it.
    borderSoft: '#CEE2DF',

    // Primary action
    accent: '#00807E',
    accentPressed: '#0B7078',
    onAccent: '#FFFFFF',
    // Teal as INK, which is a different job from teal as a fill — the same
    // split `goldText` makes below, for the same reason. The accent is
    // 4.78:1 on a card and 3.93:1 on the ground: fine as a button ground,
    // short of the 4.5:1 an 11pt section heading needs. Darkened to 5.86:1
    // and 5.01:1 with the hue held at 192, so it still reads as the accent.
    //
    // **Every bit of TEXT in a teal uses this one.** `accent` stays the
    // ramp's first stop so a primary button, a stripe and an EPCOT chip are
    // all the same teal; the moment that teal has to be read as a word it
    // comes from here instead. White on an `accent` fill is unaffected at
    // 4.78:1, so buttons were left alone.
    accentText: '#0A6E6B',

    // Reward — achievement unlocks, premium. The warm note the brand ramp lacks.
    //
    // `onGold` is white here, where dark mode's is the sky's deep violet,
    // because light-mode gold is the DARK one of the pair and that violet
    // would be ink on ink.
    //
    // **This pair does not reach 4.5:1 and cannot, which is a KNOWN gap and
    // not a typo.** The comment here used to claim 4.75:1; measured, white on
    // #B07818 is 3.82:1, and the violet that dark mode uses is 4.23:1 on it —
    // light-mode gold sits in the middle of the range, so neither end of the
    // scale clears the bar. The way out is to move the gold, which is a brand
    // colour mirrored to the website and the one hue carrying "earned", so it
    // is not something to change while fixing something else. In practice the
    // affected text is a tick and two 9pt uppercase badges; the gold that sets
    // readable words is `goldText` below, which does clear it.
    gold: '#B07818',
    goldSurface: '#FBF3E0',
    onGold: '#FFFFFF',
    // Gold as INK on a page, which is a different job from gold as a fill.
    // `gold` itself is 3.79:1 on white — fine for a 9px uppercase badge or a
    // button ground, below the 4.5:1 that 14px body text needs.
    //
    // Darkened TWICE now. The first value cleared 4.5:1 against a bare card
    // and was still too pale where it actually appears: a visited dining
    // row's name is gold ON that row's area wash, which took it to 3.9:1.
    // This holds 4.81:1 over the heaviest wash, 5.76:1 on a card and 4.92:1
    // on the ground. In dark mode the fill gold is already 8.06:1, so the
    // two match there.
    goldText: '#865B0D',

    // Semantic — deliberately outside the brand ramp so a destructive
    // confirm never reads as the same violet as a premium badge.
    //
    // Success and warning are each a few percent darker than the values that
    // were chosen against white. Both cleared 4.5:1 on the old ground and
    // landed at 4.37 and 4.27 on this one, which is the kind of regression a
    // surface change makes silently: the colour did not move, the paper
    // under it did. 5.35:1 and 5.24:1 now, and both clear 4.5:1 even on a
    // pressed row. Danger never needed it — it was 6.25:1 and is 5.55:1.
    success: '#1A6B47',
    warning: '#AB380A',
    danger: '#9E3B2E',

    // Brand ramp, teal → violet. Ordered, so it maps onto ordered things:
    // parks, achievement tiers, trip phases. White text only — black fails
    // contrast on all six.
    brandTeal: '#00807E',
    brandTealDeep: '#0B7078',
    brandBlue: '#1A596E',
    brandNavy: '#2B4063',
    brandIndigo: '#342758',
    brandViolet: '#512663',
  },
  dark: {
    text: '#E6EEEE',
    textSecondary: '#9DB2B8',
    textFaint: '#6E858D',

    background: '#0C1418',
    backgroundElement: '#18272E',
    backgroundSelected: '#223540',

    border: '#25383F',
    borderSoft: '#1C2C33',

    accent: '#2FB5AF',
    accentPressed: '#24A0A6',
    onAccent: '#052322',
    // The accent is already 6.10:1 on a dark card and 7.40:1 on the dark
    // ground, so ink and fill are the same colour here. The token still has
    // to exist in both schemes: `ThemeColor` is the intersection of the two.
    accentText: '#2FB5AF',

    gold: '#E5B45F',
    goldSurface: '#2A2313',
    // The terminal stop of SkyGradient, so a gold button reads as cut out of
    // the night sky behind it. 9.0:1 on #E5B45F.
    onGold: '#23133A',
    goldText: '#E5B45F',

    success: '#55C28D',
    warning: '#E8834A',
    danger: '#E58A78',

    // Lightened ~18% from the source palette. The original values are already
    // dark-native and vanish against a dark ground if reused directly.
    brandTeal: '#2FB5AF',
    brandTealDeep: '#24A0A6',
    brandBlue: '#4B94AF',
    brandNavy: '#6D89BC',
    brandIndigo: '#8677B8',
    brandViolet: '#A272BE',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * The brand ramp in order. Index into this to color anything sequential —
 * park chips, achievement tiers, trip phases.
 */
export const BrandRamp = [
  'brandTeal',
  'brandTealDeep',
  'brandBlue',
  'brandNavy',
  'brandIndigo',
  'brandViolet',
] as const satisfies readonly ThemeColor[];

/** Just the ramp tokens, for anything that colours a sequence. */
export type RampToken = (typeof BrandRamp)[number];

/**
 * The twilight gradient, lifted from the website's `.sky`. Dark in BOTH
 * themes on purpose — it is dusk, not a surface. Always use white text on it.
 */
export const SkyGradient = ['#1A596E', '#2B4063', '#342758', '#23133A'] as const;

/**
 * A colour per area, so a park reads the same everywhere it appears — chip,
 * progress bar, venue row stripe. Colour carrying identity rather than
 * decoration is what stops the whole app being one shade of teal.
 *
 * The values are ramp token NAMES, resolved through useTheme() so they flip
 * correctly between light and dark.
 */
export const AreaTone: Record<string, RampToken> = {
  'magic-kingdom': 'brandBlue',
  epcot: 'brandTeal',
  'hollywood-studios': 'brandViolet',
  'animal-kingdom': 'brandTealDeep',
  'disney-springs': 'brandIndigo',
  'typhoon-lagoon': 'brandTeal',
  'blizzard-beach': 'brandBlue',
  boardwalk: 'brandNavy',
  'wide-world-of-sports': 'brandNavy',
  'mk-resort-area': 'brandBlue',
  'epcot-resort-area': 'brandTeal',
  'ak-resort-area': 'brandTealDeep',
  'springs-resort-area': 'brandIndigo',
  'sports-resort-area': 'brandNavy',
};

/** Resort tiers get their own scale, deepening with price. */
export const TierTone: Record<string, RampToken> = {
  value: 'brandTeal',
  moderate: 'brandBlue',
  deluxe: 'brandIndigo',
  villa: 'brandViolet',
  campground: 'brandTealDeep',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii — one scale, so cards and chips stay visually related. */
export const Radius = {
  small: 6,
  medium: 10,
  large: 16,
  pill: 999,
} as const;

// `BottomTabInset` lived here as a hardcoded 50 and was wrong: on iOS the
// tab bar occupies its own height PLUS the bottom safe area, which varies by
// device. Use `useBottomInset()` from `@/hooks/use-bottom-inset` instead.
export const MaxContentWidth = 800;
