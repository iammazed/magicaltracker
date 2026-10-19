import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

/**
 * Supabase client for the app.
 *
 * Reads the publishable key, which is designed to be public — Row Level
 * Security is what protects the data, not the secrecy of this value. The
 * service/secret key must never appear here: anything with an EXPO_PUBLIC_
 * prefix is inlined into the shipped binary in plain text.
 *
 * `process.env.EXPO_PUBLIC_*` must be written as static dot notation. Metro
 * substitutes these at build time by matching the literal text, so
 * `process.env['EXPO_PUBLIC_…']` or destructuring silently yields undefined.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Supabase env vars are missing. Copy .env.example to .env and fill it in, ' +
      'then fully reload the app — editing .env does not hot-reload. For a ' +
      'build, they come from EAS: `eas env:set --name … --environment …`.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    /**
     * Sessions survive the app being closed.
     *
     * AsyncStorage rather than `expo-secure-store`, which is the trade-off
     * Supabase's own React Native guide makes: SecureStore caps a value at
     * 2048 bytes and a Supabase session — access token, refresh token and the
     * user object — routinely exceeds that, so using it means hand-rolling a
     * chunking adapter whose failure mode is a user silently logged out.
     *
     * The cost is that the refresh token sits in the app sandbox rather than
     * the Keychain. On a device with a passcode that is encrypted at rest, and
     * the token is scoped to one user's own trip log. Worth revisiting if this
     * app ever holds anything more sensitive than where someone ate dinner.
     */
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    /**
     * False because this is not a browser. `detectSessionInUrl` looks for an
     * OAuth fragment on `window.location`, which does not exist here — the
     * magic-link deep link is handled explicitly in `use-auth.tsx`.
     */
    detectSessionInUrl: false,
  },
});

/**
 * Refresh tokens only while the app is actually in front of someone.
 *
 * Supabase's timer keeps running when the app is backgrounded, which burns
 * cycles and can fire a refresh against a dead network just as iOS suspends
 * the process. Tying it to AppState is what Supabase's React Native guide
 * recommends, and the session is restored from storage on resume regardless.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
