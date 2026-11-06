import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TierTone } from '@/constants/theme';
import { TIER_LABEL, useResorts } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { useTrips } from '@/hooks/use-trips';
import { tapPicked, tapSaved } from '@/lib/haptics';
import type { Trip } from '@/lib/local-db';

/**
 * Where you are sleeping — one resort, or two.
 *
 * ## Split stays
 *
 * A split stay is two hotels on one trip, and the pattern in practice is "a
 * few nights here, then there". The checkbox reveals a second resort and the
 * day you move, which is one more field than naming two hotels and is what
 * makes the shared itinerary able to say which bed you are in on a given
 * night — the main thing a travelling companion reads it for.
 *
 * The changeover is stored rather than two date ranges, so the halves cannot
 * contradict each other or leave a gap. See local `SCHEMA_VERSION 11`.
 *
 * ## This screen can now change the resort at all
 *
 * It could not before. The resort was chosen once in `TripPlanner` and
 * `setResort` had no caller, so "Choose a resort" pushed to the resorts tab
 * and nothing there wrote back — a trip created without one could never get
 * one. Adding a second resort meant building the picker anyway, and the
 * first resort gets it for free.
 */
export function TripStay({ trip }: { trip: Trip }) {
  const theme = useTheme();
  const router = useRouter();
  const { data: resorts } = useResorts();
  const { setResort, setSplitStay } = useTrips();

  const [picking, setPicking] = useState<null | 'first' | 'second'>(null);

  const byId = useMemo(() => new Map(resorts.map((r) => [r.id, r])), [resorts]);
  const first = trip.resort_id ? byId.get(trip.resort_id) ?? null : null;
  const second = trip.resort_id_2 ? byId.get(trip.resort_id_2) ?? null : null;
  const split = !!trip.resort_id_2;

  /**
   * The changeover cannot be the first day or the last.
   *
   * Moving on arrival day means you are not staying at the first resort at
   * all, and moving on departure day means you are not staying at the
   * second — both are a single stay entered wrongly, and allowing them would
   * print a zero-night range in the itinerary.
   */
  const dates = {
    min: addDay(trip.start_date, 1),
    max: addDay(trip.end_date, -1),
  };
  const roomToSplit = dates.min <= dates.max;

  const toggleSplit = async () => {
    if (split) {
      await setSplitStay(trip.id, null);
      tapPicked();
    } else {
      // Opening the picker rather than writing anything: both columns move
      // together, so there is nothing valid to store until a resort AND a
      // date are known.
      setPicking('second');
    }
  };

  return (
    <View style={styles.wrap}>
      {first ? (
        <ResortCard
          name={first.name}
          meta={TIER_LABEL[first.tier] ?? first.tier}
          tone={theme[TierTone[first.tier] ?? 'brandTeal']}
          range={split && trip.resort_switch_on ? nights(trip.start_date, trip.resort_switch_on) : null}
          onPress={() => router.push({ pathname: '/resort/[id]', params: { id: first.id } })}
          onChange={() => setPicking('first')}
        />
      ) : (
        <Pressable
          onPress={() => setPicking('first')}
          accessibilityRole="button"
          style={[styles.dashed, { borderColor: theme.border }]}
        >
          <ThemedText type="small" style={{ color: theme.accent }}>
            Choose a resort
          </ThemedText>
        </Pressable>
      )}

      {/* Only once there is a first resort: a split stay is a second hotel,
          and offering it before the first is named is offering to fill in
          the end of a sentence that has no beginning. */}
      {first && roomToSplit ? (
        <Pressable
          onPress={() => void toggleSplit()}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: split }}
          accessibilityLabel="Split stay — two resorts on this trip"
          style={({ pressed }) => [styles.splitRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View
            style={[
              styles.tick,
              split
                ? { backgroundColor: theme.accent }
                : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
            ]}
          >
            {split ? (
              <ThemedText style={[styles.tickMark, { color: theme.onAccent }]}>✓</ThemedText>
            ) : null}
          </View>
          <ThemedText type="small" themeColor={split ? 'text' : 'textSecondary'}>
            Split stay — we move to a second resort
          </ThemedText>
        </Pressable>
      ) : null}

      {split ? (
        <>
          {second ? (
            <ResortCard
              name={second.name}
              meta={TIER_LABEL[second.tier] ?? second.tier}
              tone={theme[TierTone[second.tier] ?? 'brandTeal']}
              range={trip.resort_switch_on ? nights(trip.resort_switch_on, trip.end_date) : null}
              onPress={() => router.push({ pathname: '/resort/[id]', params: { id: second.id } })}
              onChange={() => setPicking('second')}
            />
          ) : null}

          <DateField
            label="Moving on"
            value={trip.resort_switch_on}
            placeholder="Pick a day"
            minISO={dates.min}
            maxISO={dates.max}
            openOn={trip.start_date}
            onChange={(iso) => {
              if (!trip.resort_id_2) return;
              void setSplitStay(trip.id, { resortId: trip.resort_id_2, switchOn: iso });
              tapSaved();
            }}
          />
        </>
      ) : null}

      <ResortSheet
        visible={picking !== null}
        title={picking === 'second' ? 'Second resort' : 'Where are you staying?'}
        /* The first resort cannot also be the second: the whole point is
           that it is a different hotel, and allowing it would print a move
           to the place you are already in. */
        excludeId={picking === 'second' ? trip.resort_id : trip.resort_id_2}
        onClose={() => setPicking(null)}
        onPick={async (id) => {
          const which = picking;
          setPicking(null);
          if (which === 'first') {
            await setResort(trip.id, id);
          } else {
            // A date already chosen survives changing which hotel it is; a
            // first-time split has none yet and the DateField below is the
            // next thing on screen.
            await setSplitStay(trip.id, {
              resortId: id,
              switchOn: trip.resort_switch_on ?? dates.min,
            });
          }
          tapSaved();
        }}
      />
    </View>
  );
}

function ResortCard({
  name,
  meta,
  tone,
  range,
  onPress,
  onChange,
}: {
  name: string;
  meta: string;
  tone: string;
  /** "3 nights", when the stay is split and the dates are known. */
  range: string | null;
  onPress: () => void;
  onChange: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      <View style={[styles.bar, { backgroundColor: tone }]} />
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.cardText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
          {range ? `${meta} · ${range}` : meta}
        </ThemedText>
      </Pressable>
      {/* A separate target from the card. Tapping the resort should open the
          resort — that is what it looks like it does — so changing it needs
          its own word rather than stealing the obvious tap. */}
      <Pressable onPress={onChange} accessibilityRole="button" hitSlop={10} style={styles.change}>
        <ThemedText type="small" style={{ color: theme.accent }}>
          Change
        </ThemedText>
      </Pressable>
    </View>
  );
}

function ResortSheet({
  visible,
  title,
  excludeId,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  excludeId: string | null;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const theme = useTheme();
  const { data: resorts } = useResorts();
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resorts
      .filter((r) => r.id !== excludeId)
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true));
  }, [resorts, search, excludeId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHead}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
              <ThemedText type="small" style={{ color: theme.accent }}>
                Close
              </ThemedText>
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search resorts"
            placeholderTextColor={theme.textFaint}
            autoCorrect={false}
            style={[
              styles.search,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          />

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {matches.length === 0 ? (
              <ThemedText type="small" themeColor="textFaint" style={styles.empty}>
                Nothing matches that.
              </ThemedText>
            ) : (
              matches.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setSearch('');
                    onPick(r.id);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: theme.borderSoft,
                      backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionBar,
                      { backgroundColor: theme[TierTone[r.tier] ?? 'brandTeal'] },
                    ]}
                  />
                  <View style={styles.optionText}>
                    <ThemedText type="small" numberOfLines={1}>
                      {r.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
                      {TIER_LABEL[r.tier] ?? r.tier}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** `'2027-03-14'` + 1 → `'2027-03-15'`. UTC, like everything else that does
 *  date arithmetic here. */
function addDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Nights between two dates, as a phrase. */
function nights(from: string, to: string): string {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const n = Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
  return n === 1 ? '1 night' : `${n} nights`;
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bar: { width: 4, alignSelf: 'stretch' },
  cardText: { flex: 1, padding: Spacing.three, gap: 1 },
  change: { paddingHorizontal: Spacing.three },
  dashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },

  splitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 2 },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tickMark: { fontSize: 12, fontWeight: '700', lineHeight: 16 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '75%',
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  list: { flexGrow: 0 },
  empty: { paddingVertical: Spacing.three, textAlign: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  optionBar: { width: 3, alignSelf: 'stretch' },
  optionText: { flex: 1, paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.three, gap: 1 },
});
