import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/clock';

/**
 * A reservation time, picked rather than typed.
 *
 * ## Nothing is typed, for the same reason as `DateField`
 *
 * A mistyped time is silent and consequential. "7:4pm" and "19:4" are both
 * things a thumb produces, `07:40` for a dinner booking is a plausible slip,
 * and a shared itinerary telling four people to turn up twelve hours early
 * is wrong rather than broken — which is the kind nobody questions. Tapping
 * an hour and a minute cannot produce a time that does not exist.
 *
 * ## Hours then minutes, not a list of every slot
 *
 * Five-minute granularity from 6am to 11pm is 205 rows, which is a scroll
 * through a haystack. Eighteen hours and twelve minutes is two taps and
 * fits on one sheet with nothing hidden.
 *
 * ## No native picker
 *
 * `@react-native-community/datetimepicker` is the obvious answer and is a
 * NATIVE dependency, so adding it changes the runtime fingerprint and forces
 * a new binary — see the fingerprint section in AGENTS.md. This is a
 * fortnight of waiting for a TestFlight build, to pick a time.
 */

/** 6am to 11pm. Disney dining does not start at four in the morning, and an
 *  hour list that pretends it might is seventeen rows of noise. */
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TimeField({
  value,
  onChange,
  compact,
}: {
  /** 'HH:MM' in 24-hour time, or null. */
  value: string | null;
  onChange: (time: string | null) => void;
  /** Renders as a small inline chip rather than a full field. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `Reservation at ${formatTime(value)}. Tap to change.` : 'Add a reservation time'
        }
        hitSlop={8}
        style={({ pressed }) => [
          compact ? styles.chip : styles.box,
          {
            borderColor: value ? theme.accent : theme.border,
            backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          },
        ]}
      >
        <ThemedText
          type="small"
          style={{ color: value ? theme.accent : theme.textFaint, fontWeight: value ? '700' : '400' }}
        >
          {value ? formatTime(value) : 'Add time'}
        </ThemedText>
      </Pressable>

      <TimeSheet
        visible={open}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(t) => {
          onChange(t);
          setOpen(false);
        }}
      />
    </>
  );
}

function TimeSheet({
  visible,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: string | null;
  onClose: () => void;
  onPick: (time: string | null) => void;
}) {
  const theme = useTheme();

  const [h, m] = value ? value.split(':').map(Number) : [null, null];
  /**
   * The half-finished selection lives here, not in the parent.
   *
   * Picking an hour has to show on screen before a minute is chosen, and
   * writing `19:00` to the database the moment somebody taps 7pm would mean
   * every abandoned sheet leaves a wrong time behind. The row is written
   * once, when both halves are known.
   */
  const [hour, setHour] = useState<number | null>(h);
  const [minute, setMinute] = useState<number | null>(m);

  // Re-seed each time the sheet opens, so reopening shows the stored value
  // rather than whatever was being picked when it was last dismissed.
  const [seeded, setSeeded] = useState(visible);
  if (visible !== seeded) {
    setSeeded(visible);
    if (visible) {
      setHour(h);
      setMinute(m);
    }
  }

  const label = (n: number) => {
    const suffix = n < 12 ? 'am' : 'pm';
    const twelve = n % 12 === 0 ? 12 : n % 12;
    return `${twelve}${suffix}`;
  };

  const commit = (nextHour: number | null, nextMinute: number | null) => {
    if (nextHour === null) return;
    // A minute that was never chosen means on the hour, which is what
    // somebody tapping only "7pm" and then Done plainly intends.
    const mm = nextMinute ?? 0;
    onPick(`${String(nextHour).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows the tap so a press inside the card does not close it. */}
        <Pressable
          style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => {}}
        >
          <View style={styles.cardHead}>
            <ThemedText type="smallBold">Reservation time</ThemedText>
            <ThemedText type="small" themeColor="textFaint">
              {hour === null ? 'Pick an hour' : formatTime(
                `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`,
              )}
            </ThemedText>
          </View>

          <ScrollView style={styles.hourScroll} contentContainerStyle={styles.grid}>
            {HOURS.map((n) => {
              const on = hour === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setHour(n)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.cell,
                    {
                      borderColor: on ? theme.accent : theme.border,
                      backgroundColor: on ? theme.accent : 'transparent',
                    },
                  ]}
                >
                  <ThemedText type="small" style={{ color: on ? theme.onAccent : theme.text }}>
                    {label(n)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.rule, { backgroundColor: theme.borderSoft }]} />

          <View style={styles.grid}>
            {MINUTES.map((n) => {
              const on = minute === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setMinute(n)}
                  disabled={hour === null}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.cell,
                    {
                      borderColor: on ? theme.accent : theme.border,
                      backgroundColor: on ? theme.accent : 'transparent',
                      opacity: hour === null ? 0.4 : 1,
                    },
                  ]}
                >
                  <ThemedText type="small" style={{ color: on ? theme.onAccent : theme.text }}>
                    :{String(n).padStart(2, '0')}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            {/* Clearing is a real action and belongs here rather than behind a
                long press: a reservation gets cancelled as often as it gets
                moved. */}
            <Pressable onPress={() => onPick(null)} accessibilityRole="button" hitSlop={8}>
              <ThemedText type="small" style={{ color: theme.danger }}>
                {value ? 'Remove time' : 'Cancel'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => commit(hour, minute)}
              disabled={hour === null}
              accessibilityRole="button"
              hitSlop={8}
            >
              <ThemedText
                type="smallBold"
                style={{ color: hour === null ? theme.textFaint : theme.accent }}
              >
                Done
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 40,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
  // Capped so the sheet cannot grow past the screen on a small phone; the
  // minutes and the buttons below it must stay reachable.
  hourScroll: { maxHeight: 132 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: {
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: Spacing.one + 3,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
});
