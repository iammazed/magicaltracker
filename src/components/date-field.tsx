import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addMonths,
  compareMonths,
  formatShort,
  monthGrid,
  monthLabel,
  MONTH_SHORT,
  monthOf,
  WEEKDAY_LABELS,
  type YearMonth,
} from '@/lib/calendar';

/**
 * A date box that opens a small calendar.
 *
 * The box shows the chosen date and stays the size of a text field, so the
 * planner is two boxes and a button until someone taps one. An
 * always-expanded calendar is a lot of screen for a control used once per
 * trip.
 *
 * Nothing is typed. A typo in a date is silent and consequential —
 * `2027-04-31` does not exist, `2072-04-03` is a plausible slip, and a
 * countdown that is wrong rather than broken is one nobody questions. Tapping
 * a grid cannot produce a date that does not exist.
 *
 * All the arithmetic is in `src/lib/calendar.ts`, which is pure and tested
 * headlessly: leap years, year boundaries, the DST change, and every month of
 * a decade checked contiguous.
 */
export function DateField({
  label,
  value,
  placeholder,
  minISO,
  maxISO,
  disabled,
  tone = 'surface',
  openOn,
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  /** Nothing before this is selectable. */
  minISO: string;
  /** Nothing after this is selectable. Omit for no ceiling. */
  maxISO?: string;
  disabled?: boolean;
  /** `sky` for the twilight gradient, where theme text tokens are invisible. */
  tone?: 'surface' | 'sky';
  /** Month to open on when empty. Defaults to the minimum. */
  openOn?: string;
  onChange: (iso: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const sky = tone === 'sky';

  // On the gradient everything is a literal: the theme's own tokens invert
  // with the OS and would vanish against a surface that is dark in both
  // schemes. Gold on a filled box because gold is the brand's "this is
  // yours now" colour and it carries on twilight better than white does.
  const palette = sky
    ? {
        label: 'rgba(255,255,255,0.62)',
        fill: value ? 'rgba(229,180,95,0.16)' : 'rgba(255,255,255,0.10)',
        pressedFill: 'rgba(255,255,255,0.18)',
        border: value ? '#E5B45F' : 'rgba(255,255,255,0.26)',
        text: value ? '#F6E3BE' : 'rgba(255,255,255,0.58)',
      }
    : {
        label: theme.textFaint,
        fill: theme.backgroundElement,
        pressedFill: theme.backgroundSelected,
        border: value ? theme.accent : theme.border,
        text: value ? theme.text : theme.textFaint,
      };

  return (
    <View style={styles.field}>
      <ThemedText style={[styles.label, { color: palette.label }]}>
        {label.toUpperCase()}
      </ThemedText>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `${label}: ${formatShort(value)}. Tap to change.` : `Choose ${label}`
        }
        style={({ pressed }) => [
          styles.box,
          {
            backgroundColor: pressed ? palette.pressedFill : palette.fill,
            borderColor: palette.border,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        <ThemedText
          numberOfLines={1}
          style={[value ? styles.valueText : styles.placeholderText, { color: palette.text }]}
        >
          {value ? formatShort(value) : placeholder}
        </ThemedText>
      </Pressable>

      <CalendarSheet
        visible={open}
        title={`Choose ${label.toLowerCase()}`}
        value={value}
        minISO={minISO}
        maxISO={maxISO}
        openOn={openOn}
        onClose={() => setOpen(false)}
        onPick={(iso) => {
          onChange(iso);
          setOpen(false);
        }}
      />
    </View>
  );
}

/**
 * The small calendar.
 *
 * A `Modal` rather than an absolutely-positioned popover: a popover inside the
 * home screen's ScrollView would be clipped by it and would scroll away from
 * the field it belongs to.
 */
function CalendarSheet({
  visible,
  title,
  value,
  minISO,
  maxISO,
  openOn,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  value: string | null;
  minISO: string;
  maxISO?: string;
  /** Which month to show when there is no value yet. Without it a picker
   *  whose floor is 1971 opens in 1971, which is a lot of paging. */
  openOn?: string;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const theme = useTheme();

  const minMonth = useMemo<YearMonth>(
    () => monthOf(minISO) ?? { year: new Date().getFullYear(), month: 0 },
    [minISO],
  );
  // Opens on the month of the current value, or on the earliest allowed month.
  const [view, setView] = useState<YearMonth>(
    () => monthOf(value ?? openOn ?? minISO) ?? minMonth,
  );
  const weeks = useMemo(() => monthGrid(view), [view]);
  const atMin = view.year === minMonth.year && view.month === minMonth.month;
  const maxMonth = maxISO ? monthOf(maxISO) : null;
  const atMax = maxMonth
    ? view.year === maxMonth.year && view.month === maxMonth.month
    : false;

  /**
   * Days, or the year-and-month level above them.
   *
   * The arrows move one month per tap, which is right for a trip being
   * planned next spring and useless for a meal eaten on a trip in 2019 —
   * that is eighty-odd taps, so in practice the past was unreachable and the
   * floor being 1971 was a promise the picker did not keep. Tapping the month
   * name opens the level that can cover years.
   */
  const [mode, setMode] = useState<'days' | 'months'>('days');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // Reopening should land on the relevant month rather than wherever the
      // user paged to last time, and on the day grid rather than halfway
      // through last time's hunt for a year.
      onShow={() => {
        setView(monthOf(value ?? openOn ?? minISO) ?? minMonth);
        setMode('days');
      }}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* A Pressable that swallows the tap, so pressing inside the card does
            not close it through the backdrop behind. */}
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <View style={styles.cardHead}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
              <ThemedText type="small" style={{ color: theme.accentText }}>
                Close
              </ThemedText>
            </Pressable>
          </View>

          {mode === 'days' ? (
            <View style={styles.monthRow}>
              <Pressable
                onPress={() => setView(addMonths(view, -1))}
                disabled={atMin}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                hitSlop={8}
                style={[styles.nav, { opacity: atMin ? 0.25 : 1 }]}
              >
                <ThemedText style={[styles.navMark, { color: theme.accentText }]}>‹</ThemedText>
              </Pressable>
              {/* The month name is the way up a level, which is where iOS and
                  Android both put it, so the caret is the only hint needed. */}
              <Pressable
                onPress={() => setMode('months')}
                accessibilityRole="button"
                accessibilityLabel={`${monthLabel(view)}. Choose a different month or year.`}
                hitSlop={8}
                style={styles.monthButton}
              >
                <ThemedText type="small">{monthLabel(view)}</ThemedText>
                <ThemedText style={[styles.caret, { color: theme.accentText }]}>▾</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setView(addMonths(view, 1))}
                disabled={atMax}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                hitSlop={8}
                style={[styles.nav, { opacity: atMax ? 0.25 : 1 }]}
              >
                <ThemedText style={[styles.navMark, { color: theme.accentText }]}>›</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {mode === 'months' ? (
            <MonthPicker
              view={view}
              minMonth={minMonth}
              maxMonth={maxMonth}
              openOn={openOn}
              onPick={(ym) => {
                setView(ym);
                setMode('days');
              }}
            />
          ) : (
            <>
              <View style={styles.weekdays}>
                {WEEKDAY_LABELS.map((d, i) => (
                  <ThemedText
                    key={`${d}-${i}`}
                    type="small"
                    themeColor="textFaint"
                    style={styles.weekday}
                  >
                    {d}
                  </ThemedText>
                ))}
              </View>

              {weeks.map((week, w) => (
                <View key={w} style={styles.week}>
                  {week.map((cell) => {
                    const disabled =
                      !cell.inMonth || cell.iso < minISO || (!!maxISO && cell.iso > maxISO);
                    const selected = cell.iso === value;
                    return (
                      <Pressable
                        key={cell.iso}
                        onPress={() => onPick(cell.iso)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        accessibilityLabel={cell.iso}
                        style={styles.cell}
                      >
                        <View
                          style={[
                            styles.day,
                            selected ? { backgroundColor: theme.accent } : null,
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.dayText,
                              {
                                color: selected
                                  ? theme.onAccent
                                  : disabled
                                    ? theme.textFaint
                                    : theme.text,
                                opacity: disabled ? 0.4 : 1,
                              },
                            ]}
                          >
                            {cell.day}
                          </ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The level above days: step the year, pick a month.
 *
 * Two taps and a few years of arrow gets you to a trip from 2019, where the
 * month arrows alone would have taken eighty-four. Deliberately only two
 * levels deep — a decade grid above this would be a third screen to learn for
 * the handful of people logging something from the nineties, and they can
 * hold the arrow.
 *
 * The year lives in local state, so paging through years does not move the
 * day grid underneath; `view` only changes once a month is actually chosen.
 */
function MonthPicker({
  view,
  minMonth,
  maxMonth,
  openOn,
  onPick,
}: {
  view: YearMonth;
  minMonth: YearMonth;
  maxMonth: YearMonth | null;
  openOn?: string;
  onPick: (ym: YearMonth) => void;
}) {
  const theme = useTheme();

  /**
   * Without a `maxISO` the stepper still needs a ceiling, or the arrow walks
   * to the year 9999.
   *
   * Two years past the month the picker opens on, which is as far out as
   * anyone books a Disney trip and further than any visit is ever dated.
   * It bounds NAVIGATION only — the day grid keeps its own exact min and
   * max, and log-visit deliberately has no ceiling at all, so this cannot
   * make a date selectable that was not already.
   */
  const anchorYear = monthOf(openOn ?? '')?.year ?? view.year;
  const minYear = minMonth.year;
  const maxYear = maxMonth ? maxMonth.year : Math.max(view.year, anchorYear + 2);

  const [year, setYear] = useState(() =>
    Math.min(Math.max(view.year, minYear), maxYear),
  );

  return (
    <View style={styles.months}>
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => setYear((y) => y - 1)}
          disabled={year <= minYear}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
          hitSlop={8}
          style={[styles.nav, { opacity: year <= minYear ? 0.25 : 1 }]}
        >
          <ThemedText style={[styles.navMark, { color: theme.accentText }]}>‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{year}</ThemedText>
        <Pressable
          onPress={() => setYear((y) => y + 1)}
          disabled={year >= maxYear}
          accessibilityRole="button"
          accessibilityLabel="Next year"
          hitSlop={8}
          style={[styles.nav, { opacity: year >= maxYear ? 0.25 : 1 }]}
        >
          <ThemedText style={[styles.navMark, { color: theme.accentText }]}>›</ThemedText>
        </Pressable>
      </View>

      {[0, 3, 6, 9].map((start) => (
        <View key={start} style={styles.monthGridRow}>
          {MONTH_SHORT.slice(start, start + 3).map((label, offset) => {
            const month = start + offset;
            const cell = { year, month };
            // A whole month is out of reach only when it sits entirely
            // outside the range, which is a month comparison rather than a
            // date one — October 1971 is open even though the 1st is the
            // earliest day in it.
            const disabled =
              compareMonths(cell, minMonth) < 0 ||
              (!!maxMonth && compareMonths(cell, maxMonth) > 0);
            const selected = year === view.year && month === view.month;
            return (
              <Pressable
                key={label}
                onPress={() => onPick(cell)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={`${label} ${year}`}
                style={styles.monthCell}
              >
                <View
                  style={[
                    styles.monthPill,
                    selected
                      ? { backgroundColor: theme.accent }
                      : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: selected
                        ? theme.onAccent
                        : disabled
                          ? theme.textFaint
                          : theme.text,
                      opacity: disabled ? 0.4 : 1,
                    }}
                  >
                    {label}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL = 40;

const styles = StyleSheet.create({
  field: { flex: 1, gap: Spacing.one + 2 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  box: {
    height: 54,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  valueText: { fontSize: 17, fontWeight: '700' },
  placeholderText: { fontSize: 15 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nav: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  navMark: { fontSize: 24, lineHeight: 28, fontWeight: '700' },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  caret: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  // Four rows of three at 56 each, plus the year row, lands within a few
  // points of the six-week day grid — so flipping between the two levels does
  // not resize the card under your thumb.
  months: { gap: Spacing.one },
  monthGridRow: { flexDirection: 'row' },
  monthCell: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' },
  monthPill: {
    minWidth: 64,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: CELL - 6,
    height: CELL - 6,
    borderRadius: (CELL - 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15 },
});
