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
import { useSync } from '@/hooks/use-sync';
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
  const { active: syncActive, status: syncStatus, pending, lastResult, lastSyncedAt, sync } =
    useSync();

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
    const identity = user?.email ?? 'Your account';
    /** Apple's private relay hands over an address nobody recognises as their
     *  own, so it is worth naming HOW they signed in, not only as what. */
    const viaApple = user?.app_metadata?.provider === 'apple';
    const logged = visits.length + stays.length;

    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: 'Account' }} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <SkyCard style={styles.hero}>
            <Stars />
            <View style={styles.heroInner}>
              <ThemedText style={styles.heroEyebrow}>
                {viaApple ? 'SIGNED IN WITH APPLE' : 'SIGNED IN'}
              </ThemedText>
              <ThemedText style={styles.heroTitle} numberOfLines={1}>
                {identity}
              </ThemedText>
              {identity.includes('privaterelay') ? (
                <ThemedText style={styles.heroBody}>
                  That is Apple&apos;s private relay address. Mail sent to it
                  reaches you without us ever seeing your real one.
                </ThemedText>
              ) : null}

              <View style={styles.heroStats}>
                <HeroStat value={visits.length} label="VISITS" />
                <HeroStat value={stays.length} label="STAYS" />
                <HeroStat
                  value={syncActive ? Math.max(logged - pending, 0) : 0}
                  label="BACKED UP"
                />
              </View>
            </View>
          </SkyCard>

          {/* Backup state, said plainly rather than implied. */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: syncActive ? theme.border : theme.warning,
              },
            ]}
          >
            <View style={styles.cardHead}>
              <ThemedText type="smallBold">Backup</ThemedText>
              {syncActive ? (
                <Pressable
                  onPress={() => void sync()}
                  disabled={syncStatus === 'syncing'}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <ThemedText type="small" style={{ color: theme.accent }}>
                    {syncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            {!syncActive ? (
              <ThemedText type="small" themeColor="textSecondary">
                Not switched on yet. Your account exists, but the {logged}{' '}
                {logged === 1 ? 'entry' : 'entries'} on this phone are still
                only here. Export from Settings if you want a copy meanwhile.
              </ThemedText>
            ) : pending > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {pending} {pending === 1 ? 'change is' : 'changes are'} waiting
                to upload. They go up on their own next time you have signal.
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Everything on this phone is backed up.
              </ThemedText>
            )}

            {lastSyncedAt ? (
              <ThemedText type="small" themeColor="textFaint">
                Last synced {relativeTime(lastSyncedAt)}
              </ThemedText>
            ) : null}

            {lastResult?.error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {lastResult.error}
              </ThemedText>
            ) : null}

            {/* Photos are local file paths. Saying so beats a second device
                showing broken images and claiming they were backed up. */}
            <ThemedText type="small" themeColor="textFaint">
              Photos stay on this device — they are not uploaded.
            </ThemedText>
          </View>

          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            style={[
              styles.row,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <View style={styles.rowMain}>
              <ThemedText type="smallBold">Export your data</ThemedText>
              <ThemedText type="small" themeColor="textFaint">
                Visits and stays as a spreadsheet
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.accent }}>
              Settings
            </ThemedText>
          </Pressable>

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
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

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <ThemedText style={styles.heroStatValue}>{value}</ThemedText>
      <ThemedText style={styles.heroStatLabel}>{label}</ThemedText>
    </View>
  );
}

/** "3 minutes ago". Deliberately vague past a day — the exact minute a
 *  background sync ran is not information anyone acts on. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
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
  heroStats: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  heroStat: { gap: 1 },
  heroStatValue: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, gap: 2 },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  center: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  centerTitle: { fontSize: 28, lineHeight: 34 },
  centerBody: { lineHeight: 20 },
  footnote: { textAlign: 'center', lineHeight: 17 },
});
