import { useSQLiteContext } from 'expo-sqlite';
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
import { useVisits } from '@/hooks/use-visits';
import { getSetting, setSetting } from '@/lib/local-db';
import { pendingCount, syncNow, type SyncResult } from '@/lib/sync';

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
 * The master switch. Set to `true` only after the guest-to-account path has
 * been verified end to end, including running a claim twice.
 */
export const SYNC_ENABLED = false;

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
  /** `__DEV__` only. Returns false in a release build without changing state. */
  setDevEnabled: (on: boolean) => Promise<boolean>;
  devEnabled: boolean;
};

const SyncContext = createContext<SyncValue | null>(null);

const LAST_SYNC_KEY = 'sync_last_at';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { status: authStatus, user } = useAuth();
  const { refresh: refreshVisits } = useVisits();

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
      // Pulled rows are invisible until the store re-reads SQLite.
      if (result.pulled > 0) await refreshVisits();
      await refreshPending();
    } finally {
      inFlight.current = false;
    }
  }, [active, authStatus, user?.id, db, refreshVisits, refreshPending]);

  /** On sign-in. Not on every render, and not on a timer. */
  useEffect(() => {
    if (active && authStatus === 'signed-in') void sync();
  }, [active, authStatus, sync]);

  const value = useMemo<SyncValue>(
    () => ({
      active,
      status,
      pending,
      lastResult,
      lastSyncedAt,
      sync,
      refreshPending,
      devEnabled,
      setDevEnabled: async (on: boolean) => {
        if (!__DEV__) return false;
        await setSetting(db, DEV_KEY, on ? '1' : '0');
        setDevEnabledState(on);
        return on;
      },
    }),
    [active, status, pending, lastResult, lastSyncedAt, sync, refreshPending, devEnabled, db],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
