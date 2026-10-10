import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CatalogMap, type MapPlace } from '@/components/catalog-map';
import { SKY_PLACEHOLDER, SkyHeader, SkySegment, skyInput } from '@/components/sky-header';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing, TierTone } from '@/constants/theme';
import {
  TIER_LABEL,
  TRANSPORT_LABEL,
  useFilteredResorts,
  useResorts,
  type Resort,
} from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { useVisits } from '@/hooks/use-visits';

const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'List' },
  { value: 'map' as const, label: 'Map' },
];

const TIERS = ['value', 'moderate', 'deluxe', 'villa', 'campground'];

export default function ResortsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: resorts, loading, error } = useResorts();
  const { byResort, stayedCount } = useVisits();

  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<string | null>(null);
  // Local, not a route, for the same reason as Dining: a tab that remembers
  // it was showing a map is surprising when you come back to look something
  // up by name.
  const [view, setView] = useState<'list' | 'map'>('list');
  const filtered = useFilteredResorts(resorts, { search, tier });

  const stayedIds = useMemo(() => new Set(byResort.keys()), [byResort]);

  /** The map knows nothing about resorts, so the mapping happens here. */
  const mapPlaces = useMemo<MapPlace[]>(
    () =>
      filtered.map((r) => ({
        id: r.id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        // TierTone, not AreaTone — a resort's colour is its tier, which is
        // how it is coloured on the list and on the trip screen too.
        tone: TierTone[r.tier] ?? 'brandTeal',
        line1:
          (TIER_LABEL[r.tier] ?? r.tier) +
          (r.ownership === 'partner' ? '  ·  Partner hotel' : ''),
        line2: r.transport.map((t) => TRANSPORT_LABEL[t] ?? t).join(', '),
      })),
    [filtered],
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
        <SkyHeader
          eyebrow="WALT DISNEY WORLD"
          title="Resorts"
          progress={{ done: stayedCount, total: resorts.length, label: 'stayed at' }}
        >
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search resorts"
            placeholderTextColor={SKY_PLACEHOLDER}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={skyInput}
          />

          <SkySegment options={VIEW_OPTIONS} value={view} onChange={setView} />
        </SkyHeader>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipScroll}
        >
          <Chip label="All" active={tier === null} onPress={() => setTier(null)} />
          {TIERS.map((t) => {
            const n = resorts.filter((r) => r.tier === t).length;
            if (!n) return null;
            return (
              <Chip
                key={t}
                label={`${TIER_LABEL[t]}  ${n}`}
                active={tier === t}
                onPress={() => setTier(tier === t ? null : t)}
              />
            );
          })}
        </ScrollView>

        {/* List-only: the map has its own count badge. */}
        {view === 'list' && !loading && resorts.length > 0 ? (
          <ThemedText type="small" themeColor="textFaint" style={styles.resultCount}>
            {filtered.length === resorts.length
              ? `${resorts.length} resorts`
              : `${filtered.length} of ${resorts.length} shown`}
          </ThemedText>
        ) : null}

        {error ? (
          <View style={styles.center}>
            <ThemedText type="smallBold">Could not load resorts</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {error}
            </ThemedText>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : view === 'map' ? (
          <CatalogMap
            places={mapPlaces}
            doneIds={stayedIds}
            doneLabel="stayed at"
            onOpen={(p) => router.push({ pathname: '/resort/[id]', params: { id: p.id } })}
          />
        ) : (
          <FlatList
            style={styles.listFill}
            data={filtered}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => (
              <ResortRow
                resort={item}
                stayCount={byResort.get(item.id)?.count ?? 0}
                onPress={() =>
                  router.push({ pathname: '/resort/[id]', params: { id: item.id } })
                }
              />
            )}
          />
        )}
      </View>
    </ThemedView>
  );
}

function ResortRow({
  resort,
  stayCount,
  onPress,
}: {
  resort: Resort;
  stayCount: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tone = theme[TierTone[resort.tier] ?? 'brandTeal'];
  const stayed = stayCount > 0;
  const transport = resort.transport.map((t) => TRANSPORT_LABEL[t] ?? t).join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${resort.name}, ${TIER_LABEL[resort.tier] ?? resort.tier}` +
        (stayCount ? `, stayed ${stayCount} time${stayCount > 1 ? 's' : ''}` : '')
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: stayed ? tone : theme.border,
        },
      ]}
    >
      {/* Same wash as the dining rows: a resort you have stayed at carries its
          tier colour, so progress is visible scrolling 35 rows. */}
      {stayed ? (
        <View style={[styles.wash, { backgroundColor: tone, opacity: 0.1 }]} />
      ) : null}
      <View style={[styles.stripe, { backgroundColor: tone }]} />
      <View style={styles.rowMain}>
        <View style={styles.titleLine}>
          {stayed ? (
            <View style={[styles.tick, { backgroundColor: tone }]}>
              <ThemedText style={[styles.tickMark, { color: theme.onAccent }]}>
                {stayCount > 1 ? stayCount : '✓'}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
            {resort.name}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {TIER_LABEL[resort.tier] ?? resort.tier}
          {resort.ownership === 'partner' ? '  ·  Partner hotel' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
          {transport}
        </ThemedText>
      </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
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
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  wash: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  stripe: { width: 5, alignSelf: 'stretch', marginVertical: -Spacing.three },
  rowMain: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flexShrink: 1 },
  tick: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tickMark: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  centerText: { textAlign: 'center' },
});
