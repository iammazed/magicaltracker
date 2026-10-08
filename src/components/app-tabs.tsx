import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Four tabs. SF Symbols rather than bundled PNGs — they are vector, respect
 * the system tint, and give a filled variant for the selected state for free.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home_filled' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dining">
        <NativeTabs.Trigger.Label>Dining</NativeTabs.Trigger.Label>
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
        <NativeTabs.Trigger.Icon
          sf={{ default: 'rosette', selected: 'rosette' }}
          md={{ default: 'workspace_premium', selected: 'workspace_premium' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
