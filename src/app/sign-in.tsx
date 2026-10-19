import * as AppleAuthentication from 'expo-apple-authentication';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useVisits } from '@/hooks/use-visits';

/**
 * Sign in — optional, and the screen says so.
 *
 * The honest pitch is narrow: everything already works without an account, so
 * the only thing on offer is that the record survives. Overselling it would
 * invite the question "then why did you let me log 40 meals first?", and the
 * answer — that forcing signup first is the biggest install-to-active killer
 * — is not one a user should have to infer.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const scheme = useColorScheme();
  const {
    status, user, busy, linkError, clearLinkError,
    appleAvailable, signInWithApple, sendMagicLink, signOut,
  } = useAuth();
  const { visits, stays } = useVisits();

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onApple = async () => {
    setError(null);
    const result = await signInWithApple();
    if (result.error) setError(result.error);
    else if (result.ok) router.back();
  };

  const onEmail = async () => {
    setError(null);
    const result = await sendMagicLink(email);
    if (result.error) setError(result.error);
    else if (result.ok) setSentTo(email.trim());
  };

  /* ── Already signed in ───────────────────────────────────────────────── */
  if (status === 'signed-in') {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: 'Account' }} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <SkyCard style={styles.hero}>
            <Stars />
            <View style={styles.heroInner}>
              <ThemedText style={styles.heroEyebrow}>SIGNED IN</ThemedText>
              <ThemedText style={styles.heroTitle} numberOfLines={1}>
                {user?.email ?? 'Your account'}
              </ThemedText>
              <ThemedText style={styles.heroBody}>
                Everything you log is backed up and will come back if you
                reinstall or switch phones.
              </ThemedText>
            </View>
          </SkyCard>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText type="smallBold">On this device</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {visits.length} {visits.length === 1 ? 'visit' : 'visits'} ·{' '}
              {stays.length} {stays.length === 1 ? 'stay' : 'stays'}
            </ThemedText>
          </View>

          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: theme.border }]}
          >
            <ThemedText type="small" style={{ color: theme.accent }}>
              Sign out
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textFaint" style={styles.footnote}>
            Signing out leaves everything on this device. It is not a delete.
          </ThemedText>
        </ScrollView>
      </ThemedView>
    );
  }

  /* ── Link sent ───────────────────────────────────────────────────────── */
  if (sentTo && !linkError) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.center}>
          <ThemedText type="title" style={styles.centerTitle}>
            Check your email
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerBody}>
            We sent a sign-in link to {sentTo}. Open it on this phone and it
            will bring you straight back here.
          </ThemedText>
          <ThemedText type="small" themeColor="textFaint" style={styles.centerBody}>
            Nothing arrived? Check spam, and make sure the address is right —
            we cannot tell the difference between a typo and a new account.
          </ThemedText>
          <Pressable
            onPress={() => setSentTo(null)}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: theme.border }]}
          >
            <ThemedText type="small" style={{ color: theme.accent }}>
              Use a different address
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  /* ── Signed out ──────────────────────────────────────────────────────── */
  const logged = visits.length + stays.length;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag">
        <View style={styles.masthead}>
          <Wordmark size="lg" />
        </View>

        <SkyCard style={styles.hero}>
          <Stars />
          <View style={styles.heroInner}>
            <ThemedText style={styles.heroEyebrow}>OPTIONAL</ThemedText>
            <ThemedText style={styles.heroTitle}>Keep your passport safe</ThemedText>
            <ThemedText style={styles.heroBody}>
              {logged > 0
                ? `Everything you have logged lives on this phone only. Sign in and those ${logged} entries are backed up and follow you to a new one.`
                : 'Everything you log lives on this phone only. Sign in and it is backed up, and follows you to a new phone.'}
            </ThemedText>
          </View>
        </SkyCard>

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            /* Apple's Human Interface Guidelines require the button to contrast
               with its background, so it inverts with the scheme. Using their
               component rather than a lookalike is also a review requirement. */
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={Radius.medium}
            style={styles.appleButton}
            onPress={() => void onApple()}
          />
        ) : null}

        {appleAvailable ? (
          <View style={styles.dividerRow}>
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
            <ThemedText type="small" themeColor="textFaint">
              or
            </ThemedText>
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
          </View>
        ) : null}

        <View style={styles.field}>
          <ThemedText type="smallBold">Email a sign-in link</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
            onSubmitEditing={() => void onEmail()}
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
          <Pressable
            onPress={() => void onEmail()}
            disabled={busy || !email.trim()}
            accessibilityRole="button"
            style={[
              styles.primary,
              {
                backgroundColor: email.trim() ? theme.accent : theme.backgroundSelected,
              },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: email.trim() ? theme.onAccent : theme.textFaint }}
            >
              {busy ? 'Sending…' : 'Send link'}
            </ThemedText>
          </Pressable>
        </View>

        {linkError ? (
          <Pressable
            onPress={clearLinkError}
            accessibilityRole="button"
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.danger }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.danger }}>
              That link did not work
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {linkError}
            </ThemedText>
            <ThemedText type="small" themeColor="textFaint">
              Links expire and can only be used once. Send a fresh one.
            </ThemedText>
          </Pressable>
        ) : null}

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={styles.secondary}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Keep using it without an account
          </ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="textFaint" style={styles.footnote}>
          We only ever use your email to sign you in. Nothing is posted
          anywhere, and nothing is shared.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  masthead: { alignItems: 'center', paddingVertical: Spacing.two },
  hero: { minHeight: 160 },
  heroInner: { padding: Spacing.four, gap: Spacing.one },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  heroTitle: { color: '#ffffff', fontSize: 26, lineHeight: 32, fontWeight: '700' },
  heroBody: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.one,
  },
  appleButton: { height: 50 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  field: { gap: Spacing.two },
  input: {
    paddingHorizontal: Spacing.three,
    height: 50,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  primary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  center: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  centerTitle: { fontSize: 28, lineHeight: 34 },
  centerBody: { lineHeight: 20 },
  footnote: { textAlign: 'center', lineHeight: 17 },
});
