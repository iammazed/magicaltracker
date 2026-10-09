import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AreaTone,
  BottomTabInset,
  Radius,
  Spacing,
  type RampToken,
} from '@/constants/theme';
import { type Challenge, usePassport } from '@/hooks/use-passport';
import { titleCase } from '@/lib/labels';
import { useTheme } from '@/hooks/use-theme';

// Medal colours are literal, not theme tokens: bronze is bronze in both
// themes, and a tier that changed colour with the OS would stop reading
// as a medal.
const TIER_COLOR: Record<string, string> = {
  Bronze: '#B08D57',
  Silver: '#A8B2BC',
  Gold: '#E5B45F',
  Platinum: '#8FD6D2',
};

export default function PassportScreen() {
  const theme = useTheme();
  const { loading, overall, byArea, resortCoverage, challenges } = usePassport();

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  const earned = challenges.filter((c) => c.complete).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.heading}>
              Passport
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {overall.visited} of {overall.total} places ·{' '}
              {resortCoverage.visited} of {resortCoverage.total} resorts ·{' '}
              {earned} of {challenges.length} challenges
            </ThemedText>
          </View>

          {/* ── Headline number ──────────────────────────────────── */}
          <View
            style={[
              styles.hero,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText style={[styles.heroPct, { color: theme.accent }]}>
              {Math.round(overall.pct * 100)}
              <ThemedText style={[styles.heroSign, { color: theme.accent }]}>%</ThemedText>
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroCaption}>
              of Walt Disney World dining eaten through
            </ThemedText>
            {overall.visited === 0 ? (
              <ThemedText type="small" themeColor="textFaint" style={styles.heroCaption}>
                Log your first visit from the Dining tab and this starts filling.
              </ThemedText>
            ) : null}
          </View>


          <Section title="Resorts">
            <ProgressBar
              label="Disney-owned resorts stayed at"
              visited={resortCoverage.visited}
              total={resortCoverage.total}
              tone="brandViolet"
            />
            <ThemedText type="small" themeColor="textFaint">
              Partner hotels like the Swan and Dolphin are tracked but do not
              count toward this.
            </ThemedText>
          </Section>

          {/* All-or-nothing first — those are the ones people chase. */}
          <Section title="Challenges">
            {challenges
              .filter((c) => !c.tiered)
              .map((c) => (
                <ChallengeCard key={c.id} challenge={c} />
              ))}
            {challenges
              .filter((c) => c.tiered && !c.id.startsWith('area-'))
              .map((c) => (
                <ChallengeCard key={c.id} challenge={c} />
              ))}
          </Section>

          <Section title="Eat through each area">
            {challenges
              .filter((c) => c.id.startsWith('area-'))
              .map((c) => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  tone={AreaTone[c.id.replace('area-', '')] ?? 'brandTeal'}
                />
              ))}
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChallengeCard({
  challenge: c,
  tone,
}: {
  challenge: Challenge;
  tone?: RampToken;
}) {
  const theme = useTheme();
  const medalColor = c.tier ? TIER_COLOR[c.tier.name] : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.complete ? theme.goldSurface : theme.backgroundElement,
          borderColor: c.complete ? theme.gold : medalColor ?? theme.border,
        },
      ]}
    >
      <View style={styles.cardHead}>
        <View
          style={[
            styles.medal,
            medalColor
              ? { backgroundColor: medalColor }
              : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <ThemedText
            style={[styles.medalMark, { color: medalColor ? '#1B1205' : theme.textFaint }]}
          >
            {c.complete ? '\u2605' : c.tier ? c.tier.name.charAt(0) : String(c.earned)}
          </ThemedText>
        </View>
        <View style={styles.cardMain}>
          <View style={styles.titleLine}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              {c.title}
            </ThemedText>
            {c.tier ? (
              <ThemedText style={[styles.tierTag, { color: medalColor ?? theme.gold }]}>
                {c.tier.name.toUpperCase()}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {c.blurb}
          </ThemedText>
        </View>
      </View>

      <ProgressBar label="" visited={c.earned} total={c.target} tone={tone ?? 'brandIndigo'} />

      {/* Show the next step, not the distant finish line. */}
      {c.tiered && !c.complete && c.nextTier ? (
        <ThemedText type="small" themeColor="textFaint">
          {c.toNext} more for {c.nextTier.name} · {c.earned} of {c.target} so far
        </ThemedText>
      ) : null}

      {!c.complete && c.remaining?.length ? (
        <ThemedText type="small" themeColor="textFaint">
          Still to go: {c.remaining.map(titleCase).join(', ')}
        </ThemedText>
      ) : null}

      {c.complete ? (
        <ThemedText type="small" style={{ color: theme.gold }}>
          {c.tiered ? 'Platinum — every one of them' : 'Earned'}
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
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  header: { paddingTop: Spacing.two, gap: 2 },
  heading: { fontSize: 34, lineHeight: 40 },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  heroPct: { fontSize: 64, lineHeight: 68, fontWeight: '700' },
  heroSign: { fontSize: 30, fontWeight: '700' },
  heroCaption: { textAlign: 'center' },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.three },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  cardHead: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  cardMain: { flex: 1, gap: 2 },
  medal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalMark: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { flexShrink: 1 },
  tierTag: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
});
