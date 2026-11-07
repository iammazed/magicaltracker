import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { useEffect, useRef, useState } from 'react';

import { PassportPage, Stamp, StampKey } from '@/components/stamp';
import { SkyHeader, useHeaderCollapse } from '@/components/sky-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { currentMilestone, useAchievements } from '@/hooks/use-achievements';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import {
  QUEST_CHALLENGE_IDS,
  STAY_CHALLENGE_IDS,
  type Challenge,
  usePassport,
} from '@/hooks/use-passport';
import { useTheme } from '@/hooks/use-theme';

/**
 * The passport, as an actual passport.
 *
 * This screen used to be eighteen challenge cards stacked in a column, each
 * with a stripe, a medal, a title, a blurb, a progress bar and up to three
 * lines of text — plus an area grid at the top that the bottom half of the
 * screen then repeated as cards. It was reported as overwhelming, which was
 * generous.
 *
 * The numbers moved to Stats. What is left is the keepsake: pages of stamps,
 * earned ones inked and pressed crooked, unearned ones faint outlines waiting
 * to be filled. A tap on any stamp opens that challenge's checklist, which is
 * where the detail belongs and where it has always been.
 */
export default function PassportScreen() {
  const theme = useTheme();
  const { loading, challenges } = usePassport();
  const bottomInset = useBottomInset();
  const { collapsed, onScroll } = useHeaderCollapse();
  const { unseen, markAllSeen } = useAchievements();

  /**
   * What was new WHEN THIS SCREEN OPENED, held for the length of the visit.
   *
   * Looking is acknowledging, so the badge clears immediately — but the
   * highlight has to outlive it, or arriving here from the banner would clear
   * the count and show nothing to explain why you came. Captured once:
   * re-reading `unseen` after `markAllSeen` would return an empty set and the
   * highlight would vanish mid-render.
   */
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const captured = useRef(false);
  useEffect(() => {
    if (captured.current || !unseen.length) return;
    captured.current = true;
    setFresh(new Set(unseen.map((u) => u.key)));
    markAllSeen();
  }, [unseen, markAllSeen]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  const earned = challenges.filter((c) => c.complete).length;
  /**
   * Three pages, and the split is by WHAT EARNS THE STAMP: something you ate,
   * somewhere you slept, or something else entirely.
   *
   * It was four, with the park and area coverage stamps on a page of their
   * own captioned "Also food". That caption was the tell — the page needed a
   * sentence explaining that it belonged with the one three scrolls above it,
   * which is what a page break in the wrong place looks like. Both halves are
   * earned by eating: one by finishing a list someone set out to finish, the
   * other by covering a place. The distinction is real but it is not a
   * distinction between PAGES, and separating them meant someone looking for
   * "how am I doing on EPCOT" had to know that food lived in two places.
   *
   * Named challenges come before coverage inside the page, because they are
   * the ones with a hook — Drinking Around the World is a thing people set
   * out to do, and "every place to eat in Disney Springs" is a long grind
   * that reads better as the back half of a page than as the front of one.
   */
  const areas = challenges.filter((c) => c.id.startsWith('area-'));
  const stays = challenges.filter((c) => STAY_CHALLENGE_IDS.includes(c.id));
  const quests = challenges.filter((c) => QUEST_CHALLENGE_IDS.includes(c.id));
  const food = challenges.filter(
    (c) =>
      !c.id.startsWith('area-') &&
      !STAY_CHALLENGE_IDS.includes(c.id) &&
      !QUEST_CHALLENGE_IDS.includes(c.id),
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
        <SkyHeader eyebrow="WALT DISNEY WORLD" title="Passport" collapsed={collapsed}>
          <View style={styles.summary}>
            <ThemedText style={styles.count}>
              {earned}
              <ThemedText style={styles.countTotal}> / {challenges.length}</ThemedText>
            </ThemedText>
            <View style={styles.summaryNote}>
              <ThemedText style={styles.summaryLabel}>STAMPS EARNED</ThemedText>
              <ThemedText style={styles.summaryText}>
                {earned === 0
                  ? 'Finish a challenge and it gets stamped here.'
                  : earned === challenges.length
                    ? 'Every stamp collected. Nothing left to earn.'
                    : 'Tap any stamp to see what it still needs.'}
              </ThemedText>
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
          <StampKey />

          <PassportPage
            title="Food and drink"
            caption="Earn stamps for the places you eat and drink"
          >
            {[...food, ...areas].map((c) => (
              <Stamp key={c.id} challenge={c} fresh={isFresh(c, fresh)} />
            ))}
          </PassportPage>

          {/* Kept apart from the food above because they are a different
              kind of thing entirely: earned by sleeping somewhere, with no
              meal involved. Buried in with thirteen restaurant stamps they
              would read as more of the same. */}
          <PassportPage
            title="Resort stays"
            caption="Earn stamps for the resorts you stay at"
          >
            {stays.map((c) => (
              <Stamp key={c.id} challenge={c} fresh={isFresh(c, fresh)} />
            ))}
          </PassportPage>

          {/* Not "where you were, when you were here, and how you got
              around", which was accurate and said nothing — four stamps whose
              only shared trait is that none of them is a meal. Nobody needs
              that taxonomy explained to them; they need to know there is more
              in here. These are also the only ones you tick by hand, which
              the challenge's own screen explains at the point it matters. */}
          <PassportPage title="Quests" caption="More fun challenges">
            {quests.map((c) => (
              <Stamp key={c.id} challenge={c} fresh={isFresh(c, fresh)} />
            ))}
          </PassportPage>

          <ThemedText type="small" themeColor="textFaint" style={styles.footnote}>
            Coverage percentages and resort progress live on the Stats tab.
          </ThemedText>
        </ScrollView>
      </View>
    </ThemedView>
  );
}

/** Does this stamp correspond to a milestone the user has not yet looked at? */
function isFresh(c: Challenge, fresh: Set<string>): boolean {
  const key = currentMilestone(c)?.key;
  return key ? fresh.has(key) : false;
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
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  // Literals, because the sky gradient is the same dark in both schemes —
  // theme text tokens would invert and vanish on it.
  count: { color: '#E5B45F', fontSize: 44, lineHeight: 48, fontWeight: '700' },
  countTotal: { color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: '700' },
  summaryNote: {
    flex: 1,
    gap: 2,
    paddingLeft: Spacing.three,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.18)',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 },
  footnote: { textAlign: 'center', paddingHorizontal: Spacing.four, lineHeight: 18 },
});
