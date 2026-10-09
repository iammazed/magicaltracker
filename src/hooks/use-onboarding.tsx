import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getSetting, setSetting } from '@/lib/local-db';

/**
 * Whether the first-run pass has happened.
 *
 * Stored rather than inferred. "Has any visit been logged?" looks like the same
 * question and is not: someone who genuinely skipped would be asked again on
 * every launch forever, which is worse than never asking.
 */

const KEY = 'onboarding_done';

export function useOnboarding() {
  const db = useSQLiteContext();
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const value = await getSetting(db, KEY);
      if (!cancelled) setDone(value === '1');
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const complete = useCallback(async () => {
    await setSetting(db, KEY, '1');
    setDone(true);
  }, [db]);

  /** For the Settings screen, so the pass can be run again deliberately. */
  const reset = useCallback(async () => {
    await setSetting(db, KEY, '0');
    setDone(false);
  }, [db]);

  // `null` means "not known yet" and must not be treated as "not done", or the
  // first frame of every launch would redirect into onboarding.
  return { done, loading: done === null, complete, reset };
}
