import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { FEATURE_COPY, usePremium, type PremiumFeature } from '@/hooks/use-premium';
import { useTheme } from '@/hooks/use-theme';

/**
 * Wraps a premium feature.
 *
 * Premium users get the children. Everyone else gets a labelled, tappable
 * placeholder that opens the paywall with this feature named, so the pitch
 * opens with the thing they were actually reaching for.
 *
 * It shows what is behind the gate rather than hiding it. A feature nobody can
 * see is a feature nobody buys, and a locked field with a clear label reads as
 * an upgrade while a field that silently vanishes reads as a bug.
 */
export function PremiumGate({
  feature,
  children,
}: {
  feature: PremiumFeature;
  children: React.ReactNode;
}) {
  const { isPremium } = usePremium();
  if (isPremium) return <>{children}</>;
  return <PremiumTeaser feature={feature} />;
}

export function PremiumTeaser({ feature }: { feature: PremiumFeature }) {
  const theme = useTheme();
  const router = useRouter();
  const copy = FEATURE_COPY[feature];

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/paywall', params: { feature } })}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}, premium. Opens upgrade options.`}
      style={({ pressed }) => [
        styles.teaser,
        {
          backgroundColor: theme.goldSurface,
          borderColor: theme.gold,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.main}>
        <View style={styles.titleLine}>
          <ThemedText type="smallBold">{copy.title}</ThemedText>
          <View style={[styles.badge, { backgroundColor: theme.gold }]}>
            <ThemedText style={[styles.badgeText, { color: theme.onGold }]}>
              PREMIUM
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {copy.blurb}
        </ThemedText>
      </View>
      <ThemedText type="small" style={{ color: theme.gold }}>
        Unlock
      </ThemedText>
    </Pressable>
  );
}

/** The inline version, for a row that already has its own label. */
export function PremiumBadge() {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.gold }]}>
      <ThemedText style={[styles.badgeText, { color: theme.onGold }]}>PREMIUM</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    borderRadius: Radius.small,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
});
