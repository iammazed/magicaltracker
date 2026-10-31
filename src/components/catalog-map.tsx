import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type RampToken } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import {
  clusterPins,
  regionAround,
  WDW_REGION,
  zoomInto,
  type Viewport,
} from '@/lib/cluster';

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
 *
 * `focusId` opens on one place instead of the whole resort. It is one prop
 * rather than a second component because the behaviour the focused view wants
 * is this behaviour: the same pins, the same colours, the same card, the same
 * clustering as you pan away — only the opening camera differs.
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

/**
 * Above this many individual pins on screen, names are hidden.
 *
 * Labelling all 366 is the version of this that nobody can read: at the
 * default framing the dots already touch, and a name on each would be a grey
 * smear across the whole resort. Fourteen is roughly what fits around one
 * park's worth of pins without the labels colliding, and getting below it is
 * one pinch away.
 *
 * Clusters are not counted, and are never labelled — a cluster is several
 * places and has no one name.
 */
const LABEL_MAX = 14;

/**
 * The label's box, fixed, because the marker's ANCHOR is computed from it.
 *
 * A marker is anchored as a fraction of its own view, so adding anything
 * below the dot moves the dot off the coordinate unless the anchor moves with
 * it. Both numbers therefore have to be known up front, which is also why the
 * text is one line with `allowFontScaling` off: a label that grew with the
 * system font size would silently drag every pin north of where it belongs.
 */
const LABEL_H = 15;
const LABEL_GAP = 1;
const LABEL_W = 96;

/** Centre of the dot, as a fraction of the whole marker view. */
const LABELLED_ANCHOR = {
  x: 0.5,
  y: PIN_HIT / 2 / (PIN_HIT + LABEL_GAP + LABEL_H),
};
const PLAIN_ANCHOR = { x: 0.5, y: 0.5 };

export function CatalogMap({
  places,
  doneIds,
  doneLabel,
  onOpen,
  focusId,
}: {
  places: MapPlace[];
  /** Ids the user has logged — visited venues, or resorts stayed at. */
  doneIds: Set<string>;
  /** "visited" / "stayed at", for the count badge and the card. */
  doneLabel: string;
  onOpen: (place: MapPlace) => void;
  /** Open zoomed to this place with its card already up, rather than on the
   *  whole of Walt Disney World. */
  focusId?: string | null;
}) {
  const theme = useTheme();
  const bottomInset = useBottomInset();
  const mapRef = useRef<MapView | null>(null);

  /**
   * Computed once, from the first render's props.
   *
   * It has to seed BOTH `initialRegion` and `viewport`, not just the map:
   * `viewport` is what the clustering reads, and `onRegionChangeComplete`
   * fires after a change rather than on mount. Seeding only the map would
   * cluster the first frame as though it were still showing all four parks.
   *
   * `useState`'s initialiser rather than `useMemo` because this is the
   * opening camera, not derived state. A `places` array that arrives late —
   * which it does, the catalog is an async read — must not re-frame a map the
   * user has already panned.
   */
  const [opening] = useState<Viewport>(() => {
    const at = focusId ? places.find((p) => p.id === focusId) : null;
    return at?.lat != null && at.lng != null
      ? regionAround(at.lat, at.lng)
      : WDW_REGION;
  });
  const [viewport, setViewport] = useState<Viewport>(opening);
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);

  const pins = useMemo(
    () => clusterPins(places, viewport, focusId),
    [places, viewport, focusId],
  );

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

  /** Names appear only once there are few enough to read. Counted from the
   *  pins actually on screen rather than from `places`, so it follows the
   *  zoom rather than the size of the catalog. */
  const showLabels = useMemo(() => {
    const n = pins.reduce((a, p) => a + (p.kind === 'pin' ? 1 : 0), 0);
    return n > 0 && n <= LABEL_MAX;
  }, [pins]);

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
        initialRegion={opening}
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
              // The selected pin grows, so it needs one more render pass. A
              // label appearing or disappearing changes the view too, which is
              // why `showLabels` is in here as well — without it the marker
              // keeps the snapshot it was first drawn with and the name never
              // turns up until something else redraws it.
              tracksViewChanges={pin.item.id === selectedId || showLabels}
              anchor={showLabels ? LABELLED_ANCHOR : PLAIN_ANCHOR}
            >
              <PlacePin
                place={pin.item}
                done={doneIds.has(pin.item.id)}
                selected={pin.item.id === selectedId}
                labelled={showLabels}
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
  labelled,
}: {
  place: MapPlace;
  done: boolean;
  selected: boolean;
  labelled: boolean;
}) {
  const theme = useTheme();
  const tone = theme[place.tone];

  // Done is a filled pin with a tick; not-yet is a hollow ring in the same
  // colour. Shape carries the state as well as colour does, so it still reads
  // for anyone who cannot tell the two hues apart.
  // The dot sits inside a transparent box, so the tap target is a finger
  // rather than 18 points. The marker is anchored at its centre either way.
  // The dot keeps its own fixed 34pt box whether or not there is a label, so
  // the pin's size and hit area never depend on the name under it.
  return (
    <View style={labelled ? styles.pinWithLabel : undefined}>
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
      {labelled ? (
        <View
          style={[
            styles.label,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          {/* A chip rather than bare text: a map's imagery is light in some
              places and dark in others, and plain type over it is legible in
              only one of them. */}
          <ThemedText
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.labelText, { color: theme.text }]}
          >
            {place.name}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  pinWithLabel: { width: LABEL_W, alignItems: 'center' },
  pinHit: {
    width: PIN_HIT,
    height: PIN_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    height: LABEL_H,
    marginTop: LABEL_GAP,
    maxWidth: LABEL_W,
    paddingHorizontal: 5,
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labelText: { fontSize: 10, fontWeight: '600', lineHeight: 13 },
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
