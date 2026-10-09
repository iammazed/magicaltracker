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
    // Text — three tiers, deep slate-teal rather than pure black
    text: '#12212A',
    textSecondary: '#52666F',
    textFaint: '#7D9099',

    // Surfaces — tinted ground, white cards floating above it
    background: '#F4F7F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E4EDED',

    border: '#D9E3E3',
    borderSoft: '#E8EFEF',

    // Primary action
    accent: '#00807E',
    accentPressed: '#0B7078',
    onAccent: '#FFFFFF',

    // Reward — achievement unlocks, premium. The warm note the brand ramp lacks.
    // `onGold` is the only safe text colour on a gold fill. Light-mode gold is
    // DARK (#B07818), so the deep violet ink that works on dark-mode gold has
    // to lighten here or the label goes dark-on-dark. 4.75:1 as written.
    gold: '#B07818',
    goldSurface: '#FBF3E0',
    onGold: '#FFFFFF',

    // Semantic — deliberately outside the brand ramp so a destructive
    // confirm never reads as the same violet as a premium badge.
    success: '#1F7A52',
    warning: '#C2410C',
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

    gold: '#E5B45F',
    goldSurface: '#2A2313',
    // The terminal stop of SkyGradient, so a gold button reads as cut out of
    // the night sky behind it. 9.0:1 on #E5B45F.
    onGold: '#23133A',

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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
