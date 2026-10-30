import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { AreaTone, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { datesBetween, useTrips } from '@/hooks/use-trips';
import { useAreas } from '@/hooks/use-venues';
import type { Trip } from '@/lib/local-db';

/**
 * Which park you plan to be in on each day of a trip.
 *
 * **Structured, not a notes field, and that is the entire reason this exists
 * rather than exposing the `note` column the trip already has.** A park-per-
 * day can be read back: "you are at EPCOT tomorrow, here are twelve places
 * you have not eaten at" is the app's whole thesis, and it needs a park id,
 * not prose. Free text cannot be queried, cannot drive a notification, and
 * cannot feed the passport.
 *
 * Deliberately capped at one park per day plus a note. A day planner is the
 * single feature most likely to grow into a full itinerary app — ride plans,
 * reservation times, transport, travel party — and none of that is worth
 * building before anyone has used this.
 *
 * **The day list is derived from the trip's own dates, never stored.** Rows
 * exist only for days something has been decided about, so an untouched trip
 * holds zero rows instead of seven empty ones, and moving a trip's dates
 * cannot strand a row outside the range it now covers.
 */

/** A trip long enough to hit this is a data-entry mistake, not a holiday. */
const MAX_ROWS = 60;

export function TripDays({ trip }: { trip: Trip }) {
  const theme = useTheme();
  const { daysFor, setDay } = useTrips();
  const { data: areas } = useAreas();
  const [editing, setEditing] = useState<string | null>(null);

  const dates = datesBetween(trip.start_date, trip.end_date).slice(0, MAX_ROWS);
  const stored = daysFor(trip.id);
  const areaName = new Map(areas.map((a) => [a.id, a.name]));

  return (
    <View style={styles.list}>
      {dates.map((date, i) => {
        const row = stored.get(date);
        const tone = row?.area_id ? theme[AreaTone[row.area_id] ?? 'brandTeal'] : null;
        return (
          <Pressable
            key={date}
            onPress={() => setEditing(date)}
            accessibilityRole="button"
            accessibilityLabel={`Day ${i + 1}, ${weekday(date)}. ${
              row?.area_id ? areaName.get(row.area_id) ?? row.area_id : 'No park chosen'
            }. Tap to change.`}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.bar, { backgroundColor: tone ?? theme.borderSoft }]} />
            <View style={styles.rowMain}>
              <ThemedText type="small" themeColor="textFaint" style={styles.dayNum}>
                DAY {i + 1} · {weekday(date)}
              </ThemedText>
              <ThemedText type="smallBold" numberOfLines={1}>
                {row?.area_id ? areaName.get(row.area_id) ?? row.area_id : 'Not decided'}
              </ThemedText>
              {row?.note ? (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {row.note}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText type="small" style={{ color: theme.accent }}>
              {row?.area_id ? 'Change' : 'Choose'}
            </ThemedText>
          </Pressable>
        );
      })}

      {editing ? (
        <DayEditor
          date={editing}
          index={dates.indexOf(editing)}
          areaId={stored.get(editing)?.area_id ?? null}
          note={stored.get(editing)?.note ?? null}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            void setDay(trip.id, editing, patch);
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

function DayEditor({
  date,
  index,
  areaId,
  note,
  onClose,
  onSave,
}: {
  date: string;
  index: number;
  areaId: string | null;
  note: string | null;
  onClose: () => void;
  onSave: (patch: { areaId: string | null; note: string | null }) => void;
}) {
  const theme = useTheme();
  const { data: areas } = useAreas();
  const [picked, setPicked] = useState<string | null>(areaId);
  const [text, setText] = useState(note ?? '');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.sheetHead}>
            <ThemedText type="smallBold">
              Day {index + 1} · {weekday(date)}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.areaScroll} contentContainerStyle={styles.areaList}>
            {/* Clearing back to undecided is a real action, so it is an
                option rather than something you reach by deselecting. */}
            <AreaOption
              label="Not decided"
              selected={picked === null}
              onPress={() => setPicked(null)}
            />
            {areas.map((a) => (
              <AreaOption
                key={a.id}
                label={a.name}
                tone={AreaTone[a.id] ?? 'brandTeal'}
                selected={picked === a.id}
                onPress={() => setPicked(a.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.noteBlock}>
            <ThemedText type="small" themeColor="textFaint" style={styles.noteLabel}>
              NOTE
            </ThemedText>
            {/* Premium, for consistency rather than for revenue: a visit note
                is already premium, and a day note being free would be the
                kind of inconsistency people notice and resent. Choosing the
                park stays free — it is data entry, and it is what makes the
                clever features possible later. */}
            <PremiumGate feature="notes">
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Rope drop, dinner at 7, early night…"
                placeholderTextColor={theme.textFaint}
                multiline
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
            </PremiumGate>
          </View>

          <Pressable
            onPress={() => onSave({ areaId: picked, note: text.trim() || null })}
            accessibilityRole="button"
            style={[styles.save, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Save
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AreaOption({
  label,
  tone,
  selected,
  onPress,
}: {
  label: string;
  tone?: keyof ReturnType<typeof useTheme>;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = tone ? (theme[tone] as string) : theme.textFaint;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.areaOption,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" numberOfLines={1} style={styles.areaLabel}>
        {label}
      </ThemedText>
      {selected ? (
        <ThemedText type="small" style={{ color: theme.accent }}>
          ✓
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Mon 2 Nov". Built with `Date.UTC`, so the label cannot slip a day west
 *  of Greenwich the way a parsed `new Date('2027-04-03')` would. */
function weekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingRight: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bar: { width: 5, alignSelf: 'stretch' },
  rowMain: { flex: 1, paddingVertical: Spacing.three, gap: 1 },
  dayNum: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '85%',
    padding: Spacing.three,
    gap: Spacing.three,
    borderTopLeftRadius: Radius.large + 8,
    borderTopRightRadius: Radius.large + 8,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  areaScroll: { flexGrow: 0 },
  areaList: { gap: Spacing.one + 2 },
  areaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  areaLabel: { flex: 1 },
  noteBlock: { gap: Spacing.one },
  noteLabel: { letterSpacing: 1, fontSize: 10, fontWeight: '700' },
  noteInput: {
    minHeight: 72,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  save: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
});
