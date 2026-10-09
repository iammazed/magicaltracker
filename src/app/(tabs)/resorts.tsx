import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
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

const TIERS = ['value', 'moderate', 'deluxe', 'villa', 'campground'];

export default function ResortsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: resorts, loading, error } = useResorts();
  const { byResort, stayedCount } = useVisits();

  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<string | null>(null);
  const filtered = useFilteredResorts(resorts, { search, tier });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            Resorts
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {loading
              ? 'Loading…'
              : stayedCount > 0
                ? `${stayedCount} of ${resorts.length} stayed at`
                : `${resorts.length} resorts`}
          </ThemedText>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search resorts"
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
      </SafeAreaView>
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
  const transport = resort.transport.map((t) => TRANSPORT_LABEL[t] ?? t).join(' · ');

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
          borderColor: theme.border,
        },
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: theme[TierTone[resort.tier] ?? 'brandTeal'] }]} />
      <View style={styles.rowMain}>
        <View style={styles.titleLine}>
          {stayCount > 0 ? (
            <View style={[styles.tick, { backgroundColor: theme.accent }]}>
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
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 2 },
  heading: { fontSize: 34, lineHeight: 40 },
  search: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
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
  stripe: { width: 5, alignSelf: 'stretch', marginVertical: -Spacing.three },
  rowMain: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flexShrink: 1 },
  tick: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tickMark: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  centerText: { textAlign: 'center' },
});
