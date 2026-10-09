import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addMonths,
  isWithin,
  monthGrid,
  monthLabel,
  monthOf,
  nightsBetween,
  WEEKDAY_LABELS,
  type YearMonth,
} from '@/lib/calendar';

/**
 * Arrive-and-depart on one calendar.
 *
 * Replaces two `YYYY-MM-DD` text fields. Typing a date is the one input in the
 * app where a typo is silent and consequential — `2027-04-31` does not exist,
 * `2072-04-03` is a plausible slip, and a countdown is wrong rather than
 * broken, so nobody notices. A grid cannot produce a date that does not exist.
 *
 * One calendar for both ends rather than two pickers, which is the pattern
 * every travel app uses: tap the arrival, tap the departure, see the nights
 * between them highlighted.
 *
 * All date arithmetic lives in `src/lib/calendar.ts` and is tested there,
 * including leap years, year boundaries and the DST change.
 */
export function DateRangePicker({
  start,
  end,
  minISO,
  onChange,
}: {
  start: string | null;
  end: string | null;
  /** Nothing before this is selectable. Normally today. */
  minISO: string;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const theme = useTheme();

  const minMonth = useMemo<YearMonth>(
    () => monthOf(minISO) ?? { year: new Date().getFullYear(), month: 0 },
    [minISO],
  );
  const [view, setView] = useState<YearMonth>(() => monthOf(start ?? minISO) ?? minMonth);

  const weeks = useMemo(() => monthGrid(view), [view]);
  const atMin = view.year === minMonth.year && view.month === minMonth.month;

  /**
   * One tap, three cases.
   *
   * A tap below the current arrival moves the arrival rather than being
   * rejected — someone correcting themselves should not have to clear the range
   * first. A complete range starts a new one, which is what makes a second
   * attempt feel like a second attempt.
   */
  const press = (iso: string) => {
    if (!start || (start && end)) return onChange(iso, null);
    if (iso === start) return onChange(null, null);
    if (iso < start) return onChange(iso, null);
    return onChange(start, iso);
  };

  const nights = start && end ? nightsBetween(start, end) : 0;

  return (
    <View style={styles.container}>
      {/* ── Month navigation ───────────────────────────────────────── */}
      <View style={styles.head}>
        <Pressable
          onPress={() => setView(addMonths(view, -1))}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={10}
          style={[styles.nav, { opacity: atMin ? 0.25 : 1 }]}
        >
          <ThemedText style={[styles.navMark, { color: theme.accent }]}>‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{monthLabel(view)}</ThemedText>
        <Pressable
          onPress={() => setView(addMonths(view, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={10}
          style={styles.nav}
        >
          <ThemedText style={[styles.navMark, { color: theme.accent }]}>›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAY_LABELS.map((label, i) => (
          <ThemedText
            key={`${label}-${i}`}
            type="small"
            themeColor="textFaint"
            style={styles.weekday}
          >
            {label}
          </ThemedText>
        ))}
      </View>

      {/* ── The grid ───────────────────────────────────────────────── */}
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((cell) => {
            const disabled = !cell.inMonth || cell.iso < minISO;
            const isStart = cell.iso === start;
            const isEnd = cell.iso === end;
            const between = !!start && !!end && isWithin(cell.iso, start, end);

            return (
              <Pressable
                key={cell.iso}
                onPress={() => press(cell.iso)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: isStart || isEnd, disabled }}
                accessibilityLabel={cell.iso}
                style={styles.cell}
              >
                {/* The band sits behind the day and spans the full cell so the
                    nights between the two ends read as one continuous run.
                    The rows carry no gap for the same reason.

                    Only ever drawn once BOTH ends exist. Drawing it from the
                    arrival alone left a half-band trailing off to the right
                    into nothing, which read as a rendering fault. */}
                {start && end && (between || isStart || isEnd) ? (
                  <View
                    style={[
                      styles.band,
                      { backgroundColor: theme.accent, opacity: 0.18 },
                      isStart && !isEnd ? styles.bandFromStart : null,
                      isEnd && !isStart ? styles.bandToEnd : null,
                      isStart && isEnd ? styles.bandNone : null,
                    ]}
                  />
                ) : null}

                <View
                  style={[
                    styles.day,
                    isStart || isEnd ? { backgroundColor: theme.accent } : null,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.dayText,
                      {
                        color:
                          isStart || isEnd
                            ? theme.onAccent
                            : disabled
                              ? theme.textFaint
                              : theme.text,
                        opacity: disabled ? 0.45 : 1,
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

      {/* ── What you have chosen ───────────────────────────────────── */}
      <View style={[styles.summary, { borderColor: theme.borderSoft }]}>
        <ThemedText type="small" themeColor={start && end ? 'textSecondary' : 'textFaint'}>
          {!start
            ? 'Tap the day you arrive'
            : !end
              ? 'Now tap the day you leave'
              : `${nights} ${nights === 1 ? 'night' : 'nights'}`}
        </ThemedText>
        {start ? (
          <Pressable onPress={() => onChange(null, null)} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" style={{ color: theme.accent }}>
              Clear
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const CELL = 40;

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  nav: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  navMark: { fontSize: 26, lineHeight: 30, fontWeight: '700' },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11 },
  // No gap: the range band has to run unbroken between the two ends.
  week: { flexDirection: 'row' },
  cell: {
    flex: 1,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: { position: 'absolute', left: 0, right: 0, top: 4, bottom: 4 },
  // Rounded on the outer edge of each end so the run has caps rather than
  // being clipped flat against nothing.
  bandFromStart: { left: '50%', borderTopLeftRadius: CELL, borderBottomLeftRadius: CELL },
  bandToEnd: { right: '50%', borderTopRightRadius: CELL, borderBottomRightRadius: CELL },
  bandNone: { left: '50%', right: '50%' },
  day: {
    width: CELL - 8,
    height: CELL - 8,
    borderRadius: (CELL - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
