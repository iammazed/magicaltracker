import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AreaTone, Radius, Spacing, type RampToken } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import {
  TIERS,
  TIER_COLOR,
  tierTarget,
  useChallenge,
  type Challenge,
  type ChallengeStep,
} from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';

/**
 * What a challenge actually asks of you.
 *
 * The Passport's cards say how far along you are and nothing about what is
 * being counted — a Bronze in Disney Springs with no way to learn which
 * sixteen of the sixty-one you had been to, and no sign that Silver sits at
 * thirty-one. The tiered challenges were the worst of it, because they are
 * exactly the ones whose sets are too long to list on a card.
 *
 * Two things live here, in this order: the ladder, then the checklist. The
 * ladder answers "how much further", which is what someone taps a card to
 * find out; the checklist answers "which ones", which is longer and worth
 * scrolling for.
 */
export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const bottomInset = useBottomInset();
  const { challenge, loading } = useChallenge(id);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  if (!challenge) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">Could not find this challenge</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          It may have been renamed in a newer version of the catalog.
        </ThemedText>
      </ThemedView>
    );
  }

  const c = challenge;
  // Area challenges keep their park's colour here too, so arriving from a
  // green Animal Kingdom card does not land on an indigo screen.
  const tone: RampToken = c.id.startsWith('area-')
    ? AreaTone[c.id.replace('area-', '')] ?? 'brandTeal'
    : 'brandIndigo';

  const todo = c.steps.filter((s) => !s.done);
  const done = c.steps.filter((s) => s.done);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: c.title }} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + Spacing.five }]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.complete ? theme.goldSurface : theme.backgroundElement,
              borderColor: c.complete ? theme.gold : theme.border,
            },
          ]}
        >
          <ThemedText type="small" themeColor="textSecondary">
            {c.blurb}
          </ThemedText>
          <ProgressBar
            label={c.tiered ? 'Visited' : 'Completed'}
            visited={c.earned}
            total={c.target}
            tone={tone}
          />
          <ThemedText type="small" themeColor="textFaint">
            {summarise(c)}
          </ThemedText>
        </View>

        {c.tiered ? <TierLadder challenge={c} /> : null}

        {todo.length ? (
          <Section title={`Still to go · ${todo.length}`}>
            {todo.map((s) => (
              <StepRow key={s.id} step={s} />
            ))}
          </Section>
        ) : null}

        {done.length ? (
          <Section title={`Done · ${done.length}`}>
            {done.map((s) => (
              <StepRow key={s.id} step={s} />
            ))}
          </Section>
        ) : null}

        {/* A challenge whose tag matches nothing. Possible after a catalog
            update removes the last venue carrying it, and a screen that just
            rendered two empty sections would look broken. */}
        {c.steps.length === 0 ? (
          <ThemedText type="small" themeColor="textFaint" style={styles.centerText}>
            Nothing in the catalog counts toward this yet.
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

/** The one-line status under the bar, in the terms the challenge is scored in. */
function summarise(c: Challenge): string {
  if (c.complete) return c.tiered ? 'Platinum — every one of them.' : 'Earned.';
  if (c.tiered && c.nextTier) return `${c.toNext} more for ${c.nextTier.name}.`;
  return `${c.target - c.earned} to go.`;
}

/**
 * Bronze through Platinum with the counts spelled out.
 *
 * The thresholds are a percentage of the set in code, which is the right way
 * to define them and the wrong way to show them — nobody plans around 25%.
 * `tierTarget` is the same function the scoring uses, so the number here is
 * the number you are actually measured against, rounding included.
 */
function TierLadder({ challenge: c }: { challenge: Challenge }) {
  const theme = useTheme();

  return (
    <Section title="Tiers">
      {TIERS.map((t) => {
        const need = tierTarget(t, c.target);
        const reached = c.earned >= need;
        const color = TIER_COLOR[t.name];
        return (
          <View
            key={t.name}
            style={[
              styles.tierRow,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: reached ? color : theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.medal,
                reached
                  ? { backgroundColor: color }
                  : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <ThemedText
                style={[styles.medalMark, { color: reached ? '#1B1205' : theme.textFaint }]}
              >
                {t.name.charAt(0)}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={styles.tierName}>
              {t.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textFaint">
              {reached ? `Earned at ${need}` : `${need - c.earned} more`}
            </ThemedText>
          </View>
        );
      })}
    </Section>
  );
}

/**
 * One line of the checklist.
 *
 * A step with a `venueId` is a place, and tapping it opens that place. A
 * pavilion is not a place — several restaurants inside it would satisfy it —
 * so the row itself does not navigate and the options underneath do.
 *
 * And a step can be neither: a month of the year, a park counted on one day.
 * Those have nothing to open and no options to offer, which is a different
 * thing from a choice with nothing in it.
 */
function StepRow({ step }: { step: ChallengeStep }) {
  const router = useRouter();
  const theme = useTheme();
  // A stay challenge's steps are resorts, so they open the resort screen.
  const open = (id: string) =>
    step.kind === 'resort'
      ? router.push({ pathname: '/resort/[id]', params: { id } })
      : router.push({ pathname: '/venue/[id]', params: { id } });

  const body = (
    <>
      <View
        style={[
          styles.tick,
          step.done
            ? { backgroundColor: theme.accent }
            : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
        ]}
      >
        {step.done ? (
          <ThemedText style={[styles.tickMark, { color: theme.onAccent }]}>✓</ThemedText>
        ) : null}
      </View>
      <View style={styles.stepMain}>
        <ThemedText
          type="smallBold"
          numberOfLines={2}
          style={step.done ? { color: theme.goldText } : null}
        >
          {step.label}
        </ThemedText>
        {step.where ? (
          <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
            {step.where}
          </ThemedText>
        ) : null}
      </View>
    </>
  );

  if (step.venueId) {
    const venueId = step.venueId;
    return (
      <Pressable
        onPress={() => open(venueId)}
        accessibilityRole="button"
        accessibilityLabel={`${step.label}${step.done ? ', visited' : ', not visited yet'}`}
        style={({ pressed }) => [
          styles.step,
          {
            backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}
      >
        {body}
      </Pressable>
    );
  }

  const choices = step.options;
  return (
    <View
      style={[
        styles.step,
        styles.stepGroup,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <View style={styles.stepHead}>{body}</View>
      {choices?.length ? (
        <View style={styles.options}>
          {choices.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => open(o.id)}
              accessibilityRole="button"
              accessibilityLabel={`${o.name}${o.done ? ', visited' : ''}`}
              style={({ pressed }) => [
                styles.option,
                { borderColor: o.done ? theme.accent : theme.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: o.done ? theme.accent : theme.textSecondary }}
              >
                {o.done ? `✓ ${o.name}` : o.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : choices ? (
        // An empty `options` array means this step IS a choice and the catalog
        // has nothing to offer for it. `undefined` means it was never a choice
        // — a month is simply a month — and saying this there would be wrong.
        <ThemedText type="small" themeColor="textFaint">
          Nothing in the catalog covers this one yet.
        </ThemedText>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  centerText: { textAlign: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.four },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1.2 },
  sectionBody: { gap: Spacing.two },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tierName: { flex: 1 },
  medal: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalMark: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // A pavilion stacks its options under its name, so it lays out as a column.
  stepGroup: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.two },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepMain: { flex: 1, gap: 1 },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMark: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingLeft: 20 + Spacing.three,
  },
  option: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
