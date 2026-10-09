import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { TripsProvider } from '@/hooks/use-trips';
import { VisitsProvider } from '@/hooks/use-visits';
import { DATABASE_NAME, migrate } from '@/lib/local-db';

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
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <VisitsProvider>
        <TripsProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="venue/[id]" options={{ title: '' }} />
            <Stack.Screen name="resort/[id]" options={{ title: '' }} />
            <Stack.Screen name="trip/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="new-trip"
              options={{ title: 'New trip', presentation: 'modal' }}
            />
            <Stack.Screen
              name="log-visit"
              options={{ title: 'Log a visit', presentation: 'modal' }}
            />
            <Stack.Screen
              name="log-stay"
              options={{ title: 'Log a stay', presentation: 'modal' }}
            />
            <Stack.Screen
              name="theme"
              options={{ title: 'Design tokens', presentation: 'modal' }}
            />
          </Stack>
        </ThemeProvider>
        </TripsProvider>
      </VisitsProvider>
    </SQLiteProvider>
  );
}
