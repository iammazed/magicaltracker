import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { AreaTone, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { datesBetween, useTrips } from '@/hooks/use-trips';
import { useAreas } from '@/hooks/use-venues';
import type { DayKind, Trip } from '@/lib/local-db';

/**
 * What you plan to be doing on each day of a trip.
 *
 * **Structured, not a notes field, and that is the entire reason this exists
 * rather than exposing the `note` column the trip already has.** A park-per-
 * day can be read back: "you are at EPCOT tomorrow, here are twelve places
 * you have not eaten at" is the app's whole thesis, and it needs a park id,
 * not prose. Free text cannot be queried, cannot drive a notification, and
 * cannot feed the passport.
 *
 * Most days are a park, but not all of them are, so a day is either an area
 * or one of the `DAY_KINDS` — rest or resort. Those are a column of their
 * own rather than entries in the area list, because `area_id` is a foreign
 * key into the catalog and resting is not a place: a sentinel area would
 * show up in every area filter, map and venue count in the app.
 *
 * A resort day reads back as well as a park day does — "you are at the resort
 * tomorrow, you have never been to Trader Sam's" — which is why it is a kind
 * and not simply the absence of one. Only `rest` means nothing to suggest.
 *
 * Deliberately capped at one choice per day plus a note. A day planner is the
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

type ThemeToken = keyof ReturnType<typeof useTheme>;

/**
 * The non-park days, in the order they are offered.
 *
 * Resort first: it is a plan, and a plan the app can act on. A rest day is
 * the absence of one, and belongs last for the same reason "Not decided"
 * belongs first — it is what you pick when there is nothing to pick.
 */
const KINDS: { kind: DayKind; label: string; tone: ThemeToken }[] = [
  { kind: 'resort', label: 'Resort day', tone: 'gold' },
  { kind: 'rest', label: 'Rest day', tone: 'textFaint' },
];

const kindSpec = (k: DayKind) => KINDS.find((s) => s.kind === k);

/** What a day is: an area, a kind, or neither. Never both — `setDay`
 *  enforces it on write and the server has a CHECK constraint for it. */
type Choice = { area: string | null; kind: DayKind | null };

const sameChoice = (a: Choice, b: Choice) => a.area === b.area && a.kind === b.kind;

/**
 * Where you can spend a day, which is NOT every area in the catalog.
 *
 * The five `resort_area` areas — "Magic Kingdom Resort Area" and the rest —
 * are a grouping for the dining list, not an answer to "what are we doing
 * today". Offering them put five near-identical options in a picker that
 * already has a "Resort day" meaning exactly that, and reading "EPCOT" two
 * rows above "EPCOT Resort Area" is a choice nobody should have to make.
 *
 * Districts stay: a Disney Springs day is a real plan.
 */
const dayAreas = <T extends { kind: string }>(areas: T[]) =>
  areas.filter((a) => a.kind !== 'resort_area');

export function TripDays({ trip }: { trip: Trip }) {
  const theme = useTheme();
  const { daysFor, setDay } = useTrips();
  const { data: areas } = useAreas();
  const [editing, setEditing] = useState<string | null>(null);

  const dates = datesBetween(trip.start_date, trip.end_date).slice(0, MAX_ROWS);
  const stored = daysFor(trip.id);
  // Every area, not just the offerable ones: a day stored against a resort
  // area before they were withdrawn still has to render with its name.
  const areaName = new Map(areas.map((a) => [a.id, a.name]));

  return (
    <View style={styles.list}>
      {dates.map((date, i) => {
        const row = stored.get(date);
        const spec = row?.kind ? kindSpec(row.kind) : undefined;
        const tone = row?.area_id
          ? theme[AreaTone[row.area_id] ?? 'brandTeal']
          : spec
            ? (theme[spec.tone] as string)
            : null;
        const label = row?.area_id
          ? areaName.get(row.area_id) ?? row.area_id
          : spec?.label ?? 'Not decided';
        const decided = !!(row?.area_id || spec);
        return (
          <Pressable
            key={date}
            onPress={() => setEditing(date)}
            accessibilityRole="button"
            accessibilityLabel={`Day ${i + 1}, ${weekday(date)}. ${
              decided ? label : 'Nothing chosen'
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
                {label}
              </ThemedText>
              {row?.note ? (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {row.note}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText type="small" style={{ color: theme.accent }}>
              {decided ? 'Change' : 'Choose'}
            </ThemedText>
          </Pressable>
        );
      })}

      {editing ? (
        <DayEditor
          date={editing}
          index={dates.indexOf(editing)}
          areaId={stored.get(editing)?.area_id ?? null}
          kind={stored.get(editing)?.kind ?? null}
          note={stored.get(editing)?.note ?? null}
          onClose={() => setEditing(null)}
          onSave={({ area, kind, note }) => {
            void setDay(trip.id, editing, { areaId: area, kind, note });
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
  kind,
  note,
  onClose,
  onSave,
}: {
  date: string;
  index: number;
  areaId: string | null;
  kind: DayKind | null;
  note: string | null;
  onClose: () => void;
  onSave: (patch: Choice & { note: string | null }) => void;
}) {
  const theme = useTheme();
  const { data: areas } = useAreas();
  // One piece of state, not an area and a kind kept in step: picking either
  // is picking the whole day, and two useStates is how they drift apart.
  const [picked, setPicked] = useState<Choice>({ area: areaId, kind });
  const [text, setText] = useState(note ?? '');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tapping the dimmed area closes the sheet.
            It was a plain View, so the only way out was Save — and the thing
            people reach for first is the back chevron, which sits UNDER this
            backdrop: a Modal renders above the navigation header, so that tap
            landed here and did nothing at all. A sheet you cannot leave
            without committing is a sheet that makes you commit.

            A sibling behind the sheet rather than a Pressable wrapping it.
            Wrapping would put a press responder above the ScrollView and the
            note field and have them negotiate for every touch; this way the
            sheet is simply painted on top and nothing competes. */}
        <Pressable
          style={styles.backdropFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
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
              selected={sameChoice(picked, { area: null, kind: null })}
              onPress={() => setPicked({ area: null, kind: null })}
            />
            {/* Above the parks, not buried under fifteen of them: plenty of
                trips have more resort days than park days, and a list that
                makes you scroll past every park to say "we are staying in"
                reads as though not going is the unusual choice. */}
            {KINDS.map((k) => (
              <AreaOption
                key={k.kind}
                label={k.label}
                tone={k.tone}
                selected={sameChoice(picked, { area: null, kind: k.kind })}
                onPress={() => setPicked({ area: null, kind: k.kind })}
              />
            ))}
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
            {dayAreas(areas).map((a) => (
              <AreaOption
                key={a.id}
                label={a.name}
                tone={AreaTone[a.id] ?? 'brandTeal'}
                selected={sameChoice(picked, { area: a.id, kind: null })}
                onPress={() => setPicked({ area: a.id, kind: null })}
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
                clever features possible later.

                `dayNotes`, not `notes`: same implementation, different thing.
                A visit note is written afterwards about a meal you ate, and
                that copy on a day you have not had yet reads as a bug. */}
            <PremiumGate feature="dayNotes">
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
            onPress={() =>
              onSave({ area: picked.area, kind: picked.kind, note: text.trim() || null })
            }
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
  tone?: ThemeToken;
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

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  /** The dim itself, behind the sheet. `StyleSheet.absoluteFillObject` is not
   *  in the RN 0.86 types, hence the explicit offsets. */
  backdropFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
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
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
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
