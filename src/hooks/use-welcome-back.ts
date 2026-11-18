import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getSetting, setSetting, todayISO } from '@/lib/local-db';

/**
 * Whether this is the first time the app has been opened today.
 *
 * **A greeting on every open is wallpaper by the third one.** Someone
 * checking a restaurant three times while standing in line does not want to
 * be welcomed back twice more, so the gate is a calendar day rather than a
 * launch. `todayISO` is used rather than a timestamp because "a new day" is
 * what a person means by "since last time", and it is already the app's
 * notion of a day everywhere else.
 *
 * **Cold start is not enough on its own.** iOS keeps the JS context alive
 * across a backgrounded app, so Home does not remount when you come back to
 * it — the common case, far more common than the app being killed. Without
 * the `AppState` listener this would fire only after a true relaunch, which
 * is most of the feature missing. Re-checking on `active` costs one indexed
 * read of a settings row.
 *
 * The key is written on the first check of the day whether or not anything is
 * shown, so the answer is stable for the rest of the day no matter how many
 * times the app is reopened.
 */

const KEY = 'welcome_last_day';

export function useWelcomeBack(): boolean {
  const db = useSQLiteContext();
  const [show, setShow] = useState(false);

  const check = useCallback(async () => {
    const today = todayISO();
    const last = await getSetting(db, KEY);
    await setSetting(db, KEY, today);

    // Nothing on the launch that writes the key for the first time.
    // "Welcome back" to somebody who has never been here reads as a bug, and
    // the one launch where that is guaranteed is the one straight out of
    // onboarding.
    if (last === null || last === today) return;
    setShow(true);
  }, [db]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  // Never cleared once set. The line is small, secondary and inline, so
  // letting it sit for the rest of the session is cheaper than a timer that
  // yanks a row out from under the content below it.
  return show;
}
