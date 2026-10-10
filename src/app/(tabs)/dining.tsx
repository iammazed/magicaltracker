import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SKY_PLACEHOLDER, SkyHeader, SkySegment, skyInput } from '@/components/sky-header';
import { ThemedView } from '@/components/themed-view';
import { CatalogMap, type MapPlace } from '@/components/catalog-map';
import { VenueRow } from '@/components/venue-row';
import { AreaTone, BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useCatalogFilters } from '@/hooks/use-catalog-filters';
import { useNearby } from '@/hooks/use-nearby';
import { useTheme } from '@/hooks/use-theme';
import { useTrips } from '@/hooks/use-trips';
import {
  activeFilterCount,
  useAreas,
  useFilteredVenues,
  useVenues,
} from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';
import { formatDistance, metresBetween, sortByDistance } from '@/lib/cluster';
import { formatCuisine, formatSubArea } from '@/lib/labels';

/**
 * Chip labels. The full area names ("ESPN Wide World of Sports Resort Area")
 * are right for a detail screen and far too long for a filter chip.
 */
const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'List' },
  { value: 'map' as const, label: 'Map' },
];

const SHORT_AREA: Record<string, string> = {
  'magic-kingdom': 'Magic Kingdom',
  epcot: 'EPCOT',
  'hollywood-studios': 'Hollywood Studios',
  'animal-kingdom': 'Animal Kingdom',
  'disney-springs': 'Disney Springs',
  'typhoon-lagoon': 'Typhoon Lagoon',
  'blizzard-beach': 'Blizzard Beach',
  boardwalk: 'BoardWalk',
  'wide-world-of-sports': 'ESPN Sports',
  'mk-resort-area': 'MK Resorts',
  'epcot-resort-area': 'EPCOT Resorts',
  'ak-resort-area': 'AK Resorts',
  'springs-resort-area': 'Springs Resorts',
  'sports-resort-area': 'Sports Resorts',
};

export default function CatalogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: venues, loading, refreshing, error, reload } = useVenues();
  const { byVenue, visitedCount } = useVisits();
  // When arriving from a trip, tapping a row adds to that trip's dining list
  // instead of opening the venue.
  const { addToTrip } = useLocalSearchParams<{ addToTrip?: string }>();
  const { trips, plansFor, addPlan, removePlan } = useTrips();
  const planning = trips.find((t) => t.id === addToTrip) ?? null;
  const plannedIds = useMemo(
    () => new Set(planning ? plansFor(planning.id).map((p) => p.venue_id) : []),
    [planning, plansFor],
  );
  const { data: areas } = useAreas();
  const { filters, set, clear } = useCatalogFilters();

  // The map is a view of the same filtered set, not a separate screen, so
  // switching to it never loses the filters you just chose. It is also local
  // state rather than a route: a tab that remembers it was showing a map is
  // surprising when you come back to find a restaurant by name.
  const [view, setView] = useState<'list' | 'map'>('list');

  const areaName = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a.name])),
    [areas],
  );

  const matched = useFilteredVenues(venues, filters, byVenue);
  const refinements = activeFilterCount(filters);

  // Nearest-first when the user has turned it on. Sorting here rather than
  // inside `useFilteredVenues` keeps filtering and ordering separate, and the
  // map reads the same array so both views agree.
  const nearby = useNearby();
  const filtered = useMemo(
    () => (nearby.enabled && nearby.coords ? sortByDistance(matched, nearby.coords) : matched),
    [matched, nearby.enabled, nearby.coords],
  );

  const distanceFor = useMemo(() => {
    const from = nearby.coords;
    if (!nearby.enabled || !from) return undefined;
    return (v: { lat: number | null; lng: number | null }) =>
      v.lat == null || v.lng == null
        ? undefined
        : formatDistance(metresBetween(from, { latitude: v.lat, longitude: v.lng }));
  }, [nearby.enabled, nearby.coords]);

  const visitedIds = useMemo(() => new Set(byVenue.keys()), [byVenue]);

  /** The map knows nothing about venues, so the mapping happens here. */
  const mapPlaces = useMemo<MapPlace[]>(
    () =>
      filtered.map((v) => ({
        id: v.id,
        name: v.name,
        lat: v.lat,
        lng: v.lng,
        tone: AreaTone[v.area_id] ?? 'brandTeal',
        line1:
          (areaName[v.area_id] ?? v.area_id) +
          (v.sub_area ? ` · ${formatSubArea(v.sub_area)}` : ''),
        line2: [
          formatCuisine(v.cuisine),
          '$'.repeat(Math.max(1, Math.min(4, v.price_tier))),
        ]
          .filter(Boolean)
          .join('  ·  '),
      })),
    [filtered, areaName],
  );

  /**
   * Area chips, counted against every filter EXCEPT the area itself — so the
   * number on a chip is what you would actually see after tapping it. Counting
   * raw venues instead would put "EPCOT 61" above a list of 48, because the
   * other 13 are events the default view hides.
   */
  const withoutArea = useFilteredVenues(venues, { ...filters, areaId: null }, byVenue);
  const areaChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of withoutArea) counts.set(v.area_id, (counts.get(v.area_id) ?? 0) + 1);
    return areas
      .filter((a) => counts.has(a.id))
      .map((a) => ({ ...a, count: counts.get(a.id) ?? 0 }));
  }, [withoutArea, areas]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
        <SkyHeader
          eyebrow={planning ? 'ADDING TO A TRIP' : 'WALT DISNEY WORLD'}
          title={planning ? planning.name : 'Dining'}
          progress={
            planning
              ? { done: plannedIds.size, total: venues.length, label: 'on this trip' }
              : { done: visitedCount, total: venues.length, label: 'eaten at' }
          }
        >
          <View style={styles.searchRow}>
            <TextInput
              value={filters.search}
              onChangeText={(t) => set('search', t)}
              placeholder="Search restaurants and lounges"
              placeholderTextColor={SKY_PLACEHOLDER}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[skyInput, styles.searchInput]}
            />
            <Pressable
              onPress={() => router.push('/filters')}
              accessibilityRole="button"
              accessibilityLabel={
                refinements ? `Filters, ${refinements} active` : 'Filters'
              }
              style={[styles.filterButton, refinements ? styles.filterOn : styles.filterOff]}
            >
              <ThemedText
                style={[styles.filterText, { color: refinements ? '#23133A' : '#ffffff' }]}
              >
                {refinements ? `Filters ${refinements}` : 'Filters'}
              </ThemedText>
            </Pressable>
          </View>

          {!planning ? (
            <SkySegment options={VIEW_OPTIONS} value={view} onChange={setView} />
          ) : null}
        </SkyHeader>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          // A horizontal ScrollView in a flex column has no intrinsic height
          // and will fight the list below it for space. flexGrow 0 makes it
          // size to its content instead.
          style={styles.chipScroll}
        >
          <Chip
            label="All"
            active={filters.areaId === null}
            onPress={() => set('areaId', null)}
          />
          {areaChips.map((a) => (
            <Chip
              key={a.id}
              label={`${SHORT_AREA[a.id] ?? a.name}  ${a.count}`}
              active={filters.areaId === a.id}
              onPress={() => set('areaId', filters.areaId === a.id ? null : a.id)}
            />
          ))}
        </ScrollView>

        {/* The header's bar answers "how much have I done"; this answers
            "what am I looking at right now", which the filters change. The
            map carries its own count badge, so it is list-only. */}
        {view === 'list' && !loading && venues.length > 0 ? (
          <ThemedText type="small" themeColor="textFaint" style={styles.resultCount}>
            {filtered.length === venues.length
              ? `${venues.length} places`
              : `${filtered.length} of ${venues.length} shown`}
            {planning ? ' · tap to add or remove' : ''}
          </ThemedText>
        ) : null}

        {error && venues.length === 0 ? (
          <Empty
            title="Could not load the catalog"
            body={error}
            actionLabel="Try again"
            onAction={reload}
          />
        ) : loading && venues.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : view === 'map' && !planning ? (
          <CatalogMap
            places={mapPlaces}
            doneIds={visitedIds}
            doneLabel="visited"
            onOpen={(p) => router.push({ pathname: '/venue/[id]', params: { id: p.id } })}
          />
        ) : filtered.length === 0 ? (
          <Empty
            title="Nothing matches"
            body={
              filters.search
                ? `No places match “${filters.search}”.`
                : refinements
                  ? 'No places match these filters.'
                  : 'No places in this area yet.'
            }
            actionLabel={
              filters.search || filters.areaId || refinements ? 'Clear filters' : undefined
            }
            onAction={() => {
              clear();
              set('search', '');
              set('areaId', null);
            }}
          />
        ) : (
          <FlatList
            style={styles.listFill}
            data={filtered}
            keyExtractor={(v) => v.id}
            renderItem={({ item }) => (
              <VenueRow
                venue={item}
                areaName={areaName[item.area_id] ?? item.area_id}
                visitCount={byVenue.get(item.id)?.count ?? 0}
                distance={distanceFor?.(item)}
                planned={planning ? plannedIds.has(item.id) : undefined}
                onPress={() => {
                  if (planning) {
                    if (plannedIds.has(item.id)) void removePlan(planning.id, item.id);
                    else void addPlan(planning.id, item.id);
                  } else {
                    router.push({ pathname: '/venue/[id]', params: { id: item.id } });
                  }
                }}
              />
            )}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={reload}
                tintColor={theme.accent}
              />
            }
          />
        )}
        {planning ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={[styles.doneBar, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Done · {plannedIds.size} on {planning.name}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.accent : theme.backgroundElement,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <ThemedText
        type="small"
        numberOfLines={1}
        style={{ color: active ? theme.onAccent : theme.textSecondary }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Empty({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.emptyBody}
      >
        {body}
      </ThemedText>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={[styles.action, { backgroundColor: theme.accent }]}
        >
          <ThemedText type="small" style={{ color: theme.onAccent }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  searchInput: { flex: 1 },
  filterButton: {
    paddingHorizontal: Spacing.three,
    height: 48,
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  filterOn: { backgroundColor: '#E5B45F', borderColor: '#E5B45F' },
  filterOff: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.26)',
  },
  filterText: { fontSize: 14, fontWeight: '600' },
  resultCount: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    height: 34,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listFill: { flex: 1 },
  doneBar: {
    marginHorizontal: Spacing.three,
    marginBottom: BottomTabInset,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyBody: { textAlign: 'center', maxWidth: 280 },
  action: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
