import { createClient } from '@supabase/supabase-js';

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
      'then fully reload the app — editing .env does not hot-reload.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // No accounts yet. Once Sign in with Apple lands this needs an
    // AsyncStorage adapter, or sessions vanish when the app is closed.
    persistSession: false,
    autoRefreshToken: false,
  },
});
