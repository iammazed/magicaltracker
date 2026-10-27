import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAchievements, type Unlock } from '@/hooks/use-achievements';
import { TIER_COLOR } from '@/hooks/use-passport';

/**
 * The banner that drops in when an achievement is reached.
 *
 * Mounted once, at the root, above the Stack — so it appears over whatever
 * screen the user is on. Logging the visit that completes a challenge happens
 * in a modal, and a celebration that only existed on the Passport tab would
 * fire where nobody is standing.
 *
 * **Every animation here is `useNativeDriver: true`,** which is possible only
 * because nothing animated is a layout property: transform and opacity only,
 * no height, no margin. It therefore runs on the UI thread and cannot be
 * stuttered by whatever JS is busy doing — unlike the header collapse, which
 * animates height and has to stay on the JS driver.
 *
 * Reanimated is deliberately not used. It silently did nothing on device
 * twice in this project, and a celebration that fails invisibly is worse than
 * no celebration: the user just never learns the feature exists.
 *
 * Colour literals throughout, the sanctioned SkyCard exception — the gradient
 * is dark in both schemes, so theme tokens would invert and vanish on it.
 */

/** How long it sits there before leaving on its own. Long enough to read two
 *  short lines and decide to tap, short enough not to be in the way. */
const DWELL_MS = 4200;
/** Past this much upward drag, a release dismisses rather than springs back. */
const SWIPE_CLOSE = 40;

export function AchievementBanner() {
  const { queue, dismiss } = useAchievements();
  const top = queue[0];
  if (!top) return null;
  // Keyed, so a second unlock arriving behind the first remounts and replays
  // the entrance rather than silently swapping the text of a banner that is
  // already sitting still.
  return <Banner key={top.key} unlock={top} onDone={dismiss} />;
}

function Banner({ unlock, onDone }: { unlock: Unlock; onDone: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accent = unlock.tier ? TIER_COLOR[unlock.tier] ?? '#E5B45F' : '#E5B45F';

  /** 0 before entry, 1 once in place. Drives slide and fade together. */
  const enter = useRef(new Animated.Value(0)).current;
  /** The medal's own spring, started late so it lands after the card does. */
  const pop = useRef(new Animated.Value(0)).current;
  /** Sweeps a highlight across the card, twice. */
  const shine = useRef(new Animated.Value(0)).current;
  /** Finger offset while dragging, always <= 0. */
  const drag = useRef(new Animated.Value(0)).current;

  const leaving = useRef(false);
  const close = useRef(() => {});
  close.current = () => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(enter, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onDone);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(enter, {
        toValue: 1,
        damping: 15,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(pop, {
          toValue: 1,
          damping: 9,
          stiffness: 220,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(260),
        Animated.loop(
          Animated.timing(shine, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          { iterations: 2 },
        ),
      ]),
    ]).start();

    const timer = setTimeout(() => close.current(), DWELL_MS);
    return () => clearTimeout(timer);
  }, [enter, pop, shine]);

  /**
   * Swipe up to dismiss. `onMoveShouldSet` only claims clearly upward drags,
   * so a tap still reaches the Pressable underneath and a downward drag is
   * left to whatever is behind.
   */
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -SWIPE_CLOSE) close.current();
        else
          Animated.spring(drag, {
            toValue: 0,
            damping: 18,
            stiffness: 220,
            useNativeDriver: true,
          }).start();
      },
    }),
  ).current;

  const slide = enter.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] });

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.host,
        {
          top: insets.top + Spacing.one,
          opacity: enter,
          transform: [{ translateY: Animated.add(slide, drag) }],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          close.current();
          router.push('/passport');
        }}
        accessibilityRole="button"
        accessibilityLabel={`${unlock.tier ?? 'Achievement'} unlocked: ${unlock.title}. Opens the passport.`}
        style={styles.press}
      >
        <LinearGradient
          colors={['#1B1038', '#2C1A4E', '#123042']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: `${accent}66` }]}
        >
          <Stars />

          {/* A band of light crossing the card once it has landed. Transform
              only, so it rides the UI thread with everything else. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shine,
              {
                transform: [
                  {
                    translateX: shine.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-220, 420],
                    }),
                  },
                  { rotate: '18deg' },
                ],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.medal,
              {
                backgroundColor: accent,
                transform: [
                  { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                  {
                    rotate: pop.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-35deg', '0deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <ThemedText style={styles.medalMark}>
              {unlock.tier ? unlock.tier.charAt(0) : '★'}
            </ThemedText>
          </Animated.View>

          <View style={styles.copy}>
            <ThemedText style={[styles.eyebrow, { color: accent }]}>
              {unlock.tier ? `${unlock.tier.toUpperCase()} UNLOCKED` : 'ACHIEVEMENT EARNED'}
            </ThemedText>
            <ThemedText style={styles.title} numberOfLines={1}>
              {unlock.title}
            </ThemedText>
            <ThemedText style={styles.sub} numberOfLines={1}>
              {unlock.earned} of {unlock.target}
              {'  ·  Tap to see it'}
            </ThemedText>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    // Above the navigator and anything it presents.
    zIndex: 1000,
    elevation: 1000,
  },
  press: { borderRadius: Radius.large },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  medal: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalMark: { color: '#1B1205', fontSize: 18, fontWeight: '700', lineHeight: 23 },
  copy: { flex: 1, gap: 1 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.62)', fontSize: 12 },
});
