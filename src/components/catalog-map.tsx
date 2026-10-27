import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type RampToken } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { clusterPins, WDW_REGION, zoomInto, type Viewport } from '@/lib/cluster';

/**
 * The map view of the catalog — venues or resorts.
 *
 * Deliberately knows nothing about either. Callers map their own rows to
 * `MapPlace`, which is why Resorts got a map for about thirty lines rather
 * than a second copy of this file: the only real differences were which
 * colour map to index and which two strings go on the card, and both are the
 * caller's business.
 *
 * Apple Maps, via `PROVIDER_DEFAULT`. That is not a placeholder for Google
 * Maps: Apple Maps needs no API key and runs inside Expo Go, so the map works
 * before the Apple Developer Program enrollment clears. Styled Google Maps
 * needs a key wired through a config plugin, which needs a development build,
 * which needs the paid account.
 *
 * Tapping a pin selects it and raises a card rather than pushing straight to
 * the detail screen. Pins are small and fingers are not, so a mis-tap that
 * navigates is a mis-tap you have to undo.
 */

export type MapPlace = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Which ramp colour this place belongs to — `AreaTone` for a venue,
   *  `TierTone` for a resort. Resolved by the caller so this file does not
   *  need to know which taxonomy applies. */
  tone: RampToken;
  /** Area, or tier. */
  line1?: string;
  /** Cuisine and price, or transport. */
  line2?: string;
};

/** Markers with custom children re-render continuously unless this is off,
 *  which is the difference between a smooth map and a visibly stuttering one.
 *  It is set per-marker below rather than here, because a freshly selected
 *  marker does need one more frame to redraw. */
const STATIC_MARKERS = false;

/**
 * How long after a marker press a map press is still part of the same tap.
 *
 * See `onMapPress` below. 100ms is comfortably longer than the gap between
 * two gesture recognizers firing for one touch, and far shorter than the gap
 * between two deliberate taps.
 */
const SAME_TAP_MS = 100;

/** A transparent 34pt box around an 18pt dot. Apple asks for 44pt targets and
 *  an 18pt pin is less than half that, but 44 would have neighbouring pins
 *  overlapping each other's hit areas at the closest zoom. */
const PIN_HIT = 34;

export function CatalogMap({
  places,
  doneIds,
  doneLabel,
  onOpen,
}: {
  places: MapPlace[];
  /** Ids the user has logged — visited venues, or resorts stayed at. */
  doneIds: Set<string>;
  /** "visited" / "stayed at", for the count badge and the card. */
  doneLabel: string;
  onOpen: (place: MapPlace) => void;
}) {
  const theme = useTheme();
  const bottomInset = useBottomInset();
  const mapRef = useRef<MapView | null>(null);
  const [viewport, setViewport] = useState<Viewport>(WDW_REGION);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pins = useMemo(() => clusterPins(places, viewport), [places, viewport]);

  /**
   * One tap on a pin fires TWO native handlers, and nothing orders them.
   *
   * On Apple Maps the marker has its own tap recognizer, and the map's runs
   * alongside it — `cancelsTouchesInView = NO`, with
   * `shouldRecognizeSimultaneouslyWithGestureRecognizer` returning YES and no
   * check anywhere for whether the tap landed on an annotation. So
   * `MapView.onPress` fires when you tap a pin, not only when you tap bare
   * map. It cleared the selection in the same batch that the marker set it,
   * which is why tapping a pin did nothing at all: the card was selected and
   * deselected before anything rendered.
   *
   * `stopPropagation` on the marker closes the React-level bubble, which is
   * one of the two routes to `MapView.onPress`. The map's own recognizer is
   * the other and no JS can stop it, so the map press has to work out whether
   * it was really a tap on bare map. It defers a tick and backs off if a
   * marker claimed the same tap — which holds whichever order the two arrive
   * in, rather than relying on the one observed on this device.
   */
  const markerTapAt = useRef(0);

  const selectPlace = useCallback((id: string) => {
    markerTapAt.current = Date.now();
    setSelectedId(id);
  }, []);

  const onMapPress = useCallback(() => {
    const at = Date.now();
    setTimeout(() => {
      if (markerTapAt.current >= at - SAME_TAP_MS) return;
      setSelectedId(null);
    }, SAME_TAP_MS);
  }, []);

  const selected = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId],
  );

  const doneShown = useMemo(
    () => places.filter((p) => doneIds.has(p.id)).length,
    [places, doneIds],
  );

  const zoom = useCallback(
    (lat: number, lng: number) => {
      mapRef.current?.animateToRegion(zoomInto(viewport, lat, lng), 280);
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
        // any other transient surface does. Via `onMapPress`, because a tap
        // on a pin lands here too.
        onPress={onMapPress}
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
              onPress={() => selectPlace(pin.item.id)}
              // Keeps this press from also arriving at the map's `onPress` as
              // a React bubble. Apple Maps only, which is the provider here;
              // Android never propagates marker presses.
              stopPropagation
              // The selected pin grows, so it needs one more render pass.
              tracksViewChanges={pin.item.id === selectedId}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <PlacePin
                place={pin.item}
                done={doneIds.has(pin.item.id)}
                selected={pin.item.id === selectedId}
              />
            </Marker>
          ),
        )}
      </MapView>

      {/* Counts, because "how much of this have I done?" is the question the
          map exists to answer at a glance. */}
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      >
        <ThemedText type="small" themeColor="textSecondary">
          {doneShown} of {places.length} {doneLabel}
        </ThemedText>
      </View>

      {selected ? (
        <Pressable
          onPress={() => onOpen(selected)}
          accessibilityRole="button"
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              bottom: bottomInset + Spacing.two,
            },
          ]}
        >
          <View style={[styles.cardBar, { backgroundColor: theme[selected.tone] }]} />
          <View style={styles.cardMain}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {selected.name}
            </ThemedText>
            {selected.line1 ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {selected.line1}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
              {[selected.line2, doneIds.has(selected.id) ? `Already ${doneLabel}` : null]
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

function PlacePin({
  place,
  done,
  selected,
}: {
  place: MapPlace;
  done: boolean;
  selected: boolean;
}) {
  const theme = useTheme();
  const tone = theme[place.tone];

  // Done is a filled pin with a tick; not-yet is a hollow ring in the same
  // colour. Shape carries the state as well as colour does, so it still reads
  // for anyone who cannot tell the two hues apart.
  // The dot sits inside a transparent box, so the tap target is a finger
  // rather than 18 points. The marker is anchored at its centre either way.
  return (
    <View style={styles.pinHit}>
      <View
        style={[
          styles.pin,
          selected && styles.pinSelected,
          done
            ? { backgroundColor: tone, borderColor: theme.background }
            : { backgroundColor: theme.background, borderColor: tone },
        ]}
      >
        {done ? (
          <ThemedText style={[styles.pinMark, { color: theme.onAccent }]}>✓</ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  pinHit: {
    width: PIN_HIT,
    height: PIN_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    // `bottom` is set inline from `useBottomInset()`: the map is not a scroll
    // view, so it gets no automatic inset, and the tab bar's real height
    // depends on the device's safe area.
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
