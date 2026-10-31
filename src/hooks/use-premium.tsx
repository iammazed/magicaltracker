import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/hooks/use-auth';
import { getSetting, setSetting } from '@/lib/local-db';
import { isEntitled, linkUser, USING_TEST_STORE } from '@/lib/purchases';

/**
 * The premium boundary, in one place.
 *
 * Everything gated reads `isPremium` from here and nothing reads a store SDK
 * directly. When RevenueCat is wired up — which needs the Apple Developer
 * Program, products created in App Store Connect and the Paid Apps agreement
 * signed — only `resolveEntitlement` below changes. Every gate, every paywall
 * trigger and every "Premium" badge stays exactly as written.
 *
 * Until then the entitlement is false for everybody, with a developer override
 * so the gated features can be built and tested. The override is `__DEV__`-only
 * on purpose: shipping a switch that unlocks premium would be the whole
 * business model behind a tap.
 */

/**
 * What the free tier gets. Lifted from the plan, and the one rule that governs
 * it: never paywall data entry. Every rating a free user logs is what makes a
 * Top 10, a trending list and recommendations possible later, so charging for
 * logging would starve the thing that eventually makes premium worth buying.
 */
export const FREE_TRIP_LIMIT = 1;

export type PremiumFeature =
  | 'notes'
  | 'dayNotes'
  | 'dishes'
  | 'photos'
  | 'trips'
  | 'nearby'
  | 'export';

/** Shown on the paywall, and in the sentence that explains why it appeared. */
export const FEATURE_COPY: Record<PremiumFeature, { title: string; blurb: string }> = {
  notes: {
    title: 'Visit notes',
    blurb: 'Write down what the meal was actually like, while you remember it.',
  },
  /**
   * Separate from `notes`, which it shares an implementation with and nothing
   * else. A visit note is written afterwards, about a meal you have eaten; a
   * day note is written beforehand, about a day you are planning. Showing the
   * same "write down what the meal was actually like" copy on a day you have
   * not had yet reads as a bug in the app rather than an upgrade.
   */
  dayNotes: {
    title: 'Day planning',
    blurb: 'Add a note to each day of a trip — rope drop, dinner at 7, an early night.',
  },
  dishes: {
    title: 'Dishes ordered',
    blurb: 'Keep a record of what you ate, so you know what to order again.',
  },
  photos: {
    title: 'Photos',
    blurb: 'Attach your own pictures to a visit.',
  },
  trips: {
    title: 'Unlimited trips',
    blurb: `Plan more than ${FREE_TRIP_LIMIT} trip at a time, including trips years out.`,
  },
  nearby: {
    title: 'Near me',
    blurb: 'Sort the map and the list by how close you are standing right now.',
  },
  export: {
    title: 'Export',
    blurb: 'Download everything you have logged as a spreadsheet.',
  },
};

type PremiumValue = {
  isPremium: boolean;
  loading: boolean;
  /** True when the entitlement comes from the dev override rather than a
   *  purchase, so the UI can say so instead of implying a real subscription. */
  simulated: boolean;
  /** `__DEV__` only. Returns false in a release build without changing state. */
  setSimulated: (on: boolean) => Promise<boolean>;
  /** Re-reads the entitlement. Called after a purchase or a restore, so the
   *  gates open without waiting for the next launch. */
  refresh: () => Promise<void>;
  /** True when purchases are running against RevenueCat's Test Store, so the
   *  UI can say a purchase was simulated rather than implying a real charge. */
  usingTestStore: boolean;
};

const PremiumContext = createContext<PremiumValue | null>(null);

const SIMULATED_KEY = 'premium_simulated';

/**
 * Where the real entitlement comes from.
 *
 * This was a stub returning `false` with a TODO, and keeping it as a separate
 * React-free function with exactly one caller is what made wiring RevenueCat a
 * change to this line rather than to every gate in the app.
 *
 * It returns false whenever RevenueCat cannot be reached, which is the safe
 * direction: a paying customer briefly seeing a lock recovers on the next
 * launch, and handing out premium because a network call failed does not.
 */
const resolveEntitlement = isEntitled;

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [purchased, setPurchased] = useState(false);
  const [simulated, setSimulatedState] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * A primitive, deliberately. Depending on the `user` object would re-run
   * this on every render that produced a new reference, and an effect that
   * re-runs forever is the failure this codebase has already paid for once.
   */
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    setPurchased(await resolveEntitlement());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      /**
       * Link BEFORE reading, or the entitlement read belongs to whoever was
       * signed in a moment ago. `linkUser` also aliases a guest's purchase
       * onto the account they just made, so buying premium and then signing
       * up does not lose the purchase.
       */
      await linkUser(userId);
      const [entitled, override] = await Promise.all([
        resolveEntitlement(),
        __DEV__ ? getSetting(db, SIMULATED_KEY) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setPurchased(entitled);
      setSimulatedState(override === '1');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  const setSimulated = useCallback(
    async (on: boolean) => {
      if (!__DEV__) return false;
      await setSetting(db, SIMULATED_KEY, on ? '1' : '0');
      setSimulatedState(on);
      return on;
    },
    [db],
  );

  const value = useMemo<PremiumValue>(
    () => ({
      isPremium: purchased || (__DEV__ && simulated),
      loading,
      simulated: !purchased && __DEV__ && simulated,
      setSimulated,
      refresh,
      usingTestStore: USING_TEST_STORE,
    }),
    [purchased, simulated, loading, setSimulated, refresh],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside <PremiumProvider>');
  return ctx;
}
