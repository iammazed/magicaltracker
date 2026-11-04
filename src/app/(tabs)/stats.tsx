import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { SkyHeader, useHeaderCollapse } from '@/components/sky-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AreaTone, Radius, Spacing } from '@/constants/theme';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { type Coverage, usePassport } from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';

/**
 * How much of the world you have covered.
 *
 * Split out of Passport, which was doing two jobs at once and showing the
 * strain: thirteen area tiles at the top, then the SAME thirteen areas again
 * as full challenge cards further down, with five more challenge cards
 * between them. Eighteen cards, each carrying a stripe, a medal, a title, a
 * blurb, a bar and three lines of text — over a hundred text elements in one
 * scroll, which is exactly as overwhelming as it sounds.
 *
 * So the numbers live here and the keepsake lives in Passport. Each tile is
 * the way into that area's checklist, which also retires the duplicate list:
 * the thing it linked to is now reachable by tapping the thing that describes
 * it.
 */
export default function StatsScreen() {
  const theme = useTheme();
  const { loading, overall, byArea, resortCoverage, challenges } = usePassport();
  const bottomInset = useBottomInset();
  const { collapsed, onScroll } = useHeaderCollapse();

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
      <View style={styles.safe}>
        <SkyHeader eyebrow="WALT DISNEY WORLD" title="Stats" collapsed={collapsed}>
          <View style={styles.summary}>
            <ThemedText style={styles.pct}>
              {Math.round(overall.pct * 100)}
              <ThemedText style={styles.pctSign}>%</ThemedText>
            </ThemedText>
            <View style={styles.summaryStats}>
              <HeroStat value={overall.visited} total={overall.total} label="Places" />
              <HeroStat
                value={resortCoverage.visited}
                total={resortCoverage.total}
                label="Resorts"
              />
              <HeroStat value={earned} total={challenges.length} label="Earned" />
            </View>
          </View>
        </SkyHeader>

        <ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: bottomInset + Spacing.five },
          ]}
        >
          {overall.visited === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Log your first visit from the Dining tab and this starts filling.
            </ThemedText>
          ) : null}

          <Section title="Where you have eaten" caption="Tap an area for its checklist.">
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
        </ScrollView>
      </View>
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
 * One area, in that area's own colour, and now a way in rather than a
 * readout.
 *
 * The same `AreaTone` mapping as the dining rows and the map pins, so a park
 * is the same colour everywhere in the app.
 */
function AreaTile({ area }: { area: Coverage }) {
  const theme = useTheme();
  const router = useRouter();
  const tone = theme[AreaTone[area.id] ?? 'brandTeal'];
  const pct = Math.round(area.pct * 100);
  const complete = area.total > 0 && area.visited === area.total;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/challenge/[id]', params: { id: `area-${area.id}` } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${area.label}, ${area.visited} of ${area.total} places. Opens the checklist.`}
      style={({ pressed }) => [
        styles.areaTile,
        {
          borderColor: complete ? theme.gold : tone,
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* A filled bar behind the text, sized to the percentage — the tile is
          its own progress indicator rather than needing a separate one. */}
      <View
        style={[
          styles.areaFill,
          { backgroundColor: complete ? theme.gold : tone, width: `${Math.max(pct, 2)}%` },
        ]}
      />
      <View style={styles.areaTileInner}>
        <ThemedText type="small" numberOfLines={2} style={styles.areaName}>
          {area.label}
        </ThemedText>
        <View style={styles.areaNumbers}>
          <ThemedText style={[styles.areaPct, { color: complete ? theme.goldText : tone }]}>
            {pct}%
          </ThemedText>
          <ThemedText type="small" themeColor="textFaint" style={styles.areaCount}>
            {area.visited}/{area.total}
          </ThemedText>
          <View style={styles.areaSpacer} />
          <ThemedText style={[styles.chevron, { color: theme.textFaint }]}>›</ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {caption ? (
        <ThemedText type="small" themeColor="textFaint">
          {caption}
        </ThemedText>
      ) : null}
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
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  hint: { textAlign: 'center', paddingHorizontal: Spacing.four },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  // Literals, because the sky gradient is the same dark in both schemes —
  // theme text tokens would invert and vanish on it.
  pct: { color: '#E5B45F', fontSize: 44, lineHeight: 48, fontWeight: '700' },
  pctSign: { color: '#E5B45F', fontSize: 22, fontWeight: '700' },
  summaryStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingLeft: Spacing.three,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.18)',
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
  areaSpacer: { flex: 1 },
  chevron: { fontSize: 15, lineHeight: 18, fontWeight: '700' },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.three },
});
