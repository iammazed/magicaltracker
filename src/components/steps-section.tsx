import { Pressable, StyleSheet, View } from 'react-native';

import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSteps } from '@/hooks/use-steps';
import { useTheme } from '@/hooks/use-theme';
import { WEEKDAY_LABELS } from '@/lib/calendar';

/** How many stored days the strip shows. Seven is also the sensor's own
 *  window, so a fresh install fills the strip exactly. */
const WINDOW = 7;

/**
 * Steps, for the one statistic nobody has to log by hand.
 *
 * Every other number in this app is something somebody typed. This one is
 * already on the phone, and a park day is the rare context where a step count
 * is genuinely interesting rather than ambient — twenty thousand steps is what
 * Magic Kingdom costs, and that is worth seeing next to what you ate.
 *
 * Renders nothing at all when there is no pedometer. A simulator, an iPad and
 * an Android device without Health Connect all land there, and an empty
 * "Steps — 0" section on those reads as a broken feature rather than an absent
 * sensor.
 */
export function StepsSection() {
  const theme = useTheme();
  const { ready, available, permission, today, byDay, request } = useSteps();

  if (!ready || !available) return null;

  if (permission !== 'granted') {
    // `request` is passed down rather than re-read from the hook inside the
    // prompt: calling `useSteps` twice in one tree would mount a second
    // AppState listener and a second rollup against the same table.
    return (
      <Section title="Steps">
        <StepsPrompt denied={permission === 'denied'} request={request} />
      </Section>
    );
  }

  const recent = byDay.slice(0, WINDOW);
  const peak = Math.max(1, ...recent.map((r) => r.steps));

  return (
    <Section title="Steps">
      <View style={styles.wrap}>
        <View style={styles.todayRow}>
          <ThemedText style={[styles.todayValue, { color: theme.accentText }]}>
            {today === null ? '—' : today.toLocaleString()}
          </ThemedText>
          <ThemedText type="small" themeColor="textFaint">
            steps today
          </ThemedText>
        </View>

        {recent.length === 0 ? (
          <ThemedText type="small" themeColor="textFaint">
            Nothing recorded yet. Carry your phone for a day and this fills in.
          </ThemedText>
        ) : (
          <View style={styles.strip}>
            {/* Oldest on the left, so the strip reads the way a week does. */}
            {[...recent].reverse().map((row) => {
              const [y, m, d] = row.day.split('-').map(Number);
              const weekday = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
              return (
                <View key={row.day} style={styles.bar}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: theme.accent,
                          // A floor of 2% so a day with a handful of steps is
                          // still visibly a day, not a gap in the strip.
                          height: `${Math.max(2, Math.round((row.steps / peak) * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText
                    type="small"
                    themeColor="textFaint"
                    style={styles.barLabel}
                  >
                    {weekday}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        )}

        <ThemedText type="small" themeColor="textFaint">
          iOS keeps seven days of step history, so MagicalTracker copies each
          day into your own records while it still can. Open the app at least
          once a week on a trip and nothing is lost.
        </ThemedText>
      </View>
    </Section>
  );
}

/**
 * The ask, and the dead end.
 *
 * Denied is final: iOS will not show the system prompt a second time, so a
 * button that re-asks would do nothing and look broken. Saying where the
 * switch is, is the only honest move.
 */
function StepsPrompt({
  denied,
  request,
}: {
  denied: boolean;
  request: () => Promise<boolean>;
}) {
  const theme = useTheme();

  if (denied) {
    return (
      <ThemedText type="small" themeColor="textFaint">
        Motion access is off, so steps cannot be counted. Settings › Privacy &
        Security › Motion & Fitness turns it back on.
      </ThemedText>
    );
  }

  return (
    <Pressable
      onPress={() => void request()}
      accessibilityRole="button"
      accessibilityLabel="Turn on step counting"
      style={({ pressed }) => [
        styles.prompt,
        {
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <ThemedText type="smallBold">Count my steps</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        See how far you walked on a park day. Stays on your device.
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  todayRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  todayValue: { fontSize: 32, lineHeight: 36, fontWeight: '700' },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, height: 72 },
  bar: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 3, minHeight: 2 },
  barLabel: { fontSize: 10 },
  prompt: {
    gap: 2,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
