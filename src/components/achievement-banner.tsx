import { AchievementCelebration } from '@/components/achievement-celebration';
import { useAchievements } from '@/hooks/use-achievements';

/**
 * Announces whatever is at the front of the achievement queue.
 *
 * Mounted once, at the root, above the Stack — so it appears over whatever
 * screen the user is on. Logging the visit that earns a medal happens inside
 * a modal, and a celebration confined to the Passport tab would fire where
 * nobody is standing.
 *
 * **There used to be two treatments and now there is one.** A slim banner
 * dropped in for Bronze, Silver and Gold, and only finishing a challenge took
 * over the screen. The reasoning was that a rung on the ladder is news you
 * want told and then out of your way — but in practice it meant three out of
 * every four medals arrived looking like a notification from another app, and
 * the thing being celebrated never registered as a reward. Every rung gets
 * the celebration now.
 *
 * What keeps Platinum from feeling like Bronze is intensity rather than
 * format: `AchievementCelebration` grades its confetti, dwell and haptic
 * beats by tier. See `GRADE` there.
 *
 * The banner itself is gone rather than left unreferenced — it was two
 * hundred lines nothing could reach, and the swipe-to-dismiss and shine
 * sweep that justified it are in the git history if the slim treatment is
 * ever wanted back.
 */
export function AchievementBanner() {
  const { queue, dismiss } = useAchievements();
  const top = queue[0];
  if (!top) return null;

  // Keyed, so a second unlock arriving behind the first remounts and replays
  // the entrance rather than silently swapping the text of something that is
  // already sitting still.
  return (
    <AchievementCelebration
      key={top.key}
      unlock={top}
      queued={queue.length > 1}
      onDone={dismiss}
    />
  );
}
