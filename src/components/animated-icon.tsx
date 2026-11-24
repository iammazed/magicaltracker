import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Spacing } from '@/constants/theme';

/**
 * The second half of the launch.
 *
 * iOS draws the native splash from `app.json` — the gold `M` on teal — before
 * a line of JavaScript has run, and keeps drawing it until
 * `SplashScreen.hideAsync()`. This overlay is what takes its place: the same
 * mark at the same size on the same teal, so the handover is invisible, and
 * then the tagline fades up underneath it before the whole thing clears.
 *
 * **This was the Expo starter's file until now**, untouched since the initial
 * commit — the Expo logo on Expo blue, `#208AEF`, drawn over our own teal
 * splash on every single launch. That was not a styling nit. It was another
 * company's logo in the first second of the app, on every device, including
 * the testers'.
 *
 * The two render passes are not a nicety either. `hideAsync` has to be called
 * from `onLayout`, once this view has actually been laid out, or there is a
 * frame between the native splash leaving and this one arriving — and that
 * frame is a white flash. So the first pass draws the mark and hides the
 * native splash; the second replays it as an animation.
 *
 * Literal colours throughout, which is sanctioned here for the same reason as
 * the share card and the map pins: this surface is one fixed colour in both
 * schemes, because the native splash it continues is a PNG and cannot know
 * the scheme. A theme token would invert and leave a gold mark on white.
 */

/**
 * Matches `expo-splash-screen`'s `backgroundColor` in `app.json`, and must
 * keep matching it. Change one without the other and the flash this file
 * exists to remove comes straight back, in a new colour.
 */
const TEAL = '#00807E';

/** Matches `imageWidth` in that same plugin block, for the same reason. */
const MARK = 160;

/**
 * How long the overlay lives, and the only dial worth turning — the
 * percentages below scale with it.
 *
 * What matters is not this number but the gap between the tagline finishing
 * its own 450ms fade-in and the overlay starting to clear, because that gap
 * is the only stretch where the line is actually readable. At the first
 * numbers — 1100ms with the hold at 64% — the gap was 254ms for six words,
 * and it was reported as going away too quickly. It did.
 *
 * At 2000ms with the hold at 80% the line stands still from 450ms to 1600ms,
 * a little over a second, and the clear still takes the 400ms it always took,
 * so the exit is no slower than before. Shorten DURATION again and the hold
 * percentage has to come with it, or the readable window is what you lose.
 */
const DURATION = 2000;

const splashKeyframe = new Keyframe({
  0: { opacity: 1 },
  // Hold, then clear over the last fifth: 400ms at the DURATION above.
  80: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.quad) },
});

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const mark = (
    <Image
      style={styles.mark}
      source={require('@/assets/images/splash-icon.png')}
      contentFit="contain"
      // Decoration. VoiceOver already read the app's name on the home screen
      // to get here, and announcing it again delays the first real screen.
      accessible={false}
    />
  );

  // First pass: pixel-identical to the native splash, so swapping one for the
  // other changes nothing on screen. No tagline yet — that belongs to the
  // animation, and showing it statically here would make it pop rather than
  // fade.
  if (!animate) {
    return (
      <View
        onLayout={() => {
          SplashScreen.hideAsync().finally(() => setAnimate(true));
        }}
        style={styles.overlay}
        pointerEvents="none"
      >
        {mark}
      </View>
    );
  }

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      })}
      style={styles.overlay}
      // It covers the whole screen and outlives its own fade by a few hundred
      // milliseconds. Without this it silently eats the first tap.
      pointerEvents="none"
    >
      {mark}
      <Animated.Text entering={FadeIn.duration(450)} style={styles.tagline}>
        Every meal, every stay, every memory
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  mark: { width: MARK, height: MARK },
  /**
   * Pure white, not a softened one. `#FFFFFF` on `TEAL` is 4.78:1, which
   * clears AA for body text; dropping it to 92% opacity — which is what you
   * reach for when stark white looks too loud — lands at 4.26:1, which does
   * not. The restraint has to come from size and weight instead.
   *
   * `maxWidth` forces the same two-line break on every device rather than one
   * line on a Pro Max and two on an SE. No full stop, for the same reason a
   * caption under a heading takes none: it is a label, not a sentence.
   */
  tagline: {
    marginTop: Spacing.three,
    maxWidth: 240,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
