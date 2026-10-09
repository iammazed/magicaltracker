import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { AreaTone, Radius, Spacing } from '@/constants/theme';
import { useCatalog } from '@/hooks/use-catalog';
import { useOnboarding } from '@/hooks/use-onboarding';
import { usePassport } from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';
import { useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';
import { onboardingPicks } from '@/lib/onboarding-picks';

/**
 * First run: "which of these have you eaten at?"
 *
 * Thirty seconds of tapping and a new user has a populated passport, a
 * percentage and probably a badge. The alternative is an empty grid and a "Log
 * your first visit" button, and the gap between those two in day-two retention
 * is the whole reason this screen exists.
 *
 * The dates are not asked for, because nobody remembers them. Those rows are
 * written with `date_exact = 0` and the UI says "date not set" rather than
 * inventing a day the user would later see and not recognise.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: venues } = useVenues();
  const { areas } = useCatalog();
  const { addVisitsBulk } = useVisits();
  const { complete } = useOnboarding();

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<'pick' | 'done'>('pick');
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(0);

  const picks = useMemo(() => onboardingPicks(venues), [venues]);
  const areaName = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a.name])),
    [areas],
  );

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const finish = async (ids: string[]) => {
    if (saving) return;
    setSaving(true);
    const count = ids.length ? await addVisitsBulk(ids, { dateExact: false }) : 0;
    setAdded(count);
    await complete();
    // Straight out for a skip; the payoff screen is only worth showing to
    // someone who actually picked something.
    if (count === 0) router.replace('/');
    else setStage('done');
  };

  if (stage === 'done') {
    return <Payoff added={added} onContinue={() => router.replace('/')} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.masthead}>
            <Wordmark size="lg" />
          </View>

          <SkyCard style={styles.hero}>
            <Stars />
            <View style={styles.heroInner}>
              <ThemedText style={styles.heroTitle}>
                Which of these have you eaten at?
              </ThemedText>
              <ThemedText style={styles.heroBody}>
                Tap every one you have been to and your passport starts filled
                in. No dates needed — you can add those later if you want to.
              </ThemedText>
            </View>
          </SkyCard>

          <View style={styles.grid}>
            {picks.map((v) => {
              const on = chosen.has(v.id);
              const tone = theme[AreaTone[v.area_id] ?? 'brandTeal'];
              return (
                <Pressable
                  key={v.id}
                  onPress={() => toggle(v.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[
                    styles.pick,
                    on
                      ? { backgroundColor: tone, borderColor: tone }
                      : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    numberOfLines={2}
                    style={{ color: on ? '#FFFFFF' : theme.text }}
                  >
                    {v.name}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    numberOfLines={1}
                    style={{
                      color: on ? 'rgba(255,255,255,0.8)' : theme.textFaint,
                      fontSize: 11,
                    }}
                  >
                    {areaName[v.area_id] ?? v.area_id}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="small" themeColor="textFaint" style={styles.footnote}>
            This is a short list of the best-known places. The full catalog of{' '}
            {venues.length} is in the Dining tab once you are through.
          </ThemedText>
        </ScrollView>

        <View style={[styles.footer, { borderColor: theme.border }]}>
          <Pressable
            onPress={() => void finish([...chosen])}
            disabled={saving}
            accessibilityRole="button"
            style={[
              styles.primary,
              {
                backgroundColor: chosen.size ? theme.accent : theme.backgroundSelected,
              },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: chosen.size ? theme.onAccent : theme.textFaint }}
            >
              {saving
                ? 'Saving…'
                : chosen.size
                  ? `Add ${chosen.size} ${chosen.size === 1 ? 'place' : 'places'}`
                  : 'Pick any you have been to'}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void finish([])}
            disabled={saving}
            accessibilityRole="button"
            style={styles.skip}
          >
            <ThemedText type="small" themeColor="textFaint">
              Skip for now
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/** The payoff: a number that was zero a moment ago, and any badge it earned. */
function Payoff({ added, onContinue }: { added: number; onContinue: () => void }) {
  const theme = useTheme();
  const { overall, challenges } = usePassport();
  const tiered = challenges.filter((c) => c.tier !== null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.payoff}>
          <ThemedText type="small" themeColor="textFaint" style={styles.payoffEyebrow}>
            {added} {added === 1 ? 'PLACE' : 'PLACES'} ADDED
          </ThemedText>
          <ThemedText style={[styles.payoffPct, { color: theme.accent }]}>
            {Math.round(overall.pct * 100)}
            <ThemedText style={[styles.payoffSign, { color: theme.accent }]}>%</ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.payoffCaption}>
            of Walt Disney World dining, already eaten through
          </ThemedText>

          {tiered.length ? (
            <View
              style={[
                styles.payoffBadge,
                { backgroundColor: theme.goldSurface, borderColor: theme.gold },
              ]}
            >
              <ThemedText type="smallBold" style={{ color: theme.gold }}>
                {tiered.length === 1
                  ? '1 tier earned already'
                  : `${tiered.length} tiers earned already`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {tiered
                  .slice(0, 3)
                  .map((c) => `${c.title} — ${c.tier?.name}`)
                  .join(' · ')}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            style={[styles.primary, styles.payoffButton, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Start exploring
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  masthead: { alignItems: 'center', paddingVertical: Spacing.two },
  hero: { minHeight: 120 },
  heroInner: { padding: Spacing.four, gap: Spacing.two },
  heroTitle: { color: '#ffffff', fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heroBody: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pick: {
    // Two per row with one gap between, so the grid stays even at any width.
    width: '48.5%',
    minHeight: 72,
    justifyContent: 'center',
    gap: 2,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footnote: { textAlign: 'center', paddingHorizontal: Spacing.three },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
  skip: { alignItems: 'center', paddingVertical: Spacing.two },
  payoff: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  payoffEyebrow: { letterSpacing: 1.4, fontSize: 11, fontWeight: '700' },
  payoffPct: { fontSize: 88, lineHeight: 94, fontWeight: '700' },
  payoffSign: { fontSize: 36, fontWeight: '700' },
  payoffCaption: { textAlign: 'center', maxWidth: 280 },
  payoffBadge: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    alignItems: 'center',
  },
  payoffButton: { marginTop: Spacing.four, alignSelf: 'stretch' },
});
