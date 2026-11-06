import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ShareCard } from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { usePassport } from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';
import { tapPicked, tapSaved } from '@/lib/haptics';
import { getSetting, setSetting } from '@/lib/local-db';
import {
  MAX_SHARE_STATS,
  SHARE_STATS_KEY,
  parseShareStats,
  resolveShareStats,
  shareStatOptions,
} from '@/lib/share-stats';
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
 *
 * ## The chooser
 *
 * Which stats go on the card is the sharer's call, taken here, with the card
 * visible above it so every tap can be seen landing. That is the whole reason
 * it lives on this screen rather than in Settings: picking numbers for an
 * image you cannot see is guesswork, and a preference buried two taps from
 * the thing it affects is a preference nobody finds.
 */
export default function ShareScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { loading, overall, resortCoverage, byArea, challenges } = usePassport();
  const bottomInset = useBottomInset();
  const { width } = useWindowDimensions();

  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Null until the stored choice has been read.
   *
   * The distinction matters: rendering the default while the real choice is
   * still in flight would show the wrong card for a frame and then swap it,
   * which on the screen whose entire job is "look at this before you post it"
   * is the one flicker worth preventing.
   */
  const [chosen, setChosen] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const raw = await getSetting(db, SHARE_STATS_KEY);
      if (alive) setChosen(parseShareStats(raw));
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  // Capped so the card does not become a billboard on an iPad, and inset from
  // both edges so it reads as an object on the page rather than the page.
  const cardWidth = Math.min(width - Spacing.three * 2, 380);

  const options = useMemo(
    () => shareStatOptions({ overall, resortCoverage, byArea, challenges }),
    [overall, resortCoverage, byArea, challenges],
  );

  const toggle = useCallback(
    (id: string) => {
      setChosen((prev) => {
        const list = prev ?? [];
        const has = list.includes(id);
        /**
         * At the cap, a new pick DROPS THE OLDEST rather than refusing.
         *
         * A disabled fourth chip is the obvious alternative and it is worse:
         * someone who wants Months instead of Resorts has to work out that
         * they must first deselect something, and a chip that does nothing
         * when tapped reads as broken. Rolling the window means every tap
         * does what it looks like it does.
         */
        const next = has
          ? list.filter((x) => x !== id)
          : [...list, id].slice(-MAX_SHARE_STATS);

        void setSetting(db, SHARE_STATS_KEY, JSON.stringify(next));
        if (has) tapPicked();
        else tapSaved();
        return next;
      });
    },
    [db],
  );

  if (loading || chosen === null) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  const stats = resolveShareStats(options, chosen);

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
          <ShareCard width={cardWidth} pct={overall.pct} stats={stats} />
        </View>

        <View style={styles.chooser}>
          <View style={styles.chooserHead}>
            <ThemedText type="smallBold">What goes on it</ThemedText>
            <ThemedText type="small" themeColor="textFaint">
              {stats.length === 0
                ? 'Just the ring'
                : `${stats.length} of ${MAX_SHARE_STATS}`}
            </ThemedText>
          </View>

          <View style={styles.chips}>
            {options.map((st) => {
              const on = chosen.includes(st.id);
              return (
                <Pressable
                  key={st.id}
                  onPress={() => toggle(st.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${st.label.toLowerCase()}, ${st.value}`}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: on ? theme.accent : theme.border,
                      backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: on ? theme.accent : theme.textSecondary }}
                  >
                    {/* The value, not just the name. Someone choosing between
                        Places and Months is choosing between 48 and 9 of 12,
                        and the chip that hides the number makes them pick it,
                        look at the card, and come back. */}
                    {on ? '✓ ' : ''}
                    {title(st.label)} · {st.value}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
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
          shows only the totals you picked — never a place, a date or a rating.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

/** "OF THE WORLD" → "Of the world". The card wants all caps and a chip in a
 *  sentence does not. */
function title(label: string): string {
  const lower = label.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
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
  chooser: { alignSelf: 'stretch', gap: Spacing.two },
  chooserHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
