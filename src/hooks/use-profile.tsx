import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getSetting, setSetting } from '@/lib/local-db';

/**
 * What to call you.
 *
 * **Not the account's name, deliberately.** Apple hands over a name on the
 * first authorization only, Supabase never has one for a magic-link user, and
 * guest mode — the default, and first-class — has no account at all. Reading
 * the greeting off `user_metadata.full_name` would have meant it fired for a
 * small minority of people and showed a blank to everyone else.
 *
 * So it is asked for once, in onboarding, and it is optional. `null` is a
 * normal, permanent state, and every caller has to render something sensible
 * for it rather than treating it as a loading flicker.
 *
 * Local to the device, like the map layer and the onboarding flag: it lives
 * in `app_settings`, which is not in `USER_TABLES`, so it does not sync and
 * does not follow an account switch. That is the right call for a nickname —
 * the phone knows who is holding it, the server does not need to.
 *
 * A provider rather than a bare hook, unlike `useOnboarding`, because Home
 * and Settings are both mounted at once: editing the name in Settings has to
 * reach the Home tab sitting behind it, and two independent `getSetting`
 * reads would leave Home showing the old name until something remounted it.
 */

const KEY = 'display_name';

/**
 * Enough for a first name, not enough to break the masthead onto two lines.
 * Enforced on write rather than on the input, so a paste is clipped instead
 * of silently refused.
 */
const MAX_LENGTH = 24;

type ProfileValue = {
  /** Trimmed, or `null` when it was never set or was cleared. */
  name: string | null;
  /** `true` until the first read lands. Greet nobody while this is true. */
  loading: boolean;
  /** Empty or whitespace clears it. */
  save: (next: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const value = await getSetting(db, KEY);
      if (cancelled) return;
      // A row holding an empty string is the same as no row. Both mean "they
      // did not want to give one", and only one of them is a value.
      setName(value?.trim() ? value.trim() : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const save = useCallback(
    async (next: string) => {
      const clean = next.trim().slice(0, MAX_LENGTH);
      await setSetting(db, KEY, clean);
      setName(clean || null);
    },
    [db],
  );

  const value = useMemo(() => ({ name, loading, save }), [name, loading, save]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
