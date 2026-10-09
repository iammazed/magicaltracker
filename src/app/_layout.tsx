// Imported from the per-weight subpaths, not the package roots. Each package's
// index.js `require`s every weight it ships, so importing from the root makes
// Metro bundle all of them — about 800 KB of Figtree the app never renders.
import { BerkshireSwash_400Regular } from '@expo-google-fonts/berkshire-swash/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico/400Regular';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CatalogProvider } from '@/hooks/use-catalog';
import { CatalogFiltersProvider } from '@/hooks/use-catalog-filters';
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

  /**
   * The three wordmark faces, loaded at runtime rather than through the
   * expo-font config plugin — the plugin needs a prebuild, so plugin-bundled
   * fonts are simply absent in Expo Go.
   *
   * These are wordmark-only faces. Nothing else in the app may use them.
   */
  const [fontsLoaded, fontError] = useFonts({
    BerkshireSwash_400Regular,
    Pacifico_400Regular,
    Figtree_600SemiBold,
  });

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <CatalogProvider>
        <CatalogFiltersProvider>
        <VisitsProvider>
          <TripsProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/*
            The overlay stays mounted whatever happens to the fonts — it is
            what calls `SplashScreen.hideAsync()`, so gating it would leave the
            native splash up forever on a font failure. A font error still
            renders the app; the wordmark just falls back to the system face.
          */}
          <AnimatedSplashOverlay />
          {fontsLoaded || fontError ? (
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
                name="filters"
                options={{ title: 'Filters', presentation: 'modal' }}
              />
              <Stack.Screen
                name="theme"
                options={{ title: 'Design tokens', presentation: 'modal' }}
              />
            </Stack>
          ) : null}
        </ThemeProvider>
          </TripsProvider>
        </VisitsProvider>
        </CatalogFiltersProvider>
      </CatalogProvider>
    </SQLiteProvider>
  );
}
