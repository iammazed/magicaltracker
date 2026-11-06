import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ItineraryCard } from '@/components/itinerary-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { useTrips } from '@/hooks/use-trips';
import { useAreas, useVenues } from '@/hooks/use-venues';
import { useResorts } from '@/hooks/use-resorts';
import { tapPicked, tapSaved } from '@/lib/haptics';
import { getSetting, setSetting } from '@/lib/local-db';
import { shareViewAsPng } from '@/lib/share-image';
import { buildItinerary, itineraryText } from '@/lib/trip-share';

/** Whether the dining list rides along. Remembered, because it is a habit
 *  rather than a decision — some people share plans, some share schedules. */
const DINING_KEY = 'trip_share_dining';

/**
 * Share a trip, as a picture or as text.
 *
 * ## Why both, rather than picking one
 *
 * They are not two renderings of one thing; they are for two different
 * messages. The poster is for "look where we are going" — it is the sky
 * gradient, it carries the wordmark, and it is the only acquisition channel
 * the app has that costs nothing. The text is for "here is the plan": it
 * pastes into the group chat where the trip is actually being organised, it
 * can be read by somebody who has never heard of this app, and a restaurant
 * name can be copied straight out of it to go and book.
 *
 * Offering only the image would have been the prettier choice and the wrong
 * one. An itinerary's job is to be acted on.
 *
 * ## The preview is load-bearing
 *
 * `captureRef` snapshots what the render server drew, so the card has to be
 * mounted and visible — see `src/lib/share-image.ts`. The preview is not
 * courtesy, it is the mechanism. The courtesy is that a trip itinerary names
 * where a family will be on a given evening, and nobody should hand that to
 * a share sheet without having looked at it first.
 */
export default function TripShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const db = useSQLiteContext();
  const bottomInset = useBottomInset();
  const { width } = useWindowDimensions();

  const { trips, plansFor, daysFor } = useTrips();
  const { data: venues } = useVenues();
  const { data: areas } = useAreas();
  const { data: resorts } = useResorts();

  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState<'image' | 'text' | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Null until the stored choice is read, so the card does not render one
   *  shape and swap to the other a frame later. */
  const [includeDining, setIncludeDining] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const raw = await getSetting(db, DINING_KEY);
      // Absent means never chosen, and the dining list is the more useful
      // default: it is the half of a trip plan people actually compare.
      if (alive) setIncludeDining(raw === null ? true : raw === '1');
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  const trip = trips.find((t) => t.id === id) ?? null;

  const lookups = useMemo(() => {
    const v = new Map(venues.map((x) => [x.id, x.name]));
    const a = new Map(areas.map((x) => [x.id, x.name]));
    const r = new Map(resorts.map((x) => [x.id, x.name]));
    return {
      venueName: (vid: string) => v.get(vid),
      areaName: (aid: string) => a.get(aid),
      resortName: (rid: string) => r.get(rid),
    };
  }, [venues, areas, resorts]);

  const itinerary = useMemo(
    () =>
      trip
        ? buildItinerary({
            trip,
            days: daysFor(trip.id),
            plans: plansFor(trip.id),
            ...lookups,
          })
        : null,
    [trip, daysFor, plansFor, lookups],
  );

  const toggleDining = useCallback(() => {
    setIncludeDining((prev) => {
      const next = !prev;
      void setSetting(db, DINING_KEY, next ? '1' : '0');
      if (next) tapSaved();
      else tapPicked();
      return next;
    });
  }, [db]);

  const onShareImage = async () => {
    if (busy) return;
    setBusy('image');
    setError(null);
    try {
      await shareViewAsPng(cardRef, 'Your trip');
      tapSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the image.');
    } finally {
      setBusy(null);
    }
  };

  const onShareText = async () => {
    if (busy || !itinerary) return;
    setBusy('text');
    setError(null);
    try {
      // React Native's own `Share`, not `expo-sharing`: expo-sharing shares a
      // FILE, and there is no file here. This is the sheet that offers
      // Messages, Mail and Copy for a string.
      await Share.share({ message: itineraryText(itinerary, { includeDining: !!includeDining }) });
      tapSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the share sheet.');
    } finally {
      setBusy(null);
    }
  };

  if (!trip || !itinerary || includeDining === null) {
    return (
      <ThemedView style={styles.center}>
        <Stack.Screen options={{ title: 'Share' }} />
        {trip === null && trips.length > 0 ? (
          <ThemedText type="smallBold">Trip not found</ThemedText>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </ThemedView>
    );
  }

  const cardWidth = Math.min(width - Spacing.three * 2, 380);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Share' }} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + Spacing.four }]}
      >
        {/*
          `collapsable={false}` is required. React Native flattens a view with
          no styling of its own out of the native hierarchy, and a view that
          does not exist natively cannot be snapshotted — the capture fails
          with a null ref that looks like a bug in view-shot.
        */}
        <View ref={cardRef} collapsable={false} style={styles.cardHolder}>
          <ItineraryCard width={cardWidth} itinerary={itinerary} includeDining={includeDining} />
        </View>

        <Pressable
          onPress={toggleDining}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeDining }}
          accessibilityLabel="Include the dining list"
          style={({ pressed }) => [
            styles.toggle,
            {
              borderColor: includeDining ? theme.accent : theme.border,
              backgroundColor: includeDining ? theme.backgroundSelected : theme.backgroundElement,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.tick,
              includeDining
                ? { backgroundColor: theme.accent }
                : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
            ]}
          >
            {includeDining ? (
              <ThemedText style={[styles.tickMark, { color: theme.onAccent }]}>✓</ThemedText>
            ) : null}
          </View>
          <View style={styles.toggleMain}>
            <ThemedText type="smallBold">Include the dining list</ThemedText>
            <ThemedText type="small" themeColor="textFaint">
              {itinerary.mealCount === 0
                ? 'Nothing planned to eat yet'
                : `${itinerary.mealCount} ${itinerary.mealCount === 1 ? 'meal' : 'meals'}, ${itinerary.bookedCount} booked`}
            </ThemedText>
          </View>
        </Pressable>

        <View style={styles.buttons}>
          <Pressable
            onPress={onShareImage}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel="Share this trip as an image"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.gold, opacity: pressed || busy ? 0.75 : 1 },
            ]}
          >
            {busy === 'image' ? (
              <ActivityIndicator color={theme.onGold} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.onGold }]}>
                Share the card
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={onShareText}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel="Share this trip as text"
            style={({ pressed }) => [
              styles.button,
              styles.buttonQuiet,
              { borderColor: theme.border, opacity: pressed || busy ? 0.75 : 1 },
            ]}
          >
            {busy === 'text' ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.text }]}>
                Share as text
              </ThemedText>
            )}
          </Pressable>
        </View>

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger, textAlign: 'center' }}>
            {error}
          </ThemedText>
        ) : null}

        <ThemedText type="small" themeColor="textFaint" style={styles.note}>
          Both are made on your phone and nothing is uploaded. The text version
          pastes into a message and can be read by anyone — they do not need
          the app.
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

  toggle: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleMain: { flex: 1, gap: 1 },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tickMark: { fontSize: 12, fontWeight: '700', lineHeight: 16 },

  buttons: { alignSelf: 'stretch', gap: Spacing.two },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: Radius.medium,
  },
  buttonQuiet: { borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'transparent' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  note: { textAlign: 'center', lineHeight: 18 },
});
