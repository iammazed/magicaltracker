import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';

/**
 * Tapping the tab you are already on sends you back to the top.
 *
 * ## Why this is in JS when the native tab bar claims to do it
 *
 * `NativeTabs` passes `scrollToTop: !disableScrollToTop` down to UIKit and
 * that prop defaults to true, so in principle this is already the behaviour.
 * In practice the native side has to FIND the scroll view to scroll, and it
 * does that by looking for the first one inside the screen — the same
 * heuristic that `disableAutomaticContentInsets` exists to work around in
 * `app-tabs.tsx`, where it had been picking a horizontal filter strip instead
 * of the list underneath it. A screen with a nested horizontal `ScrollView` in
 * it, which Home has, is exactly the shape that heuristic gets wrong.
 *
 * So this attaches the behaviour to a ref the screen names explicitly. If the
 * native side is already doing it, both scroll to offset zero and the result
 * is identical; if it is not, this is the thing that makes it work. The one
 * outcome ruled out is the current one, where whether it happens depends on
 * the order of scroll views in a tree nobody is thinking about.
 *
 * ## `isFocused` is the whole trick
 *
 * `tabPress` fires on the target tab's own navigation object whenever its
 * button is tapped, including when you are arriving from another tab. Without
 * the guard, switching from Dining to Home would scroll Home to the top and
 * throw away where you had been reading — so the guard is not a nicety, it is
 * what distinguishes "go to Home" from "I am already on Home".
 *
 * Focus has not moved yet at the point the event fires, which is why reading
 * it here answers the right question: true means this tab was already the one
 * in front of you, so the tap was a second one.
 */
export function useScrollToTopOnTabPress(
  ref: React.RefObject<ScrollView | null>,
  { animated = true }: { animated?: boolean } = {},
) {
  const navigation = useNavigation();

  /**
   * Held in a ref so the effect does not re-subscribe when the caller passes a
   * fresh options object, which a caller writing `{ animated: true }` inline
   * does on every render.
   */
  const animatedRef = useRef(animated);
  animatedRef.current = animated;

  const scroll = useCallback(() => {
    ref.current?.scrollTo({ y: 0, animated: animatedRef.current });
  }, [ref]);

  useEffect(() => {
    /**
     * Typed loosely on purpose. `tabPress` is emitted by the native tabs
     * navigator but is not in the base navigation prop's event union, so the
     * strict signature rejects the string — and casting the listener is
     * narrower than casting `navigation` itself, which would lose the typing
     * on every other method.
     */
    const listener = navigation.addListener(
      'tabPress' as never,
      (() => {
        if (navigation.isFocused()) scroll();
      }) as never,
    );
    return listener;
  }, [navigation, scroll]);

  // Returned so a screen can also offer a "back to top" button later without
  // duplicating the ref plumbing.
  return scroll;
}
