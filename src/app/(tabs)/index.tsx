import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AreaTone, BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { usePassport } from '@/hooks/use-passport';
import { useResorts } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, tripStatus, useTrips } from '@/hooks/use-trips';
import { useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';

/**
 * Home leads with the trip, not with statistics.
 *
 * Someone opens a travel app to plan or to count down, and for the eleven
 * months between visits the countdown is the only thing giving them a reason
 * to open it at all. Progress goes underneath.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: venues } = useVenues();
  const { data: resorts } = useResorts();
  const { visits, stays } = useVisits();
  const { activeTrip, trips, plansFor, loading: tripsLoading } = useTrips();
  const { loading, overall, byArea, resortCoverage, challenges } = usePassport();

  const resortName = useMemo(
    () => Object.fromEntries(resorts.map((r) => [r.id, r.name])),
    [resorts],
  );
  const venueName = useMemo(
    () => Object.fromEntries(venues.map((v) => [v.id, v.name])),
    [venues],
  );

  const recent = useMemo(() => {
    const items = [
      ...visits.map((v) => ({
        key: v.id, date: v.visited_on, title: venueName[v.venue_id] ?? v.venue_id,
        kind: 'Dining' as const, rating: v.rating,
      })),
      ...stays.map((s) => ({
        key: s.id, date: s.check_in, title: resortName[s.resort_id] ?? s.resort_id,
        kind: 'Resort' as const, rating: s.rating,
      })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  }, [visits, stays, venueName, resortName]);

  const nextChallenge = challenges
    .filter((c) => !c.complete && c.earned > 0)
    .sort((a, b) => b.earned / b.target - a.earned / a.target)[0];

  if (loading || tripsLoading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  const planned = activeTrip ? plansFor(activeTrip.id) : [];
  const booked = planned.filter((p) => p.booked).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* ── Trip, or the invitation to plan one ──────────────── */}
          {activeTrip ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/trip/[id]', params: { id: activeTrip.id } })
              }
              accessibilityRole="button"
            >
              <SkyCard style={styles.hero}>
                <Stars />
                <View style={styles.heroInner}>
                  <ThemedText style={styles.heroEyebrow}>
                    {tripStatus(activeTrip) === 'current'
                      ? 'YOU ARE THERE NOW'
                      : 'NEXT TRIP'}
                  </ThemedText>
                  <ThemedText style={styles.heroTitle}>{activeTrip.name}</ThemedText>

                  {tripStatus(activeTrip) === 'current' ? (
                    <ThemedText style={styles.heroCount}>
                      Home {daysUntil(activeTrip.end_date)}d
                    </ThemedText>
                  ) : (
                    <View style={styles.countRow}>
                      <ThemedText style={styles.heroCount}>
                        {daysUntil(activeTrip.start_date)}
                      </ThemedText>
                      <ThemedText style={styles.heroCountUnit}>
                        {daysUntil(activeTrip.start_date) === 1 ? 'day to go' : 'days to go'}
                      </ThemedText>
                    </View>
                  )}

                  <ThemedText style={styles.heroMeta}>
                    {activeTrip.start_date} – {activeTrip.end_date}
                  </ThemedText>
                  <ThemedText style={styles.heroMeta}>
                    {activeTrip.resort_id
                      ? resortName[activeTrip.resort_id] ?? 'Resort chosen'
                      : 'No resort chosen yet'}
                    {planned.length
                      ? `  ·  ${booked}/${planned.length} dining booked`
                      : '  ·  nothing planned yet'}
                  </ThemedText>
                </View>
              </SkyCard>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/new-trip')} accessibilityRole="button">
              <SkyCard style={styles.hero}>
                <Stars />
                <View style={styles.heroInner}>
                  <ThemedText style={styles.heroEyebrow}>START HERE</ThemedText>
                  <ThemedText style={styles.heroTitle}>Plan a trip</ThemedText>
                  <ThemedText style={styles.heroBody}>
                    Pick your dates and resort, then build a dining list from
                    {' '}{venues.length} places. The countdown starts immediately.
                  </ThemedText>
                  <View style={styles.heroCta}>
                    <ThemedText style={styles.heroCtaText}>New trip</ThemedText>
                  </View>
                </View>
              </SkyCard>
            </Pressable>
          )}

          {/* ── Quick actions ────────────────────────────────────── */}
          <View style={styles.actions}>
            <Action
              label="Browse dining"
              sub={`${venues.length} places`}
              tone={theme.brandTeal}
              onPress={() => router.push('/dining')}
            />
            <Action
              label="Browse resorts"
              sub={`${resorts.length} resorts`}
              tone={theme.brandViolet}
              onPress={() => router.push('/resorts')}
            />
          </View>

          {trips.length > 0 ? (
            <Pressable
              onPress={() => router.push('/new-trip')}
              accessibilityRole="button"
              style={[styles.addTrip, { borderColor: theme.border }]}
            >
              <ThemedText type="small" style={{ color: theme.accent }}>
                + Plan another trip
              </ThemedText>
            </Pressable>
          ) : null}

          {/* ── Progress ─────────────────────────────────────────── */}
          {visits.length > 0 || stays.length > 0 ? (
            <>
              <Section title="Your progress" action="Passport" onAction={() => router.push('/passport')}>
                <View style={styles.statRow}>
                  <Stat value={overall.visited} total={overall.total} label="Eaten" tone={theme.brandTeal} />
                  <Stat value={resortCoverage.visited} total={resortCoverage.total} label="Stayed" tone={theme.brandViolet} />
                  <Stat
                    value={challenges.filter((c) => c.complete).length}
                    total={challenges.length}
                    label="Challenges"
                    tone={theme.gold}
                  />
                </View>
                {byArea.slice(0, 3).map((a) => (
                  <ProgressBar
                    key={a.id}
                    label={a.label}
                    visited={a.visited}
                    total={a.total}
                    tone={AreaTone[a.id] ?? 'brandTeal'}
                  />
                ))}
              </Section>

              {nextChallenge ? (
                <Pressable
                  onPress={() => router.push('/passport')}
                  accessibilityRole="button"
                  style={[styles.card, { backgroundColor: theme.goldSurface, borderColor: theme.gold }]}
                >
                  <ThemedText type="small" style={{ color: theme.gold, fontWeight: '700', fontSize: 11, letterSpacing: 1 }}>
                    CLOSEST CHALLENGE
                  </ThemedText>
                  <ThemedText type="smallBold">{nextChallenge.title}</ThemedText>
                  <ProgressBar label="" visited={nextChallenge.earned} total={nextChallenge.target} tone="brandViolet" />
                </Pressable>
              ) : null}

              <Section title="Recently logged">
                {recent.map((r) => (
                  <View key={r.key} style={[styles.recentRow, { borderColor: theme.borderSoft }]}>
                    <View style={styles.recentMain}>
                      <ThemedText type="small" numberOfLines={1}>{r.title}</ThemedText>
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
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Action({
  label, sub, tone, onPress,
}: { label: string; sub: string; tone: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.actionBar, { backgroundColor: tone }]} />
      <View style={styles.actionText}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textFaint">{sub}</ThemedText>
      </View>
    </Pressable>
  );
}

function Stat({
  value, total, label, tone,
}: { value: number; total: number; label: string; tone: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText style={[styles.statValue, { color: tone }]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textFaint">of {total}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

function Section({
  title, action, onAction, children,
}: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </ThemedText>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" style={{ color: theme.accent }}>{action}</ThemedText>
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
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  hero: { minHeight: 168 },
  heroInner: { padding: Spacing.four, gap: Spacing.one },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroTitle: { color: '#ffffff', fontSize: 26, lineHeight: 32, fontWeight: '700' },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, marginTop: Spacing.one },
  heroCount: { color: '#E5B45F', fontSize: 52, lineHeight: 56, fontWeight: '700' },
  heroCountUnit: { color: 'rgba(255,255,255,0.75)', fontSize: 15 },
  heroMeta: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19 },
  heroBody: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 20, marginTop: Spacing.one },
  heroCta: {
    marginTop: Spacing.three, alignSelf: 'flex-start',
    backgroundColor: '#E5B45F', paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two, borderRadius: Radius.pill,
  },
  heroCtaText: { color: '#23133A', fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
    borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth,
    paddingRight: Spacing.three, overflow: 'hidden',
  },
  actionBar: { width: 5, alignSelf: 'stretch' },
  actionText: { paddingVertical: Spacing.three, gap: 1, flexShrink: 1 },
  addTrip: {
    alignItems: 'center', paddingVertical: Spacing.three,
    borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  stat: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.three,
    borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: 1,
  },
  statValue: { fontSize: 26, lineHeight: 30, fontWeight: '700' },
  section: { gap: Spacing.two },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.three },
  card: {
    padding: Spacing.three, borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two,
  },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentMain: { flex: 1, gap: 1 },
});
