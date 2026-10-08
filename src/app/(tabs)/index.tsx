import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, BrandRamp, Radius, Spacing } from '@/constants/theme';
import { usePassport } from '@/hooks/use-passport';
import { useResorts } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: venues } = useVenues();
  const { data: resorts } = useResorts();
  const { visits, stays } = useVisits();
  const { loading, overall, byArea, resortCoverage, challenges } = usePassport();

  const venueName = useMemo(
    () => Object.fromEntries(venues.map((v) => [v.id, v.name])),
    [venues],
  );
  const resortName = useMemo(
    () => Object.fromEntries(resorts.map((r) => [r.id, r.name])),
    [resorts],
  );

  /** The five most recent things logged, of either kind. */
  const recent = useMemo(() => {
    const items = [
      ...visits.map((v) => ({
        key: v.id,
        date: v.visited_on,
        title: venueName[v.venue_id] ?? v.venue_id,
        kind: 'Dining' as const,
        rating: v.rating,
      })),
      ...stays.map((s) => ({
        key: s.id,
        date: s.check_in,
        title: resortName[s.resort_id] ?? s.resort_id,
        kind: 'Resort' as const,
        rating: s.rating,
      })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [visits, stays, venueName, resortName]);

  const nextChallenge = challenges
    .filter((c) => !c.complete && c.earned > 0)
    .sort((a, b) => b.earned / b.target - a.earned / a.target)[0];

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  const nothingLogged = visits.length === 0 && stays.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.wordmark}>
              Magical<ThemedText style={[styles.wordmarkTail, { color: theme.text }]}>Tracker</ThemedText>
            </ThemedText>
          </View>

          {nothingLogged ? (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <ThemedText type="smallBold">Start your passport</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {venues.length} places to eat and {resorts.length} resorts are
                loaded. Log somewhere you have already been and the passport
                starts filling in.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/dining')}
                accessibilityRole="button"
                style={[styles.primary, { backgroundColor: theme.accent }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  Browse dining
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              {/* ── Headline stats ───────────────────────────────── */}
              <View style={styles.statRow}>
                <Stat value={overall.visited} total={overall.total} label="Places eaten" />
                <Stat
                  value={resortCoverage.visited}
                  total={resortCoverage.total}
                  label="Resorts stayed"
                />
                <Stat
                  value={challenges.filter((c) => c.complete).length}
                  total={challenges.length}
                  label="Challenges"
                  gold
                />
              </View>

              {/* ── Top parks ────────────────────────────────────── */}
              <Section
                title="Your progress"
                action="See all"
                onAction={() => router.push('/passport')}
              >
                {byArea.slice(0, 4).map((a, i) => (
                  <ProgressBar
                    key={a.id}
                    label={a.label}
                    visited={a.visited}
                    total={a.total}
                    tone={BrandRamp[i % BrandRamp.length]}
                  />
                ))}
              </Section>

              {/* ── Nearest challenge ────────────────────────────── */}
              {nextChallenge ? (
                <Section title="Closest challenge">
                  <Pressable
                    onPress={() => router.push('/passport')}
                    accessibilityRole="button"
                    style={[
                      styles.card,
                      { backgroundColor: theme.goldSurface, borderColor: theme.gold },
                    ]}
                  >
                    <ThemedText type="smallBold">{nextChallenge.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {nextChallenge.earned} of {nextChallenge.target} ·{' '}
                      {nextChallenge.target - nextChallenge.earned} to go
                    </ThemedText>
                    <ProgressBar
                      label=""
                      visited={nextChallenge.earned}
                      total={nextChallenge.target}
                      tone="brandViolet"
                    />
                  </Pressable>
                </Section>
              ) : null}

              {/* ── Recent ───────────────────────────────────────── */}
              <Section title="Recently logged">
                {recent.map((r) => (
                  <View
                    key={r.key}
                    style={[styles.recentRow, { borderColor: theme.borderSoft }]}
                  >
                    <View style={styles.recentMain}>
                      <ThemedText type="small" numberOfLines={1}>
                        {r.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textFaint">
                        {r.kind} · {r.date}
                      </ThemedText>
                    </View>
                    {r.rating ? (
                      <ThemedText type="small" style={{ color: theme.gold }}>
                        {'★'.repeat(r.rating)}
                      </ThemedText>
                    ) : null}
                  </View>
                ))}
              </Section>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Stat({
  value,
  total,
  label,
  gold,
}: {
  value: number;
  total: number;
  label: string;
  gold?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <ThemedText style={[styles.statValue, { color: gold ? theme.gold : theme.accent }]}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textFaint">
        of {total}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </ThemedText>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" style={{ color: theme.accent }}>
              {action}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  header: { paddingTop: Spacing.two },
  wordmark: { fontSize: 30, lineHeight: 36 },
  wordmarkTail: { fontSize: 30, lineHeight: 36, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 1,
  },
  statValue: { fontSize: 28, lineHeight: 32, fontWeight: '700' },
  statLabel: { textAlign: 'center' },
  section: { gap: Spacing.two },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.three },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  primary: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentMain: { flex: 1, gap: 1 },
});
