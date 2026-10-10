import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BrandFontsProvider } from '@/hooks/use-brand-fonts';
import { CatalogProvider } from '@/hooks/use-catalog';
import { CatalogFiltersProvider } from '@/hooks/use-catalog-filters';
import { NearbyProvider } from '@/hooks/use-nearby';
import { PremiumProvider } from '@/hooks/use-premium';
import { TripsProvider } from '@/hooks/use-trips';
import { VisitsProvider } from '@/hooks/use-visits';
import { DATABASE_NAME, migrate } from '@/lib/local-db';

SplashScreen.preventAutoHideAsync();

/**
 * Anything that throws while rendering lands here.
 *
 * Expo Router picks this up from the named export. Without it a render error
 * in any screen shows a black screen once the splash has been dismissed,
 * which says nothing and sent me looking in the wrong place for an afternoon.
 * Deliberately styled with literals rather than tokens: this has to work even
 * when the thing that broke is the theme.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorRoot}>
      <ScrollView contentContainerStyle={styles.errorScroll}>
        <Text style={styles.errorTitle}>Something broke</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        {error.stack ? <Text style={styles.errorStack}>{error.stack}</Text> : null}
        <Pressable onPress={() => void retry()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Try again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}


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
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={migrate}
      // A migration or seed that throws otherwise fails silently and leaves
      // the children unmounted, which looks identical to a hang.
      onError={(e) => console.error('[local-db] init failed:', e)}
    >
      <BrandFontsProvider>
      <PremiumProvider>
      <NearbyProvider>
      <CatalogProvider>
        <CatalogFiltersProvider>
        <VisitsProvider>
          <TripsProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
            <Stack
              screenOptions={{
                /**
                 * Chevron only, no back label.
                 *
                 * iOS defaults to labelling the back button with the PREVIOUS
                 * screen's title, and the previous screen here is the tab
                 * group — which has no title, so navigation fell back to the
                 * route name and the button read "< (tabs)".
                 *
                 * Giving `(tabs)` a title would not fix it either: one title
                 * has to serve four tabs, so opening a restaurant from Dining
                 * would show "< Home". A bare chevron is both correct and
                 * what Apple falls back to when a label will not fit.
                 */
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="venue/[id]" options={{ title: '' }} />
              <Stack.Screen name="resort/[id]" options={{ title: '' }} />
              <Stack.Screen name="trip/[id]" options={{ title: '' }} />
              <Stack.Screen
                name="new-trip"
                // No title: TripPlanner carries its own heading inside the
                // card, and a header saying the same thing above it was the
                // duplication that made the heading look bolted on.
                options={{ title: '', presentation: 'modal' }}
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
                name="paywall"
                options={{ title: '', presentation: 'modal' }}
              />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              {/* Full screen, no header, not dismissable by a swipe: it is the
                  first thing a new install shows and backing out of it halfway
                  would leave the passport half-seeded with no way back in. */}
              <Stack.Screen
                name="onboarding"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="theme"
                options={{ title: 'Design tokens', presentation: 'modal' }}
              />
            </Stack>
        </ThemeProvider>
          </TripsProvider>
        </VisitsProvider>
        </CatalogFiltersProvider>
      </CatalogProvider>
      </NearbyProvider>
      </PremiumProvider>
      </BrandFontsProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  errorRoot: { flex: 1, backgroundColor: '#0C1418' },
  errorScroll: { padding: 24, paddingTop: 72, gap: 12 },
  errorTitle: { color: '#E6EEEE', fontSize: 22, fontWeight: '700' },
  errorMessage: { color: '#E58A78', fontSize: 15, lineHeight: 21 },
  errorStack: { color: '#6E858D', fontSize: 11, lineHeight: 16 },
  errorButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#2FB5AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  errorButtonText: { color: '#052322', fontWeight: '700' },
});
