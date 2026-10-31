import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { AreaTone, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { datesBetween, useTrips } from '@/hooks/use-trips';
import { useAreas, useVenues } from '@/hooks/use-venues';
import type { DayKind, Trip, TripPlan } from '@/lib/local-db';

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
 * Each day also carries the meals planned for it. The dining list used to be
 * one flat block at the bottom of the trip screen, which told you five
 * restaurants were on the trip and nothing about when — the question the
 * screen is open to answer. A meal with no day stays in that block, which is
 * now explicitly the pool of things still to place.
 *
 * Deliberately capped at one choice per day, a note, and the meals. A day
 * planner is the single feature most likely to grow into a full itinerary app
 * — ride plans, reservation times, transport, travel party — and none of that
 * is worth building before anyone has used this. In particular there is no
 * TIME on a meal, so the day's list is in the order you added them: inventing
 * a 7pm would be inventing data the user never gave.
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
  const router = useRouter();
  const { daysFor, plansFor, setDay, setPlanDay } = useTrips();
  const { data: areas } = useAreas();
  const { data: venues } = useVenues();
  const [editing, setEditing] = useState<string | null>(null);

  // Memoised so it is one stable array: `mealsByDay` depends on it, and a
  // fresh array every render would make that memo do nothing.
  const dates = useMemo(
    () => datesBetween(trip.start_date, trip.end_date).slice(0, MAX_ROWS),
    [trip.start_date, trip.end_date],
  );
  const stored = daysFor(trip.id);
  // Every area, not just the offerable ones: a day stored against a resort
  // area before they were withdrawn still has to render with its name.
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const venueName = useMemo(
    () => new Map(venues.map((v) => [v.id, v.name])),
    [venues],
  );

  /** Meals by day. Only the dates this trip actually covers, so moving a
   *  trip's dates returns a stranded meal to the pool rather than keeping it
   *  attached to a day nobody can reach. */
  const mealsByDay = useMemo(() => {
    const inRange = new Set(dates);
    const map = new Map<string, TripPlan[]>();
    for (const p of plansFor(trip.id)) {
      if (!p.planned_on || !inRange.has(p.planned_on)) continue;
      const list = map.get(p.planned_on);
      if (list) list.push(p);
      else map.set(p.planned_on, [p]);
    }
    return map;
  }, [plansFor, trip.id, dates]);

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
        const meals = mealsByDay.get(date) ?? [];
        return (
          /* A card, not a single Pressable, since the day gained meals: the
             header opens the editor and each meal is its own target. Nesting
             those inside one outer Pressable would make every meal tap also
             count as a tap on the day. */
          <View
            key={date}
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <View style={[styles.bar, { backgroundColor: tone ?? theme.borderSoft }]} />
            <View style={styles.cardBody}>
              <Pressable
                onPress={() => setEditing(date)}
                accessibilityRole="button"
                accessibilityLabel={`Day ${i + 1}, ${weekday(date)}. ${
                  decided ? label : 'Nothing chosen'
                }. Tap to change.`}
                style={({ pressed }) => [
                  styles.head,
                  pressed ? { backgroundColor: theme.backgroundSelected } : null,
                ]}
              >
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

              <View style={[styles.meals, { borderTopColor: theme.borderSoft }]}>
                {meals.map((p) => (
                  <View key={p.id} style={styles.meal}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/venue/[id]',
                          params: { id: p.venue_id },
                        })
                      }
                      accessibilityRole="button"
                      style={styles.mealMain}
                    >
                      <ThemedText type="small" numberOfLines={1}>
                        {venueName.get(p.venue_id) ?? p.venue_id}
                      </ThemedText>
                    </Pressable>
                    {p.booked ? (
                      <ThemedText
                        type="small"
                        style={[styles.booked, { color: theme.gold }]}
                      >
                        Booked
                      </ThemedText>
                    ) : null}
                    {/* Takes the meal off the DAY, not off the trip — it goes
                        back to the pool below, where removing it entirely is
                        the ✕. One destructive action per scope, and the
                        recoverable one is the one on the crowded row. */}
                    <Pressable
                      onPress={() => void setPlanDay(p.id, null)}
                      accessibilityRole="button"
                      accessibilityLabel={`Take ${
                        venueName.get(p.venue_id) ?? 'this place'
                      } off day ${i + 1}`}
                      hitSlop={8}
                    >
                      <ThemedText type="small" themeColor="textFaint">
                        ✕
                      </ThemedText>
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/dining',
                      params: { addToTrip: trip.id, planDay: date },
                    })
                  }
                  accessibilityRole="button"
                  style={styles.addMeal}
                >
                  <ThemedText type="small" style={{ color: theme.accent }}>
                    {meals.length ? '+ Add another restaurant' : '+ Add a restaurant'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
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

/**
 * "Place" on a meal that has no day yet, with the picker behind it.
 *
 * Exported so the pool on the trip screen can use it. Without this the pool
 * was a list you could only delete from: the day cards can pull a restaurant
 * onto a day, but only by going out to the dining list and finding it again,
 * which is a long way round for something already on the trip.
 *
 * It lives here rather than on the trip screen because it needs the derived
 * date list and `weekday`, and a second copy of either is a second place for
 * the UTC date handling to be got wrong.
 */
export function PlaceOnDay({ trip, plan }: { trip: Trip; plan: TripPlan }) {
  const theme = useTheme();
  const { daysFor, setPlanDay } = useTrips();
  const { data: areas } = useAreas();
  const [open, setOpen] = useState(false);

  const dates = useMemo(
    () => datesBetween(trip.start_date, trip.end_date).slice(0, MAX_ROWS),
    [trip.start_date, trip.end_date],
  );
  const stored = daysFor(trip.id);
  const areaName = new Map(areas.map((a) => [a.id, a.name]));

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Put this on a day"
        hitSlop={6}
      >
        <ThemedText type="small" style={{ color: theme.accent, fontSize: 11 }}>
          Place
        </ThemedText>
      </Pressable>

      {open ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <Pressable
              style={styles.backdropFill}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
            <View style={[styles.sheet, { backgroundColor: theme.background }]}>
              <View style={styles.sheetHead}>
                <ThemedText type="smallBold">Which day?</ThemedText>
                <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button">
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
              <ScrollView style={styles.areaScroll} contentContainerStyle={styles.areaList}>
                {dates.map((date, i) => {
                  const row = stored.get(date);
                  const spec = row?.kind ? kindSpec(row.kind) : undefined;
                  // What the day already is, so you are placing dinner against
                  // "EPCOT" rather than against a bare date.
                  const what = row?.area_id
                    ? areaName.get(row.area_id) ?? row.area_id
                    : spec?.label ?? 'Not decided';
                  return (
                    <AreaOption
                      key={date}
                      label={`Day ${i + 1} · ${weekday(date)}  —  ${what}`}
                      tone={
                        row?.area_id
                          ? AreaTone[row.area_id] ?? 'brandTeal'
                          : spec?.tone ?? undefined
                      }
                      selected={plan.planned_on === date}
                      onPress={() => {
                        void setPlanDay(plan.id, date);
                        setOpen(false);
                      }}
                    />
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
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
  card: {
    flexDirection: 'row',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  /** The colour bar is a sibling now, so the inset that used to be the row's
   *  `gap` lives here and every child inherits it. */
  cardBody: { flex: 1, paddingLeft: Spacing.three },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingRight: Spacing.three,
  },
  bar: { width: 5, alignSelf: 'stretch' },
  rowMain: { flex: 1, paddingVertical: Spacing.three, gap: 1 },

  meals: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingRight: Spacing.three,
    paddingBottom: Spacing.one,
  },
  meal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  mealMain: { flex: 1 },
  booked: { fontSize: 11 },
  addMeal: { paddingVertical: Spacing.two },
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
