import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SkyGradient, Spacing } from '@/constants/theme';

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
 * Flat colours are literals here, which is sanctioned for the same reason as
 * the share card and the map pins: this surface is fixed in both schemes,
 * because the native splash it continues is a PNG and cannot know the scheme,
 * and a scheme-dependent token would invert and leave a gold mark on white.
 * `SkyGradient` is imported rather than copied because it is a shared
 * constant, not a resolved token — `theme.ts` pins it dark in both themes —
 * and because the splash drifting out of step with the app's own sky surfaces
 * is exactly the kind of thing nobody notices for six builds.
 */

/**
 * Matches `expo-splash-screen`'s `backgroundColor` in `app.json`, and must
 * keep matching it. Change one without the other and the flash this file
 * exists to remove comes straight back, in a new colour.
 *
 * This is no longer where the splash ENDS up — `SkyGradient` is — but it is
 * still where it has to start, because `app.json` can only express one flat
 * colour and the native splash is drawn from it before any of this runs.
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

/**
 * How long the twilight gradient takes to arrive over the teal.
 *
 * Slower than the tagline's 450ms on purpose: the sky should look like dusk
 * falling rather than a colour being swapped, and the line is meant to land
 * before the sky finishes settling. Both are finished well before the overlay
 * starts clearing at 1600ms, which leaves about a second of the splash fully
 * formed — the thing there was no room for at the old 1100ms.
 */
const SKY_FADE = 600;

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
      {/* The brand gradient, fading up over the teal rather than replacing it
          on a frame. The first pass above has to stay flat `TEAL` to match the
          native splash exactly, so this is where the sky can arrive without
          putting a seam in the handover. Absolute, so it sits behind the mark
          instead of joining the centred column. */}
      <Animated.View entering={FadeIn.duration(SKY_FADE)} style={styles.sky}>
        <LinearGradient
          colors={SkyGradient}
          // Corner to corner, the same angle as `SkyCard`, so the splash and
          // the surfaces inside the app are lit from the same direction.
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sky}
        />
      </Animated.View>
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
  sky: StyleSheet.absoluteFill,
  /**
   * Pure white, not a softened one, and it stays pure white now that the
   * gradient is underneath it. On `TEAL` it was 4.78:1 — AA for body text,
   * with no room to soften, because 92% opacity lands at 4.26:1 and fails.
   * On `SkyGradient` it is 7.78:1 against the light end and 17.13:1 against
   * the dark one, so the margin is comfortable at last — AAA across the whole
   * ramp, measured rather than eyeballed. Keep it white regardless:
   * `SkyGradient`'s own rule in `theme.ts` is white text, always.
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
