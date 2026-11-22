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
import {
  LABEL_GAP,
  LABEL_H,
  PIN_HIT,
  anchorFor,
  contains,
  labelRect,
  labelWidth,
  pickLabels,
  project,
  type LabelPin,
  type LabelSide,
} from '@/lib/map-labels';

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
 * Whether Apple's own labels are drawn, remembered the same way the layer is.
 *
 * Asked for after a report that Apple's points of interest "are still just
 * showing up as the pink or coloured dots/icons and the words are still not
 * showing up". The words are not ours to turn on — see POI_FILTER — so the
 * control this offers is the one that exists: the dots, or no dots. A dot that
 * cannot say what it is has a real cost on a map already drawing its own pins,
 * and somebody who reads them as noise should be able to say so.
 *
 * Defaults ON, because that is what shipped and because parking and transport
 * earn their place.
 */
const POI_KEY = 'map_poi';

const parsePoi = (raw: string | null): boolean => raw !== 'off';

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
 * floor too.
 *
 * **Turning them off takes both props.** Read AIRMap.mm: the filter's setter
 * falls back to the boolean's behaviour when the array is empty, and the
 * boolean's setter returns early when the array is not. They are one control
 * in two halves, so `showsPointsOfInterests` has to carry `showPoi` rather
 * than a constant. Pinning it to `false` and letting a non-empty filter win is
 * right on iOS 16, where the filter goes through `MKMapConfiguration` — and
 * wrong below it, where the boolean sets `MKMapView.showsPointsOfInterest`
 * directly and hides every POI whatever the filter holds. The floor is 15.1.
 * Either order of application settles correctly, because whichever prop lands
 * second reads the other's new value.
 *
 * **The array's identity is keyed on the layer on purpose.** `mapType` and
 * `preferredConfiguration` are two views of one piece of MapKit state, so
 * setting the map type replaces the configuration this filter was installed
 * on. React would otherwise send `mapType` by itself on a layer switch and
 * leave Apple on its default POI set — every restaurant named a second time
 * under our own label, which is the thing the filter exists to prevent. A new
 * array makes the filter a changed prop too, and the JSX order below puts
 * `mapType` first, so it is reinstalled onto the configuration it belongs to.
 * Not verifiable from a Windows machine; it costs one native call per switch.
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
 * So the map resolves near-misses itself, and because this picks the NEAREST
 * pin rather than the first one whose box contains the point, overlapping
 * tolerances are not ambiguous — two pins 10pt apart each own the half of the
 * gap nearer to them.
 *
 * It was 22, which is Apple's 44pt target expressed as a radius, and it was
 * still reported as needing a really accurate tap. 30 is the dial being turned
 * rather than a measurement: the only thing a bigger radius costs is that a
 * tap on bare map within 30pt of a pin selects it instead of dismissing the
 * card, and bare map near a pin is not somewhere people aim.
 *
 * Two other things in this file were almost certainly doing more damage than
 * this number: a labelled marker was 96pt wide whatever its name, so
 * neighbouring frames overlapped and could answer each other's taps, and
 * labelled markers were left permanently tracking view changes, which redraws
 * an annotation continuously under the finger. Both are fixed. If taps are
 * still awkward after that, this is the number to move.
 *
 * This only runs after the marker's own handler has declined the tap, so a
 * direct hit still takes the fast path.
 */
const TAP_SLOP = 30;

/** How much of the tap tolerance is extended around the label chip too. A
 *  name is a target people aim at, and before this only the dot was one. */
const LABEL_SLOP = 4;

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
  const [showPoi, setShowPoi] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // Read together, so the map settles into both remembered choices in one
      // render rather than swapping the layer and then the labels.
      const [rawLayer, rawPoi] = await Promise.all([
        getSetting(db, LAYER_KEY),
        getSetting(db, POI_KEY),
      ]);
      if (!alive) return;
      setLayer(parseLayer(rawLayer));
      setShowPoi(parsePoi(rawPoi));
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

  const togglePoi = useCallback(() => {
    setShowPoi((on) => {
      const next = !on;
      void setSetting(db, POI_KEY, next ? 'on' : 'off');
      return next;
    });
    tapPicked();
  }, [db]);

  const onImagery = layer === 'imagery';

  /** A fresh array per layer, and empty when off. See POI_FILTER for both. */
  const poiFilter = useMemo<MKPointOfInterestCategoryType[]>(() => {
    // `layer` is a dependency for its IDENTITY, not its value: a new array is
    // what makes React send this prop again after `mapType` has replaced the
    // configuration it was installed on.
    void layer;
    return showPoi ? [...POI_FILTER] : [];
  }, [showPoi, layer]);

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

  /**
   * Which pins show their name.
   *
   * It used to be one boolean for the whole map, flipped by a count — below 28
   * individual pins every name appeared and above it none did. The count was
   * raised once already and the report came back the same: coloured dots, no
   * words. A count is the wrong measure, because whether two names collide
   * depends on where those two pins happen to be and not on how many are on
   * screen, so there is no threshold that both names a park and keeps World
   * Showcase readable.
   *
   * `pickLabels` decides it per pin instead, by testing the boxes against each
   * other, and returns which SIDE of the dot each name goes on. A name is
   * withheld only where every side is off the edge of the map or already under
   * another name. The selected pin goes first and therefore keeps its name
   * even in a crowd.
   *
   * Measured against the real catalog on a 393×620 map: every on-screen pin
   * gets named at most framings and four fifths of them in the densest, where
   * the count rule showed NOTHING at all below 450 m across — 33 to 50 pins is
   * past 28, so the zoom that answers "which building is it" was the one zoom
   * with no words on it.
   *
   * A cluster is passed in as an obstacle rather than a candidate: it is
   * several places and has no one name, and its 30pt badge must not be
   * covered by a neighbour's label.
   *
   * Deliberately NOT keyed on the selection, which the first version was. A
   * name is given priority by `first`, and handing that to the selected pin
   * means every label on the map is re-placed the moment anybody taps one —
   * names jumping from one side of their dot to the other, and, because the
   * side is part of the marker key, every marker on screen remounting,
   * including the one under the finger that caused it. The selected place is
   * named on the card at the bottom of the screen in any case. `focusId` gets
   * the priority instead: it is the whole reason the focused map was opened,
   * and it is a prop, so it cannot change under a gesture.
   */
  const labelPins = useMemo<LabelPin[]>(
    () =>
      pins.map((pin) =>
        pin.kind === 'cluster'
          ? { id: pin.key, name: null, lat: pin.lat, lng: pin.lng, half: 15 }
          : { id: pin.item.id, name: pin.item.name, lat: pin.lat, lng: pin.lng, half: 11 },
      ),
    [pins],
  );

  const labelled = useMemo(
    () => pickLabels(labelPins, viewport, mapSize, focusId),
    [labelPins, viewport, mapSize, focusId],
  );

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
   * A cluster tap has to claim the tap as well, and did not.
   *
   * Only `selectPlace` was stamping `markerTapAt`, so the map press that
   * arrives alongside a cluster tap was never recognised as part of it: the
   * cluster zoomed, and a tick later the deferred handler ran the near-miss
   * search against the pins and viewport as they were BEFORE the camera moved
   * and raised a card for whatever happened to be within 30pt of the badge.
   * One tap, two unrelated outcomes.
   */
  const openCluster = useCallback(
    (lat: number, lng: number) => {
      markerTapAt.current = Date.now();
      zoom(lat, lng);
    },
    [zoom],
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
      const { at } = project(viewport, mapSize);
      const point = at(tap.latitude, tap.longitude);

      let best: (typeof pins)[number] | null = null;
      let bestDistance = TAP_SLOP;
      /** A tap inside a name chip, which beats any near-miss on a dot. */
      let onName: (typeof pins)[number] | null = null;
      let onNameDistance = Infinity;

      for (const pin of pins) {
        const spot = at(pin.lat, pin.lng);
        const distance = Math.hypot(point.x - spot.x, point.y - spot.y);

        if (pin.kind === 'pin' && distance < onNameDistance) {
          const side = labelled.get(pin.item.id);
          if (side && contains(labelRect(side, spot.x, spot.y, pin.item.name), point, LABEL_SLOP)) {
            onNameDistance = distance;
            onName = pin;
          }
        }

        if (distance < bestDistance) {
          bestDistance = distance;
          best = pin;
        }
      }

      // Landing INSIDE a name is a stronger claim than being near a dot, so a
      // chip wins. Where two chips overlap — which only happens because a chip
      // may sit over another pin's mark — the nearer dot takes it.
      return onName ?? best;
    },
    [pins, viewport, mapSize, labelled],
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
        // Both halves of one control, and `mapType` has to stay above them.
        // See POI_FILTER.
        pointsOfInterestFilter={poiFilter}
        showsPointsOfInterests={showPoi}
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
              onPress={() => openCluster(pin.lat, pin.lng)}
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
              // Whether this pin carries its name is part of the key, for the
              // same reason the layer is: a marker with custom children keeps
              // the snapshot it was first drawn with, so a name appearing or
              // disappearing has to remount it. The alternative was
              // `tracksViewChanges={labelled}`, which is what this used to do
              // and is a worse trade than it looks — tracking is not a
              // one-frame request, it stays on, so every named marker was
              // redrawing continuously. That is the documented cause of this
              // map stuttering, and an annotation being rebuilt under a finger
              // is a plausible part of why taps were reported as needing to be
              // really accurate. Labels are recomputed on
              // `onRegionChangeComplete`, which is once per gesture, so this
              // costs one remount at the end of a pan.
              //
              // The SIDE is in the key too, not just whether there is a label:
              // moving a name from under a dot to the left of it changes the
              // marker view and its anchor together, and a stale snapshot
              // there would draw the name in one place while the dot claims to
              // be in another.
              key={`${pin.key}-${layer}-${labelled.get(pin.item.id) ?? ''}`}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              onPress={() => selectPlace(pin.item.id)}
              // Keeps this press from also arriving at the map's `onPress` as
              // a React bubble. Apple Maps only, which is the provider here;
              // Android never propagates marker presses.
              stopPropagation
              // The selected pin grows, so it genuinely needs one more render
              // pass. Nothing else does, now that the key carries the label.
              tracksViewChanges={pin.item.id === selectedId}
              anchor={anchorFor(labelled.get(pin.item.id), pin.item.name)}
            >
              <PlacePin
                place={pin.item}
                done={doneIds.has(pin.item.id)}
                selected={pin.item.id === selectedId}
                side={labelled.get(pin.item.id)}
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
        <View style={styles.controls}>
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

          {/*
            One chip rather than the two the layer control uses, because this
            is a state and not a choice between two places to be. The objection
            recorded above — that a two-state control cannot say whether it
            means "you are here" or "tap to go there" — was about an ICON. A
            word that is lit when on and faint when off says which, the way the
            layer options already do, and `role="switch"` says it out loud to
            VoiceOver, which an unlabelled toggle cannot.

            "Landmarks" rather than "Points of interest" or "Apple labels":
            what is actually in POI_FILTER is hotels, parking, transport,
            theatres and parks, and the word has to make sense to somebody who
            has never heard of MapKit.
          */}
          <Pressable
            onPress={togglePoi}
            accessibilityRole="switch"
            accessibilityState={{ checked: showPoi }}
            accessibilityLabel="Apple's landmarks"
            accessibilityHint={
              showPoi
                ? "Hides Apple's own hotel, parking and transport markers"
                : "Shows Apple's own hotel, parking and transport markers"
            }
            style={[
              styles.layers,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.layerOption,
                showPoi && { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <ThemedText
                allowFontScaling={false}
                style={[
                  styles.layerText,
                  { color: showPoi ? theme.accentText : theme.textFaint },
                ]}
              >
                Landmarks
              </ThemedText>
            </View>
          </Pressable>
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
  side,
  onImagery,
}: {
  place: MapPlace;
  done: boolean;
  selected: boolean;
  /** Which side of the dot this pin's name goes on, or undefined for a pin
   *  that did not get one. Decided by `pickLabels`, and the layout below has
   *  to match the fractions `anchorFor` returns for the same side. */
  side?: LabelSide;
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
  // rather than 18 points. The dot keeps that fixed 34pt box wherever the name
  // goes, so the pin's size and hit area never depend on its label.
  const dot = (
    <View style={styles.pinHit}>
      {/* Over imagery the dot gets a second, outer rim, so the park colour
          has something to read against instead of sitting straight on a
          tree canopy. It is a wrapper rather than a thicker border because
          a not-yet pin needs white OUTSIDE the tone and white inside it —
          a bullseye, which is what holds over photography.

          Its total width is 18 + 2 + 2 = 22, and 30 when selected. Both
          stay inside PIN_HIT, which is load-bearing: every anchor in
          `map-labels.ts` is computed from PIN_HIT, so a pin that outgrew its
          box would drag every marker off its coordinate. */}
      <View
        style={[onImagery && styles.pinHalo, onImagery && { backgroundColor: IMAGERY.halo }]}
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
  );

  if (!side) return dot;

  const chip = (
    <View
      style={[
        styles.label,
        GAP[side],
        // Given the width `labelWidth` reports rather than sized to its text.
        // That number is already what the collision test, the anchor and the
        // tap target are computed from, so making it the rendered width too is
        // what keeps all four honest — see the note in `map-labels.ts`.
        { width: labelWidth(place.name) },
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
  );

  // Above and left put the name first in the flow; the anchor fractions in
  // `anchorFor` assume exactly this ordering and these two flex directions.
  const leads = side === 'above' || side === 'left';
  return (
    <View style={side === 'below' || side === 'above' ? styles.stack : styles.beside}>
      {leads ? chip : dot}
      {leads ? dot : chip}
    </View>
  );
}

/** The one point of clear air between a dot and its name, on whichever side
 *  the name landed. `LABEL_GAP` is in every anchor calculation too. */
const GAP = StyleSheet.create({
  below: { marginTop: LABEL_GAP },
  above: { marginBottom: LABEL_GAP },
  right: { marginLeft: LABEL_GAP },
  left: { marginRight: LABEL_GAP },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  /**
   * A name above or below the dot stacks; one to its left or right sits
   * beside it. No fixed width on either: `alignItems` is what centres the dot
   * over its coordinate, at any width, so the 96pt box this used to carry
   * only ever served to give short names a marker frame far wider than their
   * chip — invisible, tappable, and overlapping the pins either side of them.
   * MapKit hit-tests an annotation against its frame, so that nothing was
   * answering taps aimed at its neighbours.
   */
  stack: { alignItems: 'center' },
  beside: { flexDirection: 'row', alignItems: 'center' },
  pinHit: {
    width: PIN_HIT,
    height: PIN_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    height: LABEL_H,
    paddingHorizontal: 5,
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /** Centred, because the chip is given a computed width rather than sized to
   *  its text, so left-aligned type would sit off-centre inside it. */
  labelText: { fontSize: 10, fontWeight: '600', lineHeight: 13, textAlign: 'center' },
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
  /** The layer control and the landmarks switch, side by side. A third chip
   *  stacked under the count badge would push map chrome down over the
   *  imagery it is meant to sit lightly on; both fit on one line at 393pt. */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
