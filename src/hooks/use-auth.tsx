import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Who is signed in, if anyone.
 *
 * **Guest mode is the default and stays first-class.** Everything in the app
 * works with no account — visits, stays, trips, the passport. Signing in buys
 * one thing: that record surviving a reinstall or reaching a second device.
 * Forcing signup before anyone can log anything is the single biggest
 * install-to-active killer, which is why `session` being null is a normal
 * state rather than a gate.
 */

export type AuthStatus = 'loading' | 'guest' | 'signed-in';

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** True while a sign-in attempt is in flight. */
  busy: boolean;
  /** Apple only exists on iOS, and only on a build carrying the entitlement. */
  appleAvailable: boolean;
  signInWithApple: () => Promise<{ ok: boolean; error?: string }>;
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Where the magic link comes back to. `magicaltracker://auth` must be in
 *  Supabase's redirect allow list or the link dead-ends. */
const REDIRECT_TO = Linking.createURL('auth');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  /* ── Restore, then follow ───────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'guest');
    });

    // Covers sign-in, sign-out, token refresh and recovery from a deep link,
    // so nothing else in the app has to know which of those just happened.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed-in' : 'guest');
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* ── Is Sign in with Apple actually usable here? ─────────────────────── */
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (!cancelled) setAppleAvailable(available);
      })
      .catch(() => {
        if (!cancelled) setAppleAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Magic link arriving back from email ─────────────────────────────── */
  useEffect(() => {
    /**
     * Supabase returns the tokens in the URL **fragment**, after `#`, which is
     * deliberately not sent to servers. `Linking.parse` only reads the query
     * string, so the fragment has to be split off by hand — reading
     * `queryParams` here returns nothing and looks like a broken link.
     */
    const handle = async (url: string) => {
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return;
      await supabase.auth.setSession({ access_token, refresh_token });
    };

    // A link that launched the app from cold, and one that arrived while it
    // was already open. Both happen; only handling the second is the bug
    // where tapping the email from a closed app does nothing.
    void Linking.getInitialURL().then((url) => {
      if (url) void handle(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => sub.remove();
  }, []);

  /* ── Sign in with Apple ──────────────────────────────────────────────── */
  const signInWithApple = useCallback(async () => {
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { ok: false, error: 'Apple did not return an identity token.' };
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { ok: false, error: error.message };

      /**
       * Apple hands over the name on the FIRST authorization only. Every
       * later sign-in returns null, and there is no way to ask again short of
       * the user revoking the app in their Apple ID settings. So it is saved
       * immediately or it is gone.
       */
      const name = credential.fullName;
      if (name?.givenName || name?.familyName) {
        const fullName = [name.givenName, name.middleName, name.familyName]
          .filter(Boolean)
          .join(' ');
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }

      return { ok: true };
    } catch (e) {
      // Backing out of the Apple sheet is a normal thing to do, not an error
      // worth putting on screen.
      if (isCancellation(e)) return { ok: false };
      return { ok: false, error: message(e) };
    } finally {
      setBusy(false);
    }
  }, []);

  /* ── Magic link ──────────────────────────────────────────────────────── */
  const sendMagicLink = useCallback(async (email: string) => {
    const address = email.trim();
    if (!address) return { ok: false, error: 'Enter an email address.' };

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          emailRedirectTo: REDIRECT_TO,
          // True, so a first-time address creates an account rather than
          // failing. There is no separate sign-up here — the link is both.
          shouldCreateUser: true,
        },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: message(e) };
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Local SQLite is deliberately left alone. Signing out is not "delete my
    // trips" — the rows stay on the device exactly as they would for a guest,
    // and sync picks them up again on the next sign-in.
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      busy,
      appleAvailable,
      signInWithApple,
      sendMagicLink,
      signOut,
    }),
    [status, session, busy, appleAvailable, signInWithApple, sendMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

function isCancellation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

function message(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/network|fetch/i.test(raw)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return raw;
}
