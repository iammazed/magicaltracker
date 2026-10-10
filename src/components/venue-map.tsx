import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { AreaTone, BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { VenueListItem } from '@/hooks/use-venues';
import { clusterPins, WDW_REGION, zoomInto, type Viewport } from '@/lib/cluster';
import { formatCuisine, formatSubArea } from '@/lib/labels';

/**
 * The map view of the catalog.
 *
 * Apple Maps, via `PROVIDER_DEFAULT`. That is not a placeholder for Google
 * Maps: Apple Maps needs no API key and runs inside Expo Go, so the map can
 * be built and tested before the Apple Developer Program enrollment clears.
 * Styled Google Maps needs a key wired through a config plugin, which needs a
 * development build, which needs the paid account.
 *
 * Tapping a pin selects it and raises a card rather than pushing straight to
 * the detail screen. Pins are small and fingers are not, so a mis-tap that
 * navigates is a mis-tap you have to undo.
 */

/** Markers with custom children re-render continuously unless this is off,
 *  which is the difference between a smooth map and a visibly stuttering one.
 *  It is set per-marker below rather than here, because a freshly selected
 *  marker does need one more frame to redraw. */
const STATIC_MARKERS = false;

export function VenueMap({
  venues,
  visitedIds,
  areaName,
  onOpen,
}: {
  venues: VenueListItem[];
  visitedIds: Set<string>;
  areaName: (id: string) => string;
  onOpen: (venue: VenueListItem) => void;
}) {
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const [viewport, setViewport] = useState<Viewport>(WDW_REGION);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pins = useMemo(() => clusterPins(venues, viewport), [venues, viewport]);

  const selected = useMemo(
    () => venues.find((v) => v.id === selectedId) ?? null,
    [venues, selectedId],
  );

  const visitedShown = useMemo(
    () => venues.filter((v) => visitedIds.has(v.id)).length,
    [venues, visitedIds],
  );

  const zoom = useCallback(
    (lat: number, lng: number) => {
      const next = zoomInto(viewport, lat, lng);
      mapRef.current?.animateToRegion(next, 280);
    },
    [viewport],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={WDW_REGION}
        onRegionChangeComplete={setViewport}
        // Tapping bare map dismisses the card, the same way tapping outside
        // any other transient surface does.
        onPress={() => setSelectedId(null)}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {pins.map((pin) =>
          pin.kind === 'cluster' ? (
            <Marker
              key={pin.key}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              onPress={() => zoom(pin.lat, pin.lng)}
              tracksViewChanges={STATIC_MARKERS}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.cluster,
                  { backgroundColor: theme.brandBlue, borderColor: theme.background },
                ]}
              >
                <ThemedText style={[styles.clusterCount, { color: theme.onAccent }]}>
                  {pin.count}
                </ThemedText>
              </View>
            </Marker>
          ) : (
            <Marker
              key={pin.key}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              onPress={() => setSelectedId(pin.item.id)}
              // The selected pin grows, so it needs one more render pass.
              tracksViewChanges={pin.item.id === selectedId}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <VenuePin
                venue={pin.item}
                visited={visitedIds.has(pin.item.id)}
                selected={pin.item.id === selectedId}
              />
            </Marker>
          ),
        )}
      </MapView>

      {/* Counts, because "how much of this park have I done?" is the question
          the map exists to answer at a glance. */}
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      >
        <ThemedText type="small" themeColor="textSecondary">
          {visitedShown} of {venues.length} visited
        </ThemedText>
      </View>

      {selected ? (
        <Pressable
          onPress={() => onOpen(selected)}
          accessibilityRole="button"
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.cardBar,
              { backgroundColor: theme[AreaTone[selected.area_id] ?? 'brandTeal'] },
            ]}
          />
          <View style={styles.cardMain}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {selected.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {areaName(selected.area_id)}
              {selected.sub_area ? ` · ${formatSubArea(selected.sub_area)}` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
              {[
                formatCuisine(selected.cuisine),
                '$'.repeat(Math.max(1, Math.min(4, selected.price_tier))),
                visitedIds.has(selected.id) ? 'Visited' : null,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.accent }}>
            Open
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function VenuePin({
  venue,
  visited,
  selected,
}: {
  venue: VenueListItem;
  visited: boolean;
  selected: boolean;
}) {
  const theme = useTheme();
  const tone = theme[AreaTone[venue.area_id] ?? 'brandTeal'];

  // Visited is a filled pin with a tick; unvisited is a hollow ring in the
  // same area colour. Shape carries the state as well as colour does, so it
  // still reads for anyone who cannot tell the two hues apart.
  return (
    <View
      style={[
        styles.pin,
        selected && styles.pinSelected,
        visited
          ? { backgroundColor: tone, borderColor: theme.background }
          : { backgroundColor: theme.background, borderColor: tone },
      ]}
    >
      {visited ? (
        <ThemedText style={[styles.pinMark, { color: theme.onAccent }]}>✓</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: { width: 26, height: 26, borderRadius: 13 },
  pinMark: { fontSize: 10, fontWeight: '700', lineHeight: 13 },
  cluster: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: Spacing.one,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterCount: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    // The map is not a scroll view, so it gets none of the automatic content
    // inset the tab bar applies to the list. Without this the card sits behind
    // the tab bar.
    bottom: BottomTabInset + Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingRight: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardBar: { width: 5, alignSelf: 'stretch' },
  cardMain: { flex: 1, paddingVertical: Spacing.three, gap: 2 },
});
