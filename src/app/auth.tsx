import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

/**
 * Where a magic link lands.
 *
 * This screen exists because expo-router treats the deep link's path as a
 * route. `magicaltracker://auth` was being matched against the route tree,
 * finding nothing, and rendering "Unmatched Route" — while `use-auth`'s
 * listener quietly set the session behind it. The session worked; the user
 * was stranded on a dead end.
 *
 * It does no token handling of its own. The tokens are in the URL *fragment*,
 * which expo-router does not expose as params, so `use-auth` reads them from
 * the raw URL. This screen only waits for the result and gets out of the way.
 */

/** Long enough for a slow network to finish `setSession`, short enough that a
 *  link which silently did nothing does not leave someone staring at a
 *  spinner. */
const GIVE_UP_AFTER_MS = 8000;

export default function AuthCallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status, linkError } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status === 'signed-in') {
      // `replace`, not `push`: the callback is not somewhere to go back to.
      router.replace('/');
      return;
    }
    if (linkError) {
      router.replace('/sign-in');
    }
  }, [status, linkError, router]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), GIVE_UP_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.inner}>
        <Wordmark size="lg" />

        {timedOut ? (
          <>
            <ThemedText type="smallBold" style={styles.text}>
              That took longer than it should
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
              The link may have expired, or already been used. Links work once.
            </ThemedText>
            <Pressable
              onPress={() => router.replace('/sign-in')}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.accent }]}
            >
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Try again
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/')}
              accessibilityRole="button"
              style={styles.secondary}
            >
              <ThemedText type="small" themeColor="textFaint">
                Keep going without an account
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={theme.accent} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
              Signing you in…
            </ThemedText>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  text: { textAlign: 'center', maxWidth: 300 },
  button: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
  secondary: { paddingVertical: Spacing.two },
});
