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
import { SKY_PLACEHOLDER, SkyHeader, skyInput } from '@/components/sky-header';
import { ThemedView } from '@/components/themed-view';
import { VenueMap } from '@/components/venue-map';
import { VenueRow } from '@/components/venue-row';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
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

/**
 * Chip labels. The full area names ("ESPN Wide World of Sports Resort Area")
 * are right for a detail screen and far too long for a filter chip.
 */
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
              style={skyInput}
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
            <View style={styles.segment}>
              <Segment
                label="List"
                active={view === 'list'}
                onPress={() => setView('list')}
              />
              <Segment
                label="Map"
                active={view === 'map'}
                onPress={() => setView('map')}
              />
            </View>
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
            "what am I looking at right now", which the filters change. */}
        {!loading && venues.length > 0 ? (
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
          <VenueMap
            venues={filtered}
            visitedIds={visitedIds}
            areaName={(id) => areaName[id] ?? id}
            onOpen={(v) => router.push({ pathname: '/venue/[id]', params: { id: v.id } })}
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

/**
 * One side of the List/Map toggle.
 *
 * The first version drew the track transparent and filled the selected side
 * with `backgroundElement`, which against the screen background is a few
 * percent of lightness apart — so it did not read as a two-option control at
 * all, and the unselected side looked like disabled placeholder text. The
 * selected side is now `accent`, which nothing else in the header uses.
 */
function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} view`}
      style={[styles.segmentItem, active ? styles.segmentItemOn : null]}
    >
      <ThemedText
        style={[
          styles.segmentText,
          {
            color: active ? '#23133A' : 'rgba(255,255,255,0.75)',
            fontWeight: active ? '700' : '600',
          },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
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
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  segmentItem: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one + 3,
    borderRadius: Radius.pill,
  },
  segmentItemOn: { backgroundColor: '#E5B45F' },
  segmentText: { fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: Spacing.two },
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
