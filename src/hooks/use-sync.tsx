import { useSQLiteContext } from 'expo-sqlite';
import { AppState } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useTrips } from '@/hooks/use-trips';
import { useVisits } from '@/hooks/use-visits';
import { getSetting, setSetting } from '@/lib/local-db';
import { clearOwner, pendingCount, syncNow, type SyncResult } from '@/lib/sync';

/**
 * Sync, behind a switch.
 *
 * **Off by default.** This is the one feature in the app whose bug destroys
 * data rather than displaying something wrong, so it does not run until it
 * has been exercised on a throwaway account. `SYNC_ENABLED` is the gate;
 * flipping it to true is the deliberate act of turning it on, and the dev
 * toggle in Settings lets it be tested first without that commitment.
 *
 * When it is on, it runs on sign-in and on returning to the foreground —
 * never on a timer. A trip log changes a few times a day at most, and a
 * background poll would spend battery in a park where the signal is already
 * bad.
 */

/**
 * The master switch.
 *
 * On, as of the end-to-end run on a real device: guest data adopted on first
 * sign-in, a reinstall pulling an account back, and two accounts on one phone
 * staying separate in both directions. Two bugs died in that run — a stale
 * `TripsProvider` that made correct database state look like a failed sync,
 * and an ownership check that treated a device which had synced before the
 * owner id existed as a fresh guest.
 */
export const SYNC_ENABLED = true;

/** Dev-only override, so it can be exercised while the master switch is off. */
const DEV_KEY = 'sync_dev_enabled';

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

type SyncValue = {
  /** Whether sync will actually run — the master switch, or the dev override. */
  active: boolean;
  status: SyncStatus;
  pending: number;
  lastResult: SyncResult | null;
  lastSyncedAt: string | null;
  sync: () => Promise<void>;
  refreshPending: () => Promise<void>;
  /** Pushes anything outstanding, then reports whether it is safe to sign
   *  out — see `flushBeforeSignOut`. */
  flushBeforeSignOut: () => Promise<{ safe: boolean; pending: number }>;
  /** Forgets which account owns the local rows. For account deletion. */
  releaseOwnership: () => Promise<void>;
  /** `__DEV__` only. Returns false in a release build without changing state. */
  setDevEnabled: (on: boolean) => Promise<boolean>;
  devEnabled: boolean;
};

const SyncContext = createContext<SyncValue | null>(null);

const LAST_SYNC_KEY = 'sync_last_at';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { status: authStatus, user } = useAuth();
  const { visits, refresh: refreshVisits } = useVisits();
  const { trips, refresh: refreshTrips } = useTrips();

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pending, setPending] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [devEnabled, setDevEnabledState] = useState(false);

  /** Two syncs at once would push the same rows twice. Harmless thanks to
   *  upserts, but it wastes a round trip and muddles the status. */
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dev, last, count] = await Promise.all([
        __DEV__ ? getSetting(db, DEV_KEY) : Promise.resolve(null),
        getSetting(db, LAST_SYNC_KEY),
        pendingCount(db),
      ]);
      if (cancelled) return;
      setDevEnabledState(dev === '1');
      setLastSyncedAt(last);
      setPending(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const active = SYNC_ENABLED || (__DEV__ && devEnabled);

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount(db));
  }, [db]);

  const sync = useCallback(async () => {
    if (!active || inFlight.current) return;
    if (authStatus !== 'signed-in' || !user?.id) return;

    inFlight.current = true;
    setStatus('syncing');
    try {
      const result = await syncNow(db, user.id);
      setLastResult(result);
      setStatus(result.error ? 'error' : 'ok');

      if (!result.error) {
        const now = new Date().toISOString();
        await setSetting(db, LAST_SYNC_KEY, now);
        setLastSyncedAt(now);
      }
      /**
       * Both stores, always — not just when rows came down.
       *
       * A wipe deletes from SQLite and changes nothing in memory, so without
       * this the previous account's trips stayed on screen under the new
       * user. And pulled trips were written but never displayed, because
       * `TripsProvider` had already loaded an empty list. Refreshing only
       * `visits` is what made both of those look like sync failures when the
       * database was in fact correct.
       */
      if (result.pulled > 0 || result.switchedUser) {
        await Promise.all([refreshVisits(), refreshTrips()]);
      }
      await refreshPending();
    } finally {
      inFlight.current = false;
    }
  }, [active, authStatus, user?.id, db, refreshVisits, refreshTrips, refreshPending]);

  /** On sign-in. Not on every render, and not on a timer. */
  useEffect(() => {
    if (active && authStatus === 'signed-in') void sync();
  }, [active, authStatus, sync]);

  /**
   * And on returning to the foreground.
   *
   * The comment above this block used to claim this happened and it did not —
   * sync ran once at sign-in and never again, so "Everything on this phone is
   * backed up" became false the moment anything was logged and stayed false
   * until the next launch. Foreground is the right trigger for a trip log:
   * you log a meal, put the phone away, and the upload happens when you next
   * pick it up. A timer would spend battery in a park where signal is already
   * poor, for data that changes a few times a day.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      // Recount first: the card should tell the truth even when the sync
      // itself cannot run, offline or signed out.
      void refreshPending();
      if (active && authStatus === 'signed-in') void sync();
    });
    return () => sub.remove();
  }, [active, authStatus, sync, refreshPending]);

  /**
   * Keep the pending count honest as things are logged.
   *
   * `visits` and `trips` change whenever either store writes, which is the
   * cheapest signal available that something now needs uploading.
   */
  useEffect(() => {
    void refreshPending();
  }, [visits, trips, refreshPending]);

  /**
   * Flush before signing out.
   *
   * Signing out leaves the rows on the device, and the next person to sign in
   * causes them to be wiped — correct, because by then they live on the
   * server. That is only true if they actually got there, so anything
   * outstanding is pushed first and the caller is told whether it worked.
   */
  const flushBeforeSignOut = useCallback(async () => {
    const outstanding = await pendingCount(db);
    if (outstanding === 0) return { safe: true, pending: 0 };
    if (!active || authStatus !== 'signed-in' || !user?.id) {
      return { safe: false, pending: outstanding };
    }
    const result = await syncNow(db, user.id);
    const left = await pendingCount(db);
    setPending(left);
    return { safe: !result.error && left === 0, pending: left };
  }, [db, active, authStatus, user?.id]);

  const releaseOwnership = useCallback(async () => {
    await clearOwner(db);
  }, [db]);

  const value = useMemo<SyncValue>(
    () => ({
      active,
      status,
      pending,
      lastResult,
      lastSyncedAt,
      sync,
      refreshPending,
      flushBeforeSignOut,
      releaseOwnership,
      devEnabled,
      setDevEnabled: async (on: boolean) => {
        if (!__DEV__) return false;
        await setSetting(db, DEV_KEY, on ? '1' : '0');
        setDevEnabledState(on);
        return on;
      },
    }),
    [active, status, pending, lastResult, lastSyncedAt, sync, refreshPending,
     flushBeforeSignOut, releaseOwnership, devEnabled, db],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
