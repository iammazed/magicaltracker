import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ShareCard, type ShareSummary } from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { usePassport } from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';
import { tapSaved } from '@/lib/haptics';
import { shareViewAsPng } from '@/lib/share-image';

/**
 * Preview your card, then post it.
 *
 * The preview exists for two reasons, and only one of them is courtesy. The
 * card has to be mounted and drawn for `captureRef` to snapshot it, so a
 * screen that shows it is the reliable way to capture it — see
 * `src/lib/share-image.ts`. The courtesy is the second reason: this image
 * carries a readout of someone's own travel, and nobody should hand that to a
 * share sheet without having looked at it.
 *
 * Free, permanently, and not gated. The card is the only organic acquisition
 * channel the app has; putting it behind the paywall would mean it is only
 * ever posted by people who already paid.
 */
export default function ShareScreen() {
  const theme = useTheme();
  const { loading, overall, resortCoverage, challenges } = usePassport();
  const bottomInset = useBottomInset();
  const { width } = useWindowDimensions();

  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capped so the card does not become a billboard on an iPad, and inset from
  // both edges so it reads as an object on the page rather than the page.
  const cardWidth = Math.min(width - Spacing.three * 2, 380);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  const summary: ShareSummary = {
    pct: overall.pct,
    visited: overall.visited,
    total: overall.total,
    stamps: challenges.filter((c) => c.complete).length,
    stampTotal: challenges.length,
    resorts: resortCoverage.visited,
    resortTotal: resortCoverage.total,
  };

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await shareViewAsPng(cardRef, 'Your MagicalTracker passport');
      tapSaved();
    } catch (e) {
      // Cancelling the share sheet is not an error worth showing, and on iOS
      // it does not reject — but a capture that failed genuinely needs saying,
      // because the alternative is a button that silently does nothing.
      setError(e instanceof Error ? e.message : 'Could not create the image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + Spacing.four },
        ]}
      >
        {/*
          `collapsable={false}` is required. React Native flattens a view that
          has no styling of its own away in the native hierarchy, and a view
          that does not exist natively cannot be snapshotted — the capture
          fails with a null ref that looks like a bug in view-shot.
        */}
        <View ref={cardRef} collapsable={false} style={styles.cardHolder}>
          <ShareCard width={cardWidth} summary={summary} />
        </View>

        <Pressable
          onPress={onShare}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Share your passport as an image"
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.gold,
              opacity: pressed || busy ? 0.75 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.onGold} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: theme.onGold }]}>
              Share this card
            </ThemedText>
          )}
        </Pressable>

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger, textAlign: 'center' }}>
            {error}
          </ThemedText>
        ) : null}

        <ThemedText type="small" themeColor="textFaint" style={styles.note}>
          The image is made on your phone and is not uploaded anywhere. It
          shows only the totals above — never a place, a date or a rating.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    gap: Spacing.four,
    alignItems: 'center',
  },
  cardHolder: { borderRadius: Radius.large, overflow: 'hidden' },
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: Radius.medium,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  note: { textAlign: 'center', lineHeight: 18 },
});
