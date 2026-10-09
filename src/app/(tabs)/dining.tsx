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
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VenueMap } from '@/components/venue-map';
import { VenueRow } from '@/components/venue-row';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useCatalogFilters } from '@/hooks/use-catalog-filters';
import { useTheme } from '@/hooks/use-theme';
import { useTrips } from '@/hooks/use-trips';
import {
  activeFilterCount,
  useAreas,
  useFilteredVenues,
  useVenues,
} from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';

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

  const filtered = useFilteredVenues(venues, filters, byVenue);
  const refinements = activeFilterCount(filters);

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

  const subtitle = planning
    ? `${plannedIds.size} on ${planning.name} · tap to add or remove`
    : loading && venues.length === 0
      ? 'Loading…'
      : visitedCount > 0
        ? `${visitedCount} of ${venues.length} visited` +
          (filtered.length !== venues.length ? `  ·  ${filtered.length} shown` : '')
        : `${venues.length} places`;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="title" style={styles.heading} numberOfLines={1}>
              {planning ? 'Add to trip' : 'Dining'}
            </ThemedText>
            {!planning ? (
              <View
                style={[
                  styles.segment,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
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
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={filters.search}
            onChangeText={(t) => set('search', t)}
            placeholder="Search restaurants and lounges"
            placeholderTextColor={theme.textFaint}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[
              styles.search,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
          <Pressable
            onPress={() => router.push('/filters')}
            accessibilityRole="button"
            accessibilityLabel={
              refinements ? `Filters, ${refinements} active` : 'Filters'
            }
            style={[
              styles.filterButton,
              refinements
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: refinements ? theme.onAccent : theme.textSecondary }}
            >
              {refinements ? `Filters ${refinements}` : 'Filters'}
            </ThemedText>
          </Pressable>
        </View>

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
      </SafeAreaView>
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
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} view`}
      style={[
        styles.segmentItem,
        active ? { backgroundColor: theme.accent } : null,
      ]}
    >
      <ThemedText
        type="small"
        style={{
          color: active ? theme.onAccent : theme.textSecondary,
          fontWeight: active ? '700' : '500',
        }}
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
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heading: { fontSize: 34, lineHeight: 40, flexShrink: 1 },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: 3,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
    borderRadius: Radius.pill,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  search: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    height: 42,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  filterButton: {
    paddingHorizontal: Spacing.three,
    height: 42,
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
