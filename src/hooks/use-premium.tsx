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
};

const PremiumContext = createContext<PremiumValue | null>(null);

const SIMULATED_KEY = 'premium_simulated';

/**
 * Where the real entitlement will come from.
 *
 * Deliberately a separate function with no React in it, so swapping it for
 * `Purchases.getCustomerInfo()` is a change to this body and nothing else.
 */
async function resolveEntitlement(): Promise<boolean> {
  // TODO(apple): RevenueCat. Needs the Apple Developer Program, three products
  // in App Store Connect and the Paid Apps agreement signed.
  return false;
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [purchased, setPurchased] = useState(false);
  const [simulated, setSimulatedState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
  }, [db]);

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
    }),
    [purchased, simulated, loading, setSimulated],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside <PremiumProvider>');
  return ctx;
}
