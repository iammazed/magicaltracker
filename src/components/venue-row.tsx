import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AreaTone, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { VenueListItem } from '@/hooks/use-venues';
import { formatCuisine, formatSubArea } from '@/lib/labels';

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
  visitCount = 0,
  planned,
  onPress,
}: {
  venue: VenueListItem;
  areaName: string;
  /** How many times the user has logged this place. 0 = not visited. */
  visitCount?: number;
  /** Undefined outside trip-planning mode; true/false while choosing. */
  planned?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const service = venue.service_type.map((s) => SERVICE_LABEL[s] ?? s).join(', ');

  // price_tier is 1–4, shown the way Disney shows it.
  const price = '$'.repeat(Math.max(1, Math.min(4, venue.price_tier)));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${venue.name}, ${areaName}` +
        (visitCount ? `, visited ${visitCount} time${visitCount > 1 ? 's' : ''}` : '')
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: theme[AreaTone[venue.area_id] ?? 'brandTeal'] }]} />
      <View style={styles.main}>
        <View style={styles.titleLine}>
          {visitCount > 0 ? (
            <View style={[styles.tick, { backgroundColor: theme.accent }]}>
              <ThemedText style={[styles.tickMark, { color: theme.onAccent }]}>
                {visitCount > 1 ? visitCount : '✓'}
              </ThemedText>
            </View>
          ) : null}
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
          {venue.sub_area ? ` · ${formatSubArea(venue.sub_area)}` : ''}
        </ThemedText>

        <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
          {[formatCuisine(venue.cuisine), service, price]
            .filter(Boolean)
            .join('  ·  ')}
        </ThemedText>
      </View>

      {planned !== undefined ? (
        <View
          style={[
            styles.pick,
            planned
              ? { backgroundColor: theme.gold, borderColor: theme.gold }
              : { borderColor: theme.border },
          ]}
        >
          <ThemedText style={[styles.pickMark, { color: planned ? '#23133A' : theme.textFaint }]}>
            {planned ? '✓' : '+'}
          </ThemedText>
        </View>
      ) : null}
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
    paddingRight: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // A colour per area, so a park reads the same here as on the passport.
  stripe: { width: 5, alignSelf: 'stretch', marginVertical: -Spacing.three },
  main: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flexShrink: 1 },
  badge: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    borderRadius: Radius.small,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  tick: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMark: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  pick: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickMark: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  status: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
