import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much room the tab bar takes at the bottom of a tab screen.
 *
 * This replaced a hardcoded `BottomTabInset = 50`, which was wrong in a way
 * that only showed up on a fixed footer. On iOS the tab bar occupies its own
 * height AND the bottom safe area underneath it — about 49 + 34 = 83pt on a
 * notched iPhone, not 50. Scroll padding happened to survive the error because
 * it added `Spacing.five` on top and landed near 82 by accident; the
 * "Done" bar on the add-to-trip screen had no such slack and sat two thirds
 * behind the tab bar, where it could not be scrolled into view because a fixed
 * footer does not scroll.
 *
 * `useSafeAreaInsets` is what makes this right rather than a better guess: the
 * home-indicator inset differs between a notched iPhone, an SE, and an Android
 * phone with gesture navigation, and no constant covers all three.
 *
 * Needed because every tab sets `disableAutomaticContentInsets` — see
 * `app-tabs.tsx` for why — so each screen owns its own bottom spacing.
 */

/**
 * The bar itself, without the safe area.
 *
 * 49 is the long-standing UIKit tab bar height. Android's Material 3
 * navigation bar is 80dp with labels shown.
 */
const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 80, default: 56 });

export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom;
}

/** For screens presented OVER the tabs — modals — which have no tab bar but
 *  still need to clear the home indicator. */
export function useSafeBottom(): number {
  return useSafeAreaInsets().bottom;
}
