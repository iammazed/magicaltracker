import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AreaTone,
  BottomTabInset,
  Radius,
  Spacing,
  type RampToken,
} from '@/constants/theme';
import { type Challenge, type Coverage, usePassport } from '@/hooks/use-passport';
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
          <SkyCard style={styles.hero}>
            <Stars />
            <View style={styles.heroInner}>
              <ThemedText style={styles.heroPct}>
                {Math.round(overall.pct * 100)}
                <ThemedText style={styles.heroSign}>%</ThemedText>
              </ThemedText>
              <ThemedText style={styles.heroCaption}>
                of Walt Disney World dining eaten through
              </ThemedText>
              <View style={styles.heroStats}>
                <HeroStat value={overall.visited} total={overall.total} label="Places" />
                <HeroStat
                  value={resortCoverage.visited}
                  total={resortCoverage.total}
                  label="Resorts"
                />
                <HeroStat value={earned} total={challenges.length} label="Earned" />
              </View>
              {overall.visited === 0 ? (
                <ThemedText style={styles.heroHint}>
                  Log your first visit from the Dining tab and this starts filling.
                </ThemedText>
              ) : null}
            </View>
          </SkyCard>

          {/* ── Areas at a glance, in their own colours ───────────── */}
          <Section title="Where you have eaten">
            <View style={styles.areaGrid}>
              {byArea.map((a) => (
                <AreaTile key={a.id} area={a} />
              ))}
            </View>
          </Section>

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

function HeroStat({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  return (
    <View style={styles.heroStat}>
      <ThemedText style={styles.heroStatValue}>
        {value}
        <ThemedText style={styles.heroStatTotal}> / {total}</ThemedText>
      </ThemedText>
      <ThemedText style={styles.heroStatLabel}>{label.toUpperCase()}</ThemedText>
    </View>
  );
}

/**
 * One area, in that area's own colour.
 *
 * The passport read as one long column of identical grey cards, which made
 * fourteen different places look like one undifferentiated list. These use the
 * same `AreaTone` mapping as the dining rows and the map pins, so a park is the
 * same colour everywhere in the app.
 */
function AreaTile({ area }: { area: Coverage }) {
  const theme = useTheme();
  const tone = theme[AreaTone[area.id] ?? 'brandTeal'];
  const pct = Math.round(area.pct * 100);

  return (
    <View style={[styles.areaTile, { borderColor: tone, backgroundColor: theme.backgroundElement }]}>
      {/* A filled bar behind the text, sized to the percentage — the tile is
          its own progress indicator rather than needing a separate one. */}
      <View
        style={[styles.areaFill, { backgroundColor: tone, width: `${Math.max(pct, 2)}%` }]}
      />
      <View style={styles.areaTileInner}>
        <ThemedText type="small" numberOfLines={2} style={styles.areaName}>
          {area.label}
        </ThemedText>
        <View style={styles.areaNumbers}>
          <ThemedText style={[styles.areaPct, { color: tone }]}>{pct}%</ThemedText>
          <ThemedText type="small" themeColor="textFaint" style={styles.areaCount}>
            {area.visited}/{area.total}
          </ThemedText>
        </View>
      </View>
    </View>
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
  const stripe = tone ? theme[tone] : theme.brandIndigo;

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
      {/* The same colour spine the dining rows use, so a challenge for a park
          is visibly the same park. */}
      <View style={[styles.cardStripe, { backgroundColor: stripe }]} />
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
  hero: { minHeight: 190 },
  heroInner: { padding: Spacing.four, alignItems: 'center', gap: Spacing.one },
  // Literals, because the sky gradient is the same dark in both schemes —
  // theme text tokens would invert and vanish on it.
  heroPct: { color: '#E5B45F', fontSize: 64, lineHeight: 68, fontWeight: '700' },
  heroSign: { color: '#E5B45F', fontSize: 30, fontWeight: '700' },
  heroCaption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    textAlign: 'center',
  },
  heroHint: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  heroStats: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  heroStat: { alignItems: 'center', gap: 1 },
  heroStatValue: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  heroStatTotal: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '400' },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  areaTile: {
    width: '48.5%',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    minHeight: 74,
  },
  // Sits behind the text at low opacity, so the tile itself is the bar.
  areaFill: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.22 },
  areaTileInner: { padding: Spacing.two + 2, gap: 2 },
  areaName: { fontSize: 12, lineHeight: 15 },
  areaNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  areaPct: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  areaCount: { fontSize: 11 },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.three },
  card: {
    padding: Spacing.three,
    paddingLeft: Spacing.three + 5,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  cardStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
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
