import { useRouter } from 'expo-router';
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
import { VenueRow } from '@/components/venue-row';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAreas, useFilteredVenues, useVenues } from '@/hooks/use-venues';
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
  const { data: venues, loading, error, reload } = useVenues();
  const { byVenue, visitedCount } = useVisits();
  const { data: areas } = useAreas();

  const [search, setSearch] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);

  const areaName = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a.name])),
    [areas],
  );

  const filtered = useFilteredVenues(venues, { search, areaId });

  /** Only offer areas that actually contain something. */
  const areaChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of venues) counts.set(v.area_id, (counts.get(v.area_id) ?? 0) + 1);
    return areas
      .filter((a) => counts.has(a.id))
      .map((a) => ({ ...a, count: counts.get(a.id) ?? 0 }));
  }, [venues, areas]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            Dining
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {loading && venues.length === 0
              ? 'Loading…'
              : visitedCount > 0
                ? `${visitedCount} of ${venues.length} visited` +
                  (filtered.length !== venues.length ? `  ·  ${filtered.length} shown` : '')
                : `${venues.length} places`}
          </ThemedText>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
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
            active={areaId === null}
            onPress={() => setAreaId(null)}
          />
          {areaChips.map((a) => (
            <Chip
              key={a.id}
              label={`${SHORT_AREA[a.id] ?? a.name}  ${a.count}`}
              active={areaId === a.id}
              onPress={() => setAreaId(areaId === a.id ? null : a.id)}
            />
          ))}
        </ScrollView>

        {error ? (
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
        ) : filtered.length === 0 ? (
          <Empty
            title="Nothing matches"
            body={
              search
                ? `No places match “${search}”.`
                : 'No places in this area yet.'
            }
            actionLabel={search || areaId ? 'Clear filters' : undefined}
            onAction={() => {
              setSearch('');
              setAreaId(null);
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
                onPress={() =>
                  router.push({ pathname: '/venue/[id]', params: { id: item.id } })
                }
              />
            )}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={loading && venues.length > 0}
                onRefresh={reload}
                tintColor={theme.accent}
              />
            }
          />
        )}
      </SafeAreaView>
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
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: 2,
  },
  heading: { fontSize: 34, lineHeight: 40 },
  search: {
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 42,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
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
