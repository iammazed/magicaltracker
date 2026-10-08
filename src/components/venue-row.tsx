import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { VenueListItem } from '@/hooks/use-venues';

/** Shorthand a Disney guest already reads fluently. */
const SERVICE_LABEL: Record<string, string> = {
  quick: 'Quick service',
  table: 'Table service',
  lounge: 'Lounge',
  snack: 'Snack',
};

export function VenueRow({
  venue,
  areaName,
  onPress,
}: {
  venue: VenueListItem;
  areaName: string;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const service = venue.service_type
    .map((s) => SERVICE_LABEL[s] ?? s)
    .join(' · ');

  // price_tier is 1–4, shown the way Disney shows it.
  const price = '$'.repeat(Math.max(1, Math.min(4, venue.price_tier)));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${areaName}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.main}>
        <View style={styles.titleLine}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
            {venue.name}
          </ThemedText>
          {venue.is_signature ? (
            <View style={[styles.badge, { backgroundColor: theme.goldSurface }]}>
              <ThemedText type="small" style={[styles.badgeText, { color: theme.gold }]}>
                SIGNATURE
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {areaName}
          {venue.sub_area ? ` · ${venue.sub_area.replace(/-/g, ' ')}` : ''}
        </ThemedText>

        <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
          {[venue.cuisine, service, price].filter(Boolean).join('  ·  ')}
        </ThemedText>
      </View>

      {venue.status !== 'open' ? (
        <View style={[styles.status, { borderColor: theme.warning }]}>
          <ThemedText type="small" style={{ color: theme.warning }}>
            {venue.status === 'seasonal' ? 'Seasonal' : 'Closed'}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flexShrink: 1 },
  badge: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    borderRadius: Radius.small,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  status: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
