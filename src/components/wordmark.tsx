import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * The wordmark, native twin of `web/components/wordmark.tsx`.
 *
 * Three parts, each an exact multiple of one base size:
 *
 *   M       Berkshire Swash  1.600x   upright swashed initial
 *   agical  Pacifico         1.111x   x-height matched to Figtree
 *   Tracker Figtree semibold 1.000x
 *
 * The 1.111 is measured against Figtree, not eyeballed — Pacifico's lowercase
 * a and c render 95 units tall against Figtree's 106 and 105, so equal
 * font-sizes leave the script visibly short. That is why `Tracker` is set in
 * bundled Figtree rather than the system face: swap it for SF Pro and the
 * measurement no longer holds, so the bowls stop lining up.
 *
 * The web file writes these as `em` off a wrapper; React Native has no `em`,
 * so the ratios are multiplied against `size` here. Change a ratio in one file
 * and you must change it in the other — they are the same mark.
 */

/** Base size in points. Every part is a multiple of this. */
const SIZES = {
  sm: 17,
  md: 21,
  lg: 34,
} as const;

const INITIAL = 1.6;
const SCRIPT = 1.111;

export function Wordmark({
  size = 'md',
  /** `gold` is the sanctioned brand use. See AGENTS.md. */
  scriptColor,
  restColor,
}: {
  size?: keyof typeof SIZES;
  scriptColor?: string;
  restColor?: string;
}) {
  const theme = useTheme();
  const base = SIZES[size];
  const script = scriptColor ?? theme.gold;
  const rest = restColor ?? theme.text;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="MagicalTracker"
    >
      <Text
        style={{
          fontFamily: 'BerkshireSwash_400Regular',
          fontSize: base * INITIAL,
          color: script,
        }}
      >
        M
      </Text>
      <Text
        style={{
          fontFamily: 'Pacifico_400Regular',
          fontSize: base * SCRIPT,
          color: script,
          // Mirrors the 0.01em / 0.11em optical nudges on the web lockup.
          marginLeft: base * 0.01,
          marginRight: base * 0.11,
        }}
      >
        agical
      </Text>
      <Text
        style={{
          fontFamily: 'Figtree_600SemiBold',
          fontSize: base,
          color: rest,
          letterSpacing: -0.3,
        }}
      >
        Tracker
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Baseline alignment is what makes the three faces read as one word rather
  // than three pasted fragments.
  row: { flexDirection: 'row', alignItems: 'baseline' },
});
