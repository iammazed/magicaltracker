import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
} from 'react-native-purchases';

/**
 * RevenueCat, behind a small surface.
 *
 * Nothing outside this file imports `react-native-purchases`, for the same
 * reason nothing but `use-catalog` imports `supabase`: the store SDK is a
 * dependency the rest of the app should be able to forget about. `use-premium`
 * asks "is this person entitled", the paywall asks "what can they buy", and
 * neither needs to know who answers.
 */

/** Must match the entitlement identifier in RevenueCat exactly. */
export const ENTITLEMENT_ID = 'premium';

/**
 * TWO separate variable names rather than one variable holding different
 * values per environment, and that is a safety decision, not a style one.
 *
 * A Test Store key in a release build does not degrade — **the SDK shows an
 * alert and crashes the app.** With a single variable, one wrong value in the
 * EAS production environment ships a guaranteed crash on launch to everybody,
 * and nothing in the build output would say so. With two names, a release
 * build never reads the test key at all, because the line below cannot select
 * it. The misconfiguration stops being possible rather than being caught.
 */
const TEST_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY_TEST;
const APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY_APPLE;

function resolveKey(): string | null {
  // Android ships later and needs its own `goog_` key; until then there is no
  // entitlement to resolve there rather than a wrong one.
  if (Platform.OS !== 'ios') return null;

  // Dev prefers the Test Store, falling back to the real key so a sandbox run
  // is still possible. Release reads APPLE_KEY and nothing else, ever.
  const key = __DEV__ ? TEST_KEY || APPLE_KEY : APPLE_KEY;
  if (!key) return null;

  /**
   * The one hole the two-variable split leaves: somebody pasting a `test_`
   * key into the Apple variable. Refusing beats crashing — premium being
   * unavailable is a bad day, and a launch crash is a one-star review and an
   * expedited release.
   */
  if (!__DEV__ && key.startsWith('test_')) {
    Sentry.captureException(
      new Error('RevenueCat: a Test Store key reached a release build; refusing to configure'),
    );
    return null;
  }
  return key;
}

let configured: boolean | null = null;

/**
 * Configures the SDK once, and reports whether purchases are usable at all.
 *
 * Returns false rather than throwing. Every caller treats "cannot reach
 * RevenueCat" as "not entitled", which is the safe direction: a free user
 * briefly seeing a locked feature is recoverable, and accidentally handing out
 * premium because a network call failed is not.
 */
export function configurePurchases(): boolean {
  if (configured !== null) return configured;

  // Expo Go cannot load the native module. Worth checking explicitly so the
  // failure reads as "not available here" instead of an SDK stack trace on
  // every launch of the Expo Go build.
  if (isRunningInExpoGo()) {
    configured = false;
    return false;
  }

  const apiKey = resolveKey();
  if (!apiKey) {
    configured = false;
    return false;
  }

  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    configured = true;
  } catch (e) {
    Sentry.captureException(e);
    configured = false;
  }
  return configured;
}

/** True when this device is configured against the Test Store. Shown in the
 *  UI so a simulated purchase is never mistaken for a real one. */
export const USING_TEST_STORE =
  __DEV__ && Boolean(TEST_KEY) && Platform.OS === 'ios';

/** Whether the signed-in person currently holds the premium entitlement. */
export async function isEntitled(): Promise<boolean> {
  if (!configurePurchases()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (e) {
    Sentry.captureException(e);
    return false;
  }
}

/**
 * The packages in the **current** offering.
 *
 * `offerings.current` is whichever offering is marked Default in the
 * dashboard, deliberately rather than looking up an identifier in code. It
 * means pricing, packaging and experiments change from the dashboard without
 * an App Store release, which is most of the point of using RevenueCat.
 */
export async function fetchPackages(): Promise<PurchasesPackage[]> {
  if (!configurePurchases()) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (e) {
    Sentry.captureException(e);
    return [];
  }
}

export type PurchaseOutcome =
  | { ok: true; entitled: boolean }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

/** Buys a package. A user cancelling is a normal outcome, not an error. */
export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!configurePurchases()) {
    return { ok: false, cancelled: false, message: 'Purchases are not available on this device.' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, entitled: customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined };
  } catch (e) {
    // Backing out of the Apple sheet raises, and reporting that as a failure
    // would be both wrong and alarming.
    if (typeof e === 'object' && e !== null && 'userCancelled' in e && e.userCancelled) {
      return { ok: false, cancelled: true };
    }
    Sentry.captureException(e);
    return {
      ok: false,
      cancelled: false,
      message: e instanceof Error ? e.message : 'The purchase could not be completed.',
    };
  }
}

/** Restores previous purchases. Required by App Store review. */
export async function restore(): Promise<PurchaseOutcome> {
  if (!configurePurchases()) {
    return { ok: false, cancelled: false, message: 'Purchases are not available on this device.' };
  }
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, entitled: info.entitlements.active[ENTITLEMENT_ID] !== undefined };
  } catch (e) {
    Sentry.captureException(e);
    return {
      ok: false,
      cancelled: false,
      message: e instanceof Error ? e.message : 'Could not restore purchases.',
    };
  }
}

/**
 * Ties purchases to the account, so a subscription follows the person rather
 * than the handset.
 *
 * Without this a guest's purchase lives under an anonymous RevenueCat id, and
 * signing in on a second phone finds nothing — the subscription they paid for
 * appears to have vanished. `logIn` aliases the anonymous id onto the real
 * one, so a purchase made before signing up survives signing up.
 */
export async function linkUser(userId: string | null): Promise<void> {
  if (!configurePurchases()) return;
  try {
    if (userId) {
      await Purchases.logIn(userId);
      return;
    }
    // `logOut` throws when the current user is already anonymous, which is the
    // normal state on a guest launch. Calling it blind would report an error
    // to Sentry on most app starts and bury the real ones.
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch (e) {
    Sentry.captureException(e);
  }
}
