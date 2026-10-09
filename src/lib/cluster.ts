/**
 * Grid clustering for the map.
 *
 * 394 markers is well past what a map renders smoothly, so nearby venues
 * collapse into one numbered pin until you zoom in far enough to separate
 * them.
 *
 * This is deliberately a hand-rolled grid rather than a clustering library.
 * The published options wrap the map component itself, which puts a
 * third-party package between us and `react-native-maps` on the new
 * architecture — and the real algorithms earn their complexity on tens of
 * thousands of points spread over a continent. Walt Disney World is four miles
 * across and holds 394 of them, where bucketing by a rounded coordinate is
 * both fast enough and easier to reason about.
 */

export type Positioned = { id: string; lat: number | null; lng: number | null };

export type MapPin<T> =
  | { kind: 'pin'; key: string; lat: number; lng: number; item: T }
  | { kind: 'cluster'; key: string; lat: number; lng: number; count: number };

export type Viewport = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/**
 * Roughly how many cells span the viewport. Higher means more, smaller
 * clusters. Seven is about where Magic Kingdom's lands start to separate from
 * each other before the pins inside any one land do.
 */
const CELLS_ACROSS = 7;

/**
 * Below this span, stop clustering entirely and draw every pin.
 *
 * ~0.004 degrees of latitude is about 450 m. Past that the user has clearly
 * zoomed in on one specific spot, and a cluster badge that refuses to open no
 * matter how far you zoom is the single most irritating thing a map can do.
 * Resorts genuinely stack several restaurants in one building, so without this
 * floor those venues would be permanently unreachable from the map.
 */
const MIN_CLUSTER_DELTA = 0.004;

/** Walt Disney World, framed so all four parks and the resort areas fit. */
export const WDW_REGION: Viewport = {
  latitude: 28.3685,
  longitude: -81.5565,
  latitudeDelta: 0.17,
  longitudeDelta: 0.17,
};

/**
 * How far outside the viewport to keep pins, as a multiple of its size.
 *
 * `react-native-maps` mounts every `<Marker>` child whether or not it is on
 * screen, so without this the deepest zoom mounts all 366 at once. The margin
 * stops pins popping in at the edge as you pan, and keeps clusters near the
 * edge counting their off-screen members.
 */
const VIEWPORT_MARGIN = 0.75;

function visible<T extends Positioned>(
  items: T[],
  v: Viewport,
): (T & { lat: number; lng: number })[] {
  const padLat = v.latitudeDelta * (0.5 + VIEWPORT_MARGIN);
  const padLng = v.longitudeDelta * (0.5 + VIEWPORT_MARGIN);
  return items.filter(
    (i): i is T & { lat: number; lng: number } =>
      i.lat != null &&
      i.lng != null &&
      Math.abs(i.lat - v.latitude) <= padLat &&
      Math.abs(i.lng - v.longitude) <= padLng,
  );
}

export function clusterPins<T extends Positioned>(
  items: T[],
  viewport: Viewport,
): MapPin<T>[] {
  const placed = visible(items, viewport);

  if (viewport.latitudeDelta <= MIN_CLUSTER_DELTA) {
    return placed.map((item) => ({
      kind: 'pin',
      key: item.id,
      lat: item.lat,
      lng: item.lng,
      item,
    }));
  }

  const cellLat = viewport.latitudeDelta / CELLS_ACROSS;
  const cellLng = viewport.longitudeDelta / CELLS_ACROSS;

  const buckets = new Map<string, (T & { lat: number; lng: number })[]>();
  for (const item of placed) {
    const key = `${Math.floor(item.lat / cellLat)}:${Math.floor(item.lng / cellLng)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const pins: MapPin<T>[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.length === 1) {
      const item = bucket[0];
      pins.push({ kind: 'pin', key: item.id, lat: item.lat, lng: item.lng, item });
      continue;
    }
    // Centroid, not cell centre — a cluster pin should sit on top of the
    // places it represents rather than on an arbitrary grid line.
    let lat = 0;
    let lng = 0;
    for (const item of bucket) {
      lat += item.lat;
      lng += item.lng;
    }
    pins.push({
      kind: 'cluster',
      key: `c${key}`,
      lat: lat / bucket.length,
      lng: lng / bucket.length,
      count: bucket.length,
    });
  }
  return pins;
}

/** Where to move the camera when someone taps a cluster. Thirds rather than
 *  halves, so one tap makes visible progress instead of needing four. */
export function zoomInto(viewport: Viewport, lat: number, lng: number): Viewport {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: Math.max(viewport.latitudeDelta / 3, MIN_CLUSTER_DELTA / 2),
    longitudeDelta: Math.max(viewport.longitudeDelta / 3, MIN_CLUSTER_DELTA / 2),
  };
}
