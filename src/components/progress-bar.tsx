import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A labelled coverage bar.
 *
 * The fill is the brand ramp indexed by position, which is the one place that
 * ordering carries meaning — parks read as a sequence rather than a palette.
 */
export function ProgressBar({
  label,
  visited,
  total,
  tone,
}: {
  label: string;
  visited: number;
  total: number;
  /** A brand-ramp token, e.g. 'brandBlue'. Defaults to the accent. */
  tone?: 'brandTeal' | 'brandTealDeep' | 'brandBlue' | 'brandNavy' | 'brandIndigo' | 'brandViolet';
}) {
  const theme = useTheme();
  const pct = total ? visited / total : 0;
  const complete = total > 0 && visited === total;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ThemedText type="small" numberOfLines={1} style={styles.label}>
          {label}
        </ThemedText>
        <ThemedText
          type="small"
          style={{ color: complete ? theme.gold : theme.textFaint }}
        >
          {visited}/{total}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(pct * 100)}%`,
              backgroundColor: complete ? theme.gold : theme[tone ?? 'accent'],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  label: { flexShrink: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
