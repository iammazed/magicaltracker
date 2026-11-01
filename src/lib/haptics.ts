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
 * A thing was picked off a list: a restaurant added to a trip.
 *
 * `selectionAsync` rather than the success notification, and the distinction
 * carries meaning here. Adding places to a trip is a run of taps down a long
 * list, and a notification-weight buzz on every one would be both wrong —
 * nothing was filed away, a selection changed — and quickly unbearable. This
 * is the light tick iOS uses under a picker wheel.
 */
export function tapPicked() {
  quiet(Haptics.selectionAsync());
}

/**
 * A celebration's haptic, graded by how big the news is.
 *
 * Three beats rather than one for the big moment, because a single Success
 * pattern is exactly what a text message feels like — indistinguishable from
 * a notification arriving, which is how the one genuinely big moment in the
 * app came to feel like nothing at all. The spacing is loose enough that the
 * Taptic Engine has settled between beats; run them closer and they blur into
 * one long buzz.
 *
 * `beats` is what keeps Bronze from feeling like Platinum now that both get
 * the full celebration. Every rung is worth a buzz; they are not worth the
 * SAME buzz, and spending the three-beat pattern on a quarter of the way
 * through leaves nothing louder for finishing.
 *
 * Returns a cancel function, so dismissing early stops the phone buzzing at
 * someone who has already moved on.
 */
export function tapCelebrate(beats: 1 | 2 | 3): () => void {
  const pattern = [
    { at: 0, fire: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)) },
    { at: 230, fire: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)) },
    { at: 400, fire: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)) },
  ].slice(0, beats);

  const timers = pattern
    .filter((b) => b.at > 0)
    .map((b) => setTimeout(b.fire, b.at));
  pattern[0].fire();

  return () => timers.forEach(clearTimeout);
}
