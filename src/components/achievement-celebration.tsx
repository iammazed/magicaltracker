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
import { TIER_COLOR } from '@/hooks/use-passport';
import { tapFinished } from '@/lib/haptics';

/**
 * Finishing a challenge, as an event rather than a notice.
 *
 * The slim banner is right for a rung on a ladder — Bronze in EPCOT is news
 * you want told and then out of your way. It is wrong for the end of a
 * challenge, which is the single biggest thing that happens in this app and
 * was being announced in the same 320-pixel card, with the same one buzz, as
 * every other step. A tester called it underwhelming, which was the correct
 * reading of what it was.
 *
 * So completions get this instead: the screen dims, confetti falls, the medal
 * lands, and it waits to be acknowledged.
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

/** Long enough to look at, short enough that it cannot trap anyone. */
const DWELL_MS = 9000;
const FALL_MS = 2600;
const PIECES = 26;

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

function makePieces(width: number): Piece[] {
  return Array.from({ length: PIECES }, (): Piece => {
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

export function AchievementCelebration({
  unlock,
  onDone,
}: {
  unlock: Unlock;
  onDone: () => void;
}) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const accent = unlock.tier ? TIER_COLOR[unlock.tier] ?? '#E5B45F' : '#E5B45F';

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
  const [pieces] = useState<Piece[]>(() => makePieces(width));

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
    const stopHaptics = tapFinished();

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

    const timer = setTimeout(() => close.current(), DWELL_MS);
    return () => {
      clearTimeout(timer);
      stopHaptics();
    };
  }, [enter, pop, fall]);

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
            <ThemedText style={styles.medalMark}>★</ThemedText>
          </Animated.View>

          <ThemedText style={[styles.eyebrow, { color: accent }]}>
            {unlock.tier ? `${unlock.tier.toUpperCase()} — COMPLETE` : 'CHALLENGE COMPLETE'}
          </ThemedText>
          <ThemedText style={styles.title}>{unlock.title}</ThemedText>
          <ThemedText style={styles.sub}>
            {unlock.target > 0 ? `All ${unlock.target} of them.` : 'Earned.'}
          </ThemedText>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                close.current();
                router.push('/passport');
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
