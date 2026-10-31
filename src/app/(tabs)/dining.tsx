import { useLocalSearchParams, useNavigation, useRoute, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  SKY_PLACEHOLDER,
  CollapsibleChips,
  SkyHeader,
  SkySegment,
  skyInput,
  useHeaderCollapse,
} from '@/components/sky-header';
import { ThemedView } from '@/components/themed-view';
import { CatalogMap, type MapPlace } from '@/components/catalog-map';
import { venuePlaces } from '@/lib/map-places';
import { VenueRow } from '@/components/venue-row';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
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
  /**
   * The trip being added to, unless the user has walked away from the task.
   *
   * "Walked away" is local state, NOT a cleared route param. Clearing the
   * param was an infinite loop: `setParams` mutates the navigation state,
   * which fires the `state` event, whose handler saw a still-unfocused tab
   * and cleared the param again. The crash surfaced in `app-tabs.tsx` because
   * that is where the re-render storm lands, but the cause was here.
   */
  const [abandoned, setAbandoned] = useState<string | null>(null);
  const planning =
    addToTrip && addToTrip !== abandoned
      ? trips.find((t) => t.id === addToTrip) ?? null
      : null;
  const plannedIds = useMemo(
    () => new Set(planning ? plansFor(planning.id).map((p) => p.venue_id) : []),
    [planning, plansFor],
  );
  const { data: areas } = useAreas();
  const { filters, set, clear } = useCatalogFilters();
  const bottomInset = useBottomInset();

  /**
   * Switching tabs abandons the add-to-trip task.
   *
   * `addToTrip` is a route param, and params outlive a tab change — so after
   * entering this mode, tapping Home and coming back to Dining left the
   * screen still titled with the trip, still showing checkboxes and a Done
   * footer, with nothing to explain why and no back button anywhere.
   *
   * This watches the TAB NAVIGATOR's focused route rather than this screen's
   * own focus, and the distinction is the point: opening the filter sheet
   * pushes a modal that blurs this screen without changing which tab is
   * selected. Keyed on focus, the filter round-trip would drop you out of the
   * task mid-way.
   *
   * It records the abandonment in React state rather than clearing the param.
   * A state update cannot trigger a navigation `state` event, so the handler
   * cannot re-enter itself — and once `abandoned` is set, `planning` goes
   * null and this effect tears the listener down.
   */
  const navigation = useNavigation();
  // This screen's own route name, compared against whichever tab is focused.
  // Read rather than hardcoded as 'dining' so renaming the file cannot quietly
  // make the comparison always true, and NOT captured at mount, because a tab
  // navigator may mount a screen while a different tab is focused.
  const routeName = useRoute().name;

  // A fresh entry into the flow re-arms it: a different trip id means a new
  // task, not the one that was walked away from.
  useEffect(() => {
    setAbandoned(null);
  }, [addToTrip]);

  useEffect(() => {
    if (!planning) return;
    const tripId = planning.id;
    const unsubscribe = navigation.addListener('state', () => {
      const state = navigation.getState();
      const focused = state?.routes[state.index]?.name;
      // Setting the same value twice is a no-op in React, so a burst of state
      // events during a transition settles instead of compounding.
      if (focused && focused !== routeName) setAbandoned(tripId);
    });
    return unsubscribe;
  }, [planning, navigation, routeName]);

  // The map is a view of the same filtered set, not a separate screen, so
  // switching to it never loses the filters you just chose. It is also local
  // state rather than a route: a tab that remembers it was showing a map is
  // surprising when you come back to find a restaurant by name.
  const [view, setView] = useState<'list' | 'map'>('list');
  const { collapsed, onScroll, reset: resetHeader } = useHeaderCollapse();

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

  /** The map knows nothing about venues, so something has to map them. Shared
   *  with the focused map in `show-on-map`, so a venue reads the same on both. */
  const mapPlaces = useMemo<MapPlace[]>(
    () => venuePlaces(filtered, areaName),
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
          action={planning ? { label: 'Done', onPress: () => router.back() } : undefined}
          collapsed={collapsed}
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
            <SkySegment
              options={VIEW_OPTIONS}
              value={view}
              onChange={(next) => {
                // The list unmounts on the way to the map, taking its scroll
                // offset with it — but the shared value keeps the last one,
                // which would leave the header collapsed over a full map
                // with no way to expand it again.
                resetHeader();
                setView(next);
              }}
            />
          ) : null}
        </SkyHeader>

        <CollapsibleChips
          collapsed={collapsed}
          summary={
            filters.areaId
              ? (areaName[filters.areaId] ?? filters.areaId)
              : 'All areas'
          }
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
        </CollapsibleChips>

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
            onScroll={onScroll}
            scrollEventThrottle={16}
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
            contentContainerStyle={[
              styles.list,
              { paddingBottom: bottomInset + Spacing.five },
            ]}
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
            style={[
              styles.doneBar,
              { backgroundColor: theme.accent, marginBottom: bottomInset + Spacing.two },
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Done
            </ThemedText>
            {/* Spelled out because the button looked like a Save it would be
                dangerous to miss. Each tap already wrote to the database, so
                this only closes the screen. */}
            <ThemedText type="small" style={[styles.doneSub, { color: theme.onAccent }]}>
              {plannedIds.size === 0
                ? `Nothing added to ${planning.name} yet`
                : `${plannedIds.size} ${plannedIds.size === 1 ? 'place' : 'places'} on ${planning.name} · saved as you go`}
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
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
    gap: 1,
  },
  doneSub: { opacity: 0.85, fontSize: 12 },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
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
