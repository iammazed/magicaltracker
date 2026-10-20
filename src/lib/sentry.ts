import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

/**
 * Crash reporting.
 *
 * Imported for its side effect as the FIRST import in `src/app/_layout.tsx`,
 * so the SDK is running before any provider mounts. An error thrown while
 * `SQLiteProvider` is migrating is exactly the kind this exists to catch, and
 * initialising inside a component would be too late to see it.
 *
 * `process.env.EXPO_PUBLIC_*` must be written as static dot notation — Metro
 * substitutes these by matching the literal text, so a computed lookup yields
 * undefined. Same rule as `supabase.ts`.
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Expo Go cannot load the native Sentry module, because the module is added by
 * a config plugin at prebuild and Expo Go ships a fixed binary. The JS layer
 * still reports JS errors over HTTP, so this is worth initialising there — but
 * anything that reads native frames has to be switched off or it logs warnings
 * on every launch about a module that was never going to be present.
 */
const inExpoGo = isRunningInExpoGo();

/** False when no DSN is configured, which means nothing is being reported. */
export const SENTRY_ENABLED = Boolean(dsn);

if (!dsn) {
  /**
   * Deliberately NOT a throw, which is where this differs from `supabase.ts`.
   *
   * A missing Supabase key means the app cannot work, so failing loudly is
   * correct. A missing Sentry DSN means only that crashes go unrecorded —
   * taking the app down over it would make the crash reporter the single
   * largest source of crashes, which is absurd.
   *
   * The real risk is the opposite one, and it is the `exit 0` lesson from the
   * heartbeat workflow: silence here reads exactly like "no crashes." If the
   * var is missing from an EAS environment, a production build ships with
   * reporting off and nothing anywhere says so. Hence the warning, and hence
   * `SENTRY_ENABLED` being exported so Settings can show the truth.
   */
  if (__DEV__) {
    console.warn(
      '[sentry] EXPO_PUBLIC_SENTRY_DSN is not set — crash reporting is OFF. ' +
        'Add it to .env for local runs, and `eas env:set` it for every build ' +
        'environment, or release builds will report nothing.',
    );
  }
} else {
  Sentry.init({
    dsn,

    /**
     * Keeps TestFlight noise out of the production issue stream.
     *
     * Set per EAS profile with `eas env:set --name EXPO_PUBLIC_SENTRY_ENV`.
     * Without it a beta build and a shipped build file into the same bucket,
     * and a bug 20 testers hit looks identical to one every user hits.
     */
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENV ?? (__DEV__ ? 'development' : 'production'),

    /**
     * Off, and this is a privacy decision rather than a default left alone.
     *
     * Sentry's own example sets this to `true`, which attaches the user's IP
     * address and request headers to every event. That would make IP address a
     * collected identifier — something the App Store Privacy Nutrition Label
     * has to declare and the privacy policy has to describe. A stack trace is
     * what is actually needed to fix a crash in a trip log; who was holding
     * the phone is not.
     */
    sendDefaultPii: false,

    /**
     * 10% in production.
     *
     * Performance spans are billed separately from errors and burn a free-tier
     * quota far faster, while telling you much less than a crash does at this
     * stage. 10% is enough to notice a screen that got slow. Raise it when
     * there is a reason to look.
     */
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,

    enableNativeFramesTracking: !inExpoGo,

    integrations: [
      /**
       * Attaches the route to every event, so a crash report says "this
       * happened on the Passport" instead of leaving you to guess. It reads
       * expo-router's navigation ref itself — the older `reactNavigationIntegration`
       * needed a `useNavigationContainerRef()` wired through by hand.
       */
      Sentry.expoRouterIntegration({
        enableTimeToInitialDisplay: !inExpoGo,
      }),
    ],
  });
}
