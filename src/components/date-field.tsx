import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addMonths,
  formatShort,
  monthGrid,
  monthLabel,
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
  disabled,
  tone = 'surface',
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  /** Nothing before this is selectable. */
  minISO: string;
  disabled?: boolean;
  /** `sky` for the twilight gradient, where theme text tokens are invisible. */
  tone?: 'surface' | 'sky';
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
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  value: string | null;
  minISO: string;
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
    () => monthOf(value ?? minISO) ?? minMonth,
  );
  const weeks = useMemo(() => monthGrid(view), [view]);
  const atMin = view.year === minMonth.year && view.month === minMonth.month;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // Reopening should land on the relevant month rather than wherever the
      // user paged to last time.
      onShow={() => setView(monthOf(value ?? minISO) ?? minMonth)}
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
              <ThemedText type="small" style={{ color: theme.accent }}>
                Close
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              onPress={() => setView(addMonths(view, -1))}
              disabled={atMin}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              hitSlop={8}
              style={[styles.nav, { opacity: atMin ? 0.25 : 1 }]}
            >
              <ThemedText style={[styles.navMark, { color: theme.accent }]}>‹</ThemedText>
            </Pressable>
            <ThemedText type="small">{monthLabel(view)}</ThemedText>
            <Pressable
              onPress={() => setView(addMonths(view, 1))}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              hitSlop={8}
              style={styles.nav}
            >
              <ThemedText style={[styles.navMark, { color: theme.accent }]}>›</ThemedText>
            </Pressable>
          </View>

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
                const disabled = !cell.inMonth || cell.iso < minISO;
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
        </Pressable>
      </Pressable>
    </Modal>
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
