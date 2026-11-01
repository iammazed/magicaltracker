import * as Haptics from 'expo-haptics';

/**
 * Every haptic in the app, in one place.
 *
 * It used to be two inline calls in the achievement banner, which meant the
 * only thing in the whole app you could feel was an achievement unlock — and
 * unlocks are rare, so the first tester reasonably concluded haptics were
 * broken. There was nothing to compare against.
 *
 * **Failure is silent, deliberately.** `expo-haptics` resolves its native
 * module with `requireOptionalNativeModule`, which returns null instead of
 * throwing, so the import is safe on a binary that predates the package and
 * the call rejects with an `UnavailabilityError` instead. A simulator, a
 * phone with System Haptics switched off in Settings, and an older build all
 * land here, and none of them is worth a Sentry event for a missing buzz.
 *
 * That same silence is why a tester cannot tell "no haptic was requested"
 * from "the phone declined" — so if haptics seem dead, check Settings →
 * Sounds & Haptics → System Haptics before suspecting this file.
 */

const quiet = (p: Promise<void>) => {
  void p.catch(() => {});
};

/** Something was written: a visit, a stay. The standard iOS success tap. */
export function tapSaved() {
  quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/**
 * A rung on the way up a tiered challenge.
 *
 * One medium impact, not the fanfare. Spending the big pattern on Bronze
 * leaves nothing louder for Platinum.
 */
export function tapTier() {
  quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/**
 * Finishing a challenge outright.
 *
 * Three beats rather than one, because a single Success pattern is exactly
 * what a text message feels like — indistinguishable from a notification
 * arriving, which is how the one genuinely big moment in the app came to feel
 * like nothing at all. The spacing is loose enough that the Taptic Engine has
 * settled between beats; run them closer and they blur into one long buzz.
 *
 * Returns a cancel function, so dismissing the celebration early stops the
 * phone buzzing at someone who has already moved on.
 */
export function tapFinished(): () => void {
  const beats: { at: number; fire: () => void }[] = [
    { at: 0, fire: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)) },
    { at: 230, fire: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)) },
    { at: 400, fire: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)) },
  ];

  const timers = beats
    .filter((b) => b.at > 0)
    .map((b) => setTimeout(b.fire, b.at));
  beats[0].fire();

  return () => timers.forEach(clearTimeout);
}
