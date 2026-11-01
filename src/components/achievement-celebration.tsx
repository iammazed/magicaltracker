import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { type Unlock } from '@/hooks/use-achievements';
import { TIERS, TIER_COLOR, tierTarget } from '@/hooks/use-passport';
import { tapCelebrate } from '@/lib/haptics';

/**
 * Reaching a milestone, as an event rather than a notice.
 *
 * Every rung gets this now — Bronze, Silver, Gold and finishing outright.
 * It began as the completion-only treatment, with a slim banner underneath
 * for the lower tiers, on the reasoning that Bronze is news you want told and
 * then out of your way. Watching it, that was wrong: earning a medal at all
 * is the moment worth marking, and the banner made three quarters of them
 * feel like a notification from somewhere else.
 *
 * **What separates them is intensity, not format.** `GRADE` scales the
 * confetti, the dwell and the haptic beats, so Platinum still clearly
 * outranks Bronze without Bronze being dismissed. Give every tier the same
 * fanfare and finishing stops meaning anything.
 *
 * The screen dims, confetti falls, the medal lands, and it waits to be
 * acknowledged.
 *
 * **Everything is transform and opacity on the native driver**, same rule as
 * the banner, and the confetti is twenty-six plain Views rather than a
 * library. That keeps it shippable over the air — a native dependency would
 * change the fingerprint and strand every installed build — and it cannot be
 * stuttered by whatever JS is busy doing.
 *
 * **One Animated.Value drives all the confetti.** Each piece reads it through
 * its own clamped interpolation window, so twenty-six pieces stagger off a
 * single native animation instead of twenty-six competing ones.
 *
 * Colour literals throughout, the sanctioned SkyCard exception: the scrim and
 * the card are dark in both schemes, so theme tokens would invert and vanish.
 */

/**
 * How big each rung is allowed to feel.
 *
 * Dwell is long enough to look at and short enough that it cannot trap
 * anyone. A tier reached on the way up is a shorter stop than the end of the
 * challenge, which is both proportionate and practical: Bronze fires far more
 * often than Platinum ever will.
 */
const GRADE = {
  Bronze: { pieces: 14, dwell: 5200, beats: 1 },
  Silver: { pieces: 18, dwell: 6000, beats: 2 },
  Gold: { pieces: 22, dwell: 7000, beats: 2 },
  Platinum: { pieces: 30, dwell: 9000, beats: 3 },
} as const satisfies Record<string, { pieces: number; dwell: number; beats: 1 | 2 | 3 }>;

/** An all-or-nothing challenge is only ever reached by finishing it. */
const FINISHED = GRADE.Platinum;

/**
 * A shorter stop when another unlock is already waiting behind this one.
 *
 * One visit can tip two challenges at once, and two full takeovers back to
 * back is eighteen seconds of scrim for a single tap.
 */
const DWELL_QUEUED_MS = 3600;

const FALL_MS = 2600;

const CONFETTI = ['#E5B45F', '#8FD6D2', '#A272BE', '#4B94AF', '#FFFFFF', '#B08D57'];

type Piece = {
  /** Fraction of the screen width this piece starts at. */
  left: number;
  size: number;
  color: string;
  /** Sideways travel, in points, over the fall. */
  drift: number;
  spin: number;
  /** 0–0.2, so the last piece still finishes inside the animation. */
  delay: number;
  /** Rectangles and circles mixed, so it does not read as a grid of dots. */
  round: boolean;
};

function makePieces(width: number, count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    const size = 6 + Math.random() * 7;
    return {
      left: Math.random(),
      size,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
      drift: (Math.random() - 0.5) * Math.min(width * 0.5, 180),
      spin: 180 + Math.random() * 540,
      delay: Math.random() * 0.2,
      round: Math.random() < 0.35,
    };
  });
}

/**
 * What the card says, which is not the same sentence for a rung as for the
 * end of the challenge.
 *
 * This was written when only completions reached here, so every tier read
 * "BRONZE — COMPLETE / All 30 of them" — wrong twice over, since Bronze
 * completes nothing and the user has eight of the thirty, not all of them. A
 * rung names what it took and what the next one costs, which is the thing
 * someone actually wants on the way up.
 */
function headline(unlock: Unlock): { eyebrow: string; sub: string } {
  // A null tier is an all-or-nothing challenge, which only ever reaches a
  // milestone by being finished; Platinum is the tiered equivalent.
  if (unlock.tier === null || unlock.tier === 'Platinum') {
    return {
      eyebrow: 'CHALLENGE COMPLETE',
      sub: unlock.target > 0 ? `All ${unlock.target} of them.` : 'Earned.',
    };
  }

  const index = TIERS.findIndex((t) => t.name === unlock.tier);
  const next = index >= 0 ? (TIERS[index + 1] ?? null) : null;
  // `tierTarget` rather than a percentage, because it is the function the
  // scoring uses — rounding included — so this promises the number the next
  // medal is actually measured against.
  const toNext = next ? tierTarget(next, unlock.target) - unlock.earned : 0;

  return {
    eyebrow: `${unlock.tier.toUpperCase()} EARNED`,
    sub:
      next && toNext > 0
        ? `${unlock.earned} of ${unlock.target}  ·  ${toNext} more for ${next.name}`
        : `${unlock.earned} of ${unlock.target}`,
  };
}

export function AchievementCelebration({
  unlock,
  queued,
  onDone,
}: {
  unlock: Unlock;
  /** True when more unlocks are behind this one, which shortens the dwell. */
  queued: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const accent = unlock.tier ? TIER_COLOR[unlock.tier] ?? '#E5B45F' : '#E5B45F';
  const grade = (unlock.tier && GRADE[unlock.tier as keyof typeof GRADE]) || FINISHED;

  /**
   * Both fixed at mount, not recomputed.
   *
   * `queued` can flip true if another unlock lands while this one is up, and
   * reading it live would put it in the entrance effect's dependencies —
   * replaying the animation and re-firing the haptic on a card that is
   * already sitting still. The same trap the banner had.
   */
  const [dwell] = useState(() => (queued ? DWELL_QUEUED_MS : grade.dwell));
  const [beats] = useState(() => grade.beats);

  const { eyebrow, sub } = headline(unlock);

  /** 0 before entry, 1 once in place. Scrim fade and card rise together. */
  const enter = useRef(new Animated.Value(0)).current;
  /** The medal's own spring, started late so it lands after the card. */
  const pop = useRef(new Animated.Value(0)).current;
  /** 0 → 1 across the whole confetti fall. */
  const fall = useRef(new Animated.Value(0)).current;

  /**
   * Generated once. Recomputing on a re-render would teleport every piece
   * mid-fall, and `useMemo` is explicitly allowed to be dropped.
   */
  const [pieces] = useState<Piece[]>(() => makePieces(width, grade.pieces));

  /**
   * Confetti is the one thing here worth suppressing for reduce-motion: it is
   * a lot of independent movement in the periphery, which is the pattern that
   * actually makes people unwell. The card still rises and the medal still
   * springs, because a celebration with no motion at all is not a
   * celebration.
   *
   * Starts false and may flip true a frame later. That is the right default:
   * the common case is the setting being off, and a guess that reads the
   * setting late shows one extra burst rather than silently removing it from
   * everyone.
   */
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setCalm(on);
    });
    return () => {
      alive = false;
    };
  }, []);

  const leaving = useRef(false);
  const close = useRef(() => {});
  close.current = () => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(enter, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onDone);
  };

  useEffect(() => {
    const stopHaptics = tapCelebrate(beats);

    Animated.parallel([
      Animated.spring(enter, {
        toValue: 1,
        damping: 16,
        stiffness: 170,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(140),
        Animated.spring(pop, {
          toValue: 1,
          damping: 8,
          stiffness: 200,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(fall, {
        toValue: 1,
        duration: FALL_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => close.current(), dwell);
    return () => {
      clearTimeout(timer);
      stopHaptics();
    };
  }, [enter, pop, fall, dwell, beats]);

  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View style={styles.host} pointerEvents="box-none">
      {/* Painted behind the card as a sibling, never as its parent: a
          Pressable wrapping the card would put a press responder above the
          buttons inside it. The same mistake the trip-day sheet made. */}
      <Animated.View style={[styles.scrim, { opacity: enter }]} pointerEvents="none" />
      <Pressable
        style={styles.scrimHit}
        onPress={() => close.current()}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />

      {!calm ? (
        <View style={styles.confetti} pointerEvents="none">
          {pieces.map((p, i) => (
            <Animated.View
              key={i}
              style={[
                {
                  position: 'absolute',
                  left: p.left * width,
                  width: p.size,
                  height: p.round ? p.size : p.size * 1.8,
                  borderRadius: p.round ? p.size / 2 : 1,
                  backgroundColor: p.color,
                  opacity: fall.interpolate({
                    inputRange: [p.delay, p.delay + 0.6, p.delay + 0.8],
                    outputRange: [1, 1, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      translateY: fall.interpolate({
                        inputRange: [p.delay, p.delay + 0.8],
                        outputRange: [-60, height + 60],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      translateX: fall.interpolate({
                        inputRange: [p.delay, p.delay + 0.8],
                        outputRange: [0, p.drift],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      rotate: fall.interpolate({
                        inputRange: [p.delay, p.delay + 0.8],
                        outputRange: ['0deg', `${p.spin}deg`],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <Animated.View
        style={[styles.center, { opacity: enter, transform: [{ translateY: rise }] }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={['#1B1038', '#2C1A4E', '#123042']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: `${accent}88` }]}
        >
          <Stars />

          <Animated.View
            style={[
              styles.medal,
              {
                backgroundColor: accent,
                transform: [
                  { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                  {
                    rotate: pop.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-45deg', '0deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* The tier's initial, matching the medals on the challenge
                detail screen's ladder — that is what someone compares this
                against afterwards. A star only for an all-or-nothing
                challenge, which has no tier to name. */}
            <ThemedText style={styles.medalMark}>
              {unlock.tier ? unlock.tier.charAt(0) : '★'}
            </ThemedText>
          </Animated.View>

          <ThemedText style={[styles.eyebrow, { color: accent }]}>{eyebrow}</ThemedText>
          <ThemedText style={styles.title}>{unlock.title}</ThemedText>
          <ThemedText style={styles.sub}>{sub}</ThemedText>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                close.current();
                // The challenge itself, not the Passport. This used to land
                // on the tab and leave you to find the card that had just
                // changed; the detail screen opens on the checklist, which
                // for a rung is exactly the question being asked — which
                // ones have I done, and what is left.
                router.push({
                  pathname: '/challenge/[id]',
                  params: { id: unlock.challengeId },
                });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: accent, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <ThemedText style={styles.actionLabel}>See it</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => close.current()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.dismiss, { opacity: pressed ? 0.6 : 1 }]}
            >
              <ThemedText style={styles.dismissLabel}>Done</ThemedText>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Above the navigator and anything it presents.
    zIndex: 1100,
    elevation: 1100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,4,16,0.72)',
  },
  scrimHit: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  confetti: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { paddingHorizontal: Spacing.four, width: '100%', alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.large,
    borderWidth: 1,
    overflow: 'hidden',
  },
  medal: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  medalMark: { color: '#1B1205', fontSize: 34, fontWeight: '700', lineHeight: 44 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.66)', fontSize: 13 },
  actions: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  action: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
  },
  actionLabel: { color: '#1B1205', fontSize: 15, fontWeight: '700' },
  dismiss: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  dismissLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
