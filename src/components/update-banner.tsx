import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { useTheme } from '@/hooks/use-theme';

/**
 * "A new version is ready — Restart", when an over-the-air update has
 * downloaded.
 *
 * EAS Update's default is to check on launch, download in the background, and
 * apply on the NEXT launch. Left at that, telling a tester "that's fixed" and
 * having them see the fix two cold starts later is indistinguishable from the
 * fix not working — which is the whole value of shipping in thirty seconds
 * instead of thirty minutes, lost to a silent handover.
 *
 * It PROMPTS rather than reloading by itself. `reloadAsync` tears the JS
 * context down, and doing that unasked loses whatever the person was typing —
 * a visit note, a day note, a half-filled trip.
 *
 * At the bottom, not the top, because `AchievementBanner` owns the top and
 * this one persists until it is acted on while that one is transient. Two
 * things sliding into the same space is a collision waiting for the tester
 * who logs a visit that completes a challenge on the day an update lands.
 *
 * Renders nothing in development: `Updates.isEnabled` is false in a dev client
 * and in Expo Go, where the JS comes from Metro and there is nothing to apply.
 */
export function UpdateBanner() {
  const theme = useTheme();
  const bottomInset = useBottomInset();
  const { isUpdatePending } = Updates.useUpdates();
  const [restarting, setRestarting] = useState(false);

  if (!Updates.isEnabled || !isUpdatePending) return null;

  const restart = () => {
    setRestarting(true);
    // No catch that clears the flag: a failed reload leaves the app running
    // the old bundle with the update still pending, so the next launch applies
    // it anyway. Re-enabling the button would invite tapping at something
    // that has already decided not to work.
    void Updates.reloadAsync().catch(() => {});
  };

  return (
    <View style={[styles.wrap, { bottom: bottomInset + Spacing.two }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.backgroundElement, borderColor: theme.gold },
        ]}
      >
        <View style={styles.main}>
          <ThemedText type="smallBold">A new version is ready</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {restarting ? 'Restarting…' : 'Restart to pick it up.'}
          </ThemedText>
        </View>
        <Pressable
          onPress={restart}
          disabled={restarting}
          accessibilityRole="button"
          accessibilityLabel="Restart to apply the new version"
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.gold,
              opacity: pressed || restarting ? 0.7 : 1,
            },
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.onGold }}>
            Restart
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    // Lifts it off whatever it covers, the same way the map's card does.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  main: { flex: 1, gap: 1 },
  action: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
  },
});
