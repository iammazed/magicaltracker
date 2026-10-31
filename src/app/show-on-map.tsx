import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { CatalogMap } from '@/components/catalog-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useResorts } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { useAreas, useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';
import { resortPlaces, venuePlaces } from '@/lib/map-places';

/**
 * One place on the app's own map, reached from its detail screen.
 *
 * This replaced handing the coordinates to Apple Maps. Apple Maps answers a
 * different question: it knows where the building is and nothing about
 * whether you have eaten there, what else is in walking distance, or which
 * of those you have not tried. Leaving the app to be told "Magic Kingdom
 * Park" was the worst of both — no directions worth having inside a park you
 * cannot drive through, and none of the context the catalog already holds.
 *
 * **The whole catalog is plotted, not the one place.** A single pin on an
 * empty map is a coordinate; the neighbours are the reason to look. Tapping
 * one opens it, so this doubles as "what else is near here".
 *
 * A pushed route rather than a map embedded in the detail screen: mounting a
 * `MapView` is not cheap, and every restaurant you open would pay for one
 * whether or not you looked at it.
 *
 * It is NOT the Dining or Resorts tab with a pin pre-selected. Jumping the
 * user into a tab rewrites which tab they were on, and the back gesture then
 * returns to that tab's list rather than to the restaurant they came from.
 */

export default function ShowOnMapScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const resort = kind === 'resort';

  const venues = useVenues();
  const resorts = useResorts();
  const { data: areas } = useAreas();
  const { byVenue, byResort } = useVisits();

  const areaName = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a.name])),
    [areas],
  );

  const places = useMemo(
    () =>
      resort ? resortPlaces(resorts.data) : venuePlaces(venues.data, areaName),
    [resort, resorts.data, venues.data, areaName],
  );

  const doneIds = useMemo(
    () => new Set(resort ? byResort.keys() : byVenue.keys()),
    [resort, byResort, byVenue],
  );

  const here = places.find((p) => p.id === id);
  const loading = resort ? resorts.loading : venues.loading;

  /**
   * The map must not mount before the catalog has loaded.
   *
   * `CatalogMap` reads `focusId` out of `places` once, on its first render,
   * to frame the opening camera — the alternative, re-framing whenever
   * `places` changes, would yank the camera back from wherever the user had
   * panned to. So an empty first render is a map that opens on the whole of
   * Walt Disney World and never corrects itself.
   */
  if (loading && !here) {
    return (
      <ThemedView style={styles.center}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  if (!here || here.lat == null || here.lng == null) {
    return (
      <ThemedView style={styles.center}>
        <Stack.Screen options={{ title: '' }} />
        <ThemedText type="smallBold">Not on the map</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          The catalog has no location for this place yet.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: here.name }} />
      <CatalogMap
        places={places}
        doneIds={doneIds}
        doneLabel={resort ? 'stayed at' : 'visited'}
        focusId={id}
        // Opening the place you arrived from goes BACK, rather than pushing a
        // second copy of the screen that is already underneath this one.
        // Tapping a neighbour pushes, which is what makes the map a way to
        // find somewhere new rather than a dead end.
        onOpen={(p) => {
          if (p.id === id) {
            router.back();
            return;
          }
          router.push(
            resort
              ? { pathname: '/resort/[id]', params: { id: p.id } }
              : { pathname: '/venue/[id]', params: { id: p.id } },
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  centerText: { textAlign: 'center', maxWidth: 320 },
});
