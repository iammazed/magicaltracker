import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/**
 * Root navigator — a Stack, with the tab group as its first screen.
 *
 * NativeTabs alone cannot push screens, so anything that opens ON TOP of the
 * tabs (venue detail, log-visit sheet, /theme) must be declared here rather
 * than inside `(tabs)`.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="theme"
          options={{ title: 'Design tokens', presentation: 'modal' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
