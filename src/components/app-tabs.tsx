import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Four tabs. SF Symbols rather than bundled PNGs — they are vector, respect
 * the system tint, and give a filled variant for the selected state for free.
 *
 * Two things here exist to stop the bar changing size as you move between
 * tabs, which it did:
 *
 * 1. `minimizeBehavior`. On iOS 26 the default is `automatic`, which shrinks
 *    the tab bar to a pill on scroll-down and expands it on scroll-up. Each
 *    tab keeps its OWN scroll offset, so switching from a scrolled Dining list
 *    to an unscrolled Home landed you on a bar of a different height — the
 *    inconsistency was per-tab because the scroll position is per-tab. `never`
 *    pins it.
 *
 * 2. An explicit, identical label metric for both states. Leaving `fontSize`
 *    and `fontWeight` unset lets the platform pick a different face for the
 *    selected item, so the selected label — and the capsule drawn around it —
 *    measured differently from its neighbours. Only the colour may differ
 *    between default and selected.
 *
 * Note which props actually apply where, because several are silently inert:
 * `indicatorColor` is Android/web only, and on iOS `backgroundColor`,
 * `blurEffect` and `shadowColor` apply to iOS 18 and earlier only — iOS 26
 * draws liquid glass and ignores them.
 */

/** Pinned so default and selected can never measure differently. */
const LABEL = { fontSize: 11, fontWeight: '600' } as const;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      minimizeBehavior="never"
      backgroundColor={colors.background}
      iconColor={{ default: colors.textFaint, selected: colors.accent }}
      labelStyle={{
        default: { ...LABEL, color: colors.textFaint },
        selected: { ...LABEL, color: colors.text },
      }}
      // Android only — the Material 3 active indicator. Inert on iOS.
      {...Platform.select({ android: { indicatorColor: colors.backgroundSelected }, default: {} })}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home_filled' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dining">
        <NativeTabs.Trigger.Label>Dining</NativeTabs.Trigger.Label>
        {/* `fork.knife` has no `.fill` variant in SF Symbols, so this is the
            one tab whose glyph cannot thicken on selection. The colour change
            still carries it, and the alternatives that do fill — a takeout bag,
            a circled fork — are worse at saying "restaurants". */}
        <NativeTabs.Trigger.Icon
          sf={{ default: 'fork.knife', selected: 'fork.knife' }}
          md={{ default: 'restaurant', selected: 'restaurant' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="resorts">
        <NativeTabs.Trigger.Label>Resorts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bed.double', selected: 'bed.double.fill' }}
          md={{ default: 'hotel', selected: 'hotel' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="passport">
        <NativeTabs.Trigger.Label>Passport</NativeTabs.Trigger.Label>
        {/* `medal` rather than `rosette`: rosette has no fill variant either,
            and a medal reads straight onto the Bronze/Silver/Gold tiers. */}
        <NativeTabs.Trigger.Icon
          sf={{ default: 'medal', selected: 'medal.fill' }}
          md={{ default: 'workspace_premium', selected: 'workspace_premium' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
