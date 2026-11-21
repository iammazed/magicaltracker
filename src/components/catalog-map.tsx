import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type MapPressEvent,
  type MKPointOfInterestCategoryType,
} from 'react-native-maps';

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
import { tapPicked } from '@/lib/haptics';
import { getSetting, setSetting } from '@/lib/local-db';

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

/**
 * Which base layer the map draws, and the preference is remembered.
 *
 * `imagery` is `mapType="hybrid"` — Apple's aerial photography with its label
 * layer over the top — and it is the default because of what this map is of.
 * Walt Disney World is private land, so Apple's vector tiles carry very few
 * named building footprints inside it; the standard map at park zoom is a
 * handful of beige and green polygons with road lines through them, and the
 * thing that would normally say "that is the Contemporary" is a POI label.
 * From the air the parks are unmistakable, which is the actual question
 * somebody has when they open a map of a resort they are standing in.
 *
 * `standard` stays one tap away rather than being removed. Imagery is heavier
 * to fetch, which matters on park wifi, and the vector map is the better one
 * for reading road layout and walking routes.
 */
type Layer = 'imagery' | 'standard';

const LAYER_KEY = 'map_layer';

const parseLayer = (raw: string | null): Layer => (raw === 'standard' ? 'standard' : 'imagery');

/**
 * Which of Apple's own labels to draw.
 *
 * This replaces `showsPointsOfInterests={false}`, which suppressed every one
 * of them — and that is most of why the map was reported as bland and hard to
 * read. There was no reason recorded for it anywhere, in this file or in
 * AGENTS.md, which in a file commented as heavily as this one is its own
 * evidence that it was a default somebody turned off rather than a decision.
 *
 * A filter rather than the boolean, because the boolean's two settings are
 * both wrong here. All categories on means Apple labels all 392 restaurants
 * underneath the 392 pins this map draws itself — the same name twice, in two
 * typefaces, a few points apart. So: everything that helps you work out where
 * you are, and nothing that competes with a pin.
 *
 * `parking` and `publicTransport` are in deliberately. Where you leave the car
 * and where the bus stops are exactly the orientation a map of a resort is for,
 * and neither will ever be a row in this catalog.
 *
 * Note the native path: on iOS 16+ this goes through `MKMapConfiguration`, and
 * below that it falls back to setting `pointOfInterestFilter` straight on the
 * `MKMapView` — which has existed since iOS 13, so it works at this app's 15.1
 * floor too. The BOOLEAN prop is the one that is iOS 16-only.
 */
const POI_FILTER: MKPointOfInterestCategoryType[] = [
  'amusementPark',
  'aquarium',
  'zoo',
  'stadium',
  'marina',
  'beach',
  'campground',
  'park',
  'nationalPark',
  'golf',
  'miniGolf',
  'theater',
  'movieTheater',
  'museum',
  'landmark',
  'hotel',
  'parking',
  'publicTransport',
];

/**
 * Marker colours for the imagery layer, as literals, which is a sanctioned
 * exception and not an oversight.
 *
 * Same reasoning as the share card: a theme token exists to invert with the
 * scheme, and aerial photography does not invert. It is the identical picture
 * in light mode and dark mode, so a marker that reads `theme.background` for
 * its halo gets a near-white rim in one scheme and a near-black one in the
 * other over the same dark foliage — and the dark one disappears.
 *
 * Fixed values instead. White rims and a near-black chip are what every map
 * that draws over photography uses, because they are the two values that hold
 * against both a sunlit car park and a tree canopy.
 */
const IMAGERY = {
  /** The rim that separates a pin from whatever it is standing on. */
  halo: '#FFFFFF',
  /** Label chip. Dark end of the sky gradient, so it is still the app's. */
  chip: '#15202B',
  chipInk: '#FFFFFF',
} as const;

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
 *  overlapping each other's hit areas at the closest zoom. `TAP_SLOP` is how
 *  that gets solved instead. */
const PIN_HIT = 34;

/**
 * How far from a pin's centre a tap still counts as hitting it, in points.
 *
 * MapKit hit-tests an annotation against its view's frame and nothing else:
 * land one point outside `PIN_HIT` and the tap goes to the map instead, which
 * is why pins felt like they needed to be hit dead-on. Growing the frame is
 * the obvious fix and the wrong one — frames cannot overlap without stealing
 * each other's taps, so the dots would have to be spread out or the map
 * zoomed further in.
 *
 * So the map resolves near-misses itself. 22pt is Apple's 44pt target as a
 * radius, and because this picks the NEAREST pin rather than the first one
 * whose box contains the point, overlapping tolerances are not ambiguous —
 * two pins 10pt apart each own the half of the gap nearer to them.
 *
 * This only runs after the marker's own handler has declined the tap, so a
 * direct hit still takes the fast path.
 */
const TAP_SLOP = 22;

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
  const db = useSQLiteContext();

  /**
   * The layer, remembered across launches.
   *
   * Held in `app_settings` rather than component state alone because this map
   * unmounts every time you switch to the list and back — a choice that reset
   * on each visit would have to be made again every time, which is how a
   * control ends up reported as not working.
   *
   * It starts on `imagery` and is corrected a frame later if the stored value
   * says otherwise, rather than rendering nothing until the read lands. The
   * cost of guessing is one layer swap on a map somebody has just opened; the
   * cost of waiting is a blank rectangle where the map should be.
   */
  const [layer, setLayer] = useState<Layer>('imagery');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const raw = await getSetting(db, LAYER_KEY);
      if (alive) setLayer(parseLayer(raw));
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  const chooseLayer = useCallback(
    (next: Layer) => {
      setLayer(next);
      tapPicked();
      void setSetting(db, LAYER_KEY, next);
    },
    [db],
  );

  const onImagery = layer === 'imagery';

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

  /** Measured, not guessed: `nearestTo` converts degrees to points with it. */
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

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

  /**
   * The pin nearest a tapped coordinate, if one is within `TAP_SLOP`.
   *
   * Degrees are converted to points using the viewport and the map's measured
   * size, which is exact only while the map is north-up and flat — hence
   * `rotateEnabled={false}` and `pitchEnabled={false}` on the MapView. Both
   * were already effectively unsupported: `showsCompass` is off, so a user who
   * rotated the map had no way to straighten it again.
   *
   * Returns the nearest, not the first within range, so overlapping
   * tolerances resolve predictably.
   */
  const nearestTo = useCallback(
    (tap: { latitude: number; longitude: number }) => {
      if (!mapSize.width || !mapSize.height) return null;
      const perLng = mapSize.width / viewport.longitudeDelta;
      const perLat = mapSize.height / viewport.latitudeDelta;

      let best: (typeof pins)[number] | null = null;
      let bestDistance = TAP_SLOP;
      for (const pin of pins) {
        const dx = (pin.lng - tap.longitude) * perLng;
        const dy = (pin.lat - tap.latitude) * perLat;
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = pin;
        }
      }
      return best;
    },
    [pins, viewport, mapSize],
  );

  const onMapPress = useCallback(
    (event: MapPressEvent) => {
      const at = Date.now();
      const tap = event.nativeEvent.coordinate;
      setTimeout(() => {
        // A marker claimed this same tap, so it is already handled.
        if (markerTapAt.current >= at - SAME_TAP_MS) return;

        const near = nearestTo(tap);
        if (!near) {
          setSelectedId(null);
          return;
        }
        // A near-miss does exactly what hitting it would have done: a cluster
        // zooms, a pin opens its card.
        if (near.kind === 'cluster') {
          zoom(near.lat, near.lng);
        } else {
          // No haptic: selectPlace has none either, and a near-miss must be
          // indistinguishable from a hit.
          setSelectedId(near.item.id);
        }
      }, SAME_TAP_MS);
    },
    [nearestTo, zoom],
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
        onLayout={(e) => setMapSize(e.nativeEvent.layout)}
        // North-up and flat, which TAP_SLOP's arithmetic assumes. Neither
        // gesture was usable anyway without a compass to undo it.
        rotateEnabled={false}
        pitchEnabled={false}
        mapType={onImagery ? 'hybrid' : 'standard'}
        // Not `showsPointsOfInterests`. See POI_FILTER — the boolean's two
        // settings are "no labels at all", which is what this map had, and
        // "Apple's name for every restaurant printed under ours".
        pointsOfInterestFilter={POI_FILTER}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/*
          The layer is part of every marker's KEY, which is what repaints them
          when it changes. The alternative is adding `onImagery` to
          `tracksViewChanges`, and that would be a real regression: tracking is
          not a one-frame request, it stays on, and a tracking marker redraws
          continuously — which is the documented cause of this map visibly
          stuttering. A key change remounts the marker once, draws it in the
          new colours, and goes back to not tracking. Switching layers is a
          deliberate, rare tap, so one remount of the pins on screen is the
          right thing to spend.
        */}
        {pins.map((pin) =>
          pin.kind === 'cluster' ? (
            <Marker
              key={`${pin.key}-${layer}`}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              onPress={() => zoom(pin.lat, pin.lng)}
              tracksViewChanges={STATIC_MARKERS}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.cluster,
                  {
                    backgroundColor: theme.brandBlue,
                    borderColor: onImagery ? IMAGERY.halo : theme.background,
                  },
                ]}
              >
                <ThemedText style={[styles.clusterCount, { color: theme.onAccent }]}>
                  {pin.count}
                </ThemedText>
              </View>
            </Marker>
          ) : (
            <Marker
              key={`${pin.key}-${layer}`}
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
                onImagery={onImagery}
              />
            </Marker>
          ),
        )}
      </MapView>

      {/*
        One overlay holding both chips, stacked and centred, rather than two
        absolutely-positioned boxes.

        The badge was centred and the layer control was first written hard
        against the right edge, which collides: "Visited 48 of 392" and
        "Satellite / Map" are each around half a phone wide, so on a 393pt
        screen their boxes meet in the middle. Two independently positioned
        overlays whose widths both depend on their text is a layout that works
        until a longer word arrives — `doneLabel` is a prop and the counts grow
        a digit at 100. A column cannot overlap itself.

        `pointerEvents="box-none"` so the container does not swallow taps meant
        for the map underneath it; the chips inside still take their own.
      */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        {/* Counts, because "how much of this have I done?" is the question the
            map exists to answer at a glance. */}
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <ThemedText type="small" themeColor="textSecondary">
            {/* Verb first, matching the SkyHeader bar on the same screens —
                "Visited 48 of 392", not "48 of 392 visited". `doneLabel` is
                capitalised here and left alone in "Already visited" below. */}
            {doneLabel.charAt(0).toUpperCase() + doneLabel.slice(1)} {doneShown} of{' '}
            {places.length}
          </ThemedText>
        </View>

        {/*
          Two named options rather than one icon that toggles. A single layers
          button has to mean either "you are here" or "tap to go there", and a
          two-state control cannot say which — the user finds out by tapping
          it. Both words fit, so both words are shown.

          Styled as theme chrome rather than in the imagery literals: it is UI
          sitting on the map, like the count badge, not a marker pinned to the
          ground.
        */}
        <View
          style={[
            styles.layers,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          {(['imagery', 'standard'] as const).map((option) => {
            const active = layer === option;
            return (
              <Pressable
                key={option}
                onPress={() => chooseLayer(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  option === 'imagery' ? 'Satellite view' : 'Standard map view'
                }
                style={[
                  styles.layerOption,
                  active && { backgroundColor: theme.backgroundSelected },
                ]}
              >
                <ThemedText
                  allowFontScaling={false}
                  style={[
                    styles.layerText,
                    { color: active ? theme.accentText : theme.textFaint },
                  ]}
                >
                  {option === 'imagery' ? 'Satellite' : 'Map'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
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
          <ThemedText type="small" style={{ color: theme.accentText }}>
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
  onImagery,
}: {
  place: MapPlace;
  done: boolean;
  selected: boolean;
  labelled: boolean;
  /** Aerial photography underneath, so the pin needs a rim of its own rather
   *  than borrowing the scheme's ground colour. */
  onImagery: boolean;
}) {
  const theme = useTheme();
  const tone = theme[place.tone];
  /** The colour a pin uses to separate itself from the ground: the ground
   *  itself on the vector map, where that genuinely matches, and white over
   *  imagery, where there is no one ground colour to match. */
  const rim = onImagery ? IMAGERY.halo : theme.background;

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
        {/* Over imagery the dot gets a second, outer rim, so the park colour
            has something to read against instead of sitting straight on a
            tree canopy. It is a wrapper rather than a thicker border because
            a not-yet pin needs white OUTSIDE the tone and white inside it —
            a bullseye, which is what holds over photography.

            Its total width is 18 + 2 + 2 = 22, and 30 when selected. Both
            stay inside PIN_HIT, which is load-bearing: LABELLED_ANCHOR is
            computed from PIN_HIT, so a pin that outgrew its box would drag
            every marker off its coordinate. */}
        <View
          style={[
            onImagery && styles.pinHalo,
            onImagery && { backgroundColor: IMAGERY.halo },
          ]}
        >
          <View
            style={[
              styles.pin,
              selected && styles.pinSelected,
              done
                ? { backgroundColor: tone, borderColor: rim }
                : { backgroundColor: rim, borderColor: tone },
            ]}
          >
            {done ? (
              <ThemedText style={[styles.pinMark, { color: theme.onAccent }]}>✓</ThemedText>
            ) : null}
          </View>
        </View>
      </View>
      {labelled ? (
        <View
          style={[
            styles.label,
            onImagery
              ? { backgroundColor: IMAGERY.chip, borderColor: IMAGERY.chip }
              : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          {/* A chip rather than bare text: a map's imagery is light in some
              places and dark in others, and plain type over it is legible in
              only one of them. Over aerial the chip goes dark in BOTH schemes
              — a near-white chip is legible on photography but disappears
              into pavement and rooftops, which is most of what this map is
              of. */}
          <ThemedText
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.labelText, { color: onImagery ? IMAGERY.chipInk : theme.text }]}
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
  /** 2pt of rim all round the dot. `borderRadius` is generous on purpose: it
   *  only has to exceed half of the widest thing inside it (30/2 = 15) for the
   *  corners to stay fully round at both pin sizes. */
  pinHalo: { padding: 2, borderRadius: 20 },
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
  /** The chrome that floats over the map: the count, then the layer control,
   *  centred and stacked. `left`/`right` rather than a width so it spans the
   *  map and centres its children on the map's own centre. */
  topOverlay: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  layers: {
    flexDirection: 'row',
    padding: 2,
    gap: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  layerOption: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  layerText: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
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
