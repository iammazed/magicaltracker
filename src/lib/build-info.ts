import { MONTH_SHORT, pad } from '@/lib/calendar';

/**
 * Which build am I looking at, and can it receive updates?
 *
 * **Why this exists.** For the first week of testing the app said nothing
 * anywhere about which version it was. Three separate "this feature is
 * missing" reports turned out to be the same thing: a tester on an older
 * binary that `runtimeVersion.policy: "fingerprint"` had quietly cut off from
 * every OTA update. Build 4's fingerprint is `ed8385a7…` and build 5's is
 * `d41cd429…`, so a build-4 phone checks in, is told there is nothing for it,
 * and runs the JS it shipped with forever. Nothing in the UI could tell the
 * difference between that and a bug, and neither the tester nor I could
 * answer "which build are you on" — so two correct features looked broken.
 *
 * Everything here is therefore picked to answer ONE question: is the JS on
 * this phone the JS I published?
 *
 * The parts are kept pure and separate from the native reads so they can be
 * checked headlessly — `describeBuild` is the half that is easy to get subtly
 * wrong, and it is the half with no imports.
 */

export type BuildFacts = {
  /** Marketing version, `1.0.0`. */
  version: string;
  /**
   * The TestFlight build number.
   *
   * Read from the EMBEDDED `Info.plist` (`CFBundleVersion`), which is the
   * whole point — it can never change for a given binary, whereas the same
   * field in the manifest travels with an update and would happily report a
   * build number this phone is not running.
   */
  build: string | null;
  /**
   * The fingerprint this binary accepts updates for.
   *
   * Two builds with different values here live in separate worlds: an update
   * published against one is never offered to the other, no matter how long
   * you wait.
   */
  runtime: string | null;
  /** The running update, or null when the embedded bundle is running. */
  updateId: string | null;
  /** When the running update was published. */
  publishedAt: Date | null;
  /** True when no update has been applied and the shipped JS is running. */
  embedded: boolean;
};

/** `Nov 1, 2026 at 9:12pm`. Matches how `calendar.ts` spells dates by hand. */
function stamp(d: Date): string {
  const h = d.getHours();
  const hour = h % 12 || 12;
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hour}:${pad(d.getMinutes())}${h < 12 ? 'am' : 'pm'}`;
}

/** First 7, like a short git hash — enough to compare, short enough to read. */
function short(id: string | null): string {
  return id ? id.replace(/-/g, '').slice(0, 7) : 'unknown';
}

/**
 * The build, as lines to show a tester.
 *
 * Returned as separate lines rather than one string so the caller decides the
 * spacing, and ordered most to least human: the build number is what someone
 * reads out, the hashes are what get pasted into a bug report.
 */
export function describeBuild(f: BuildFacts): string[] {
  const first = f.build
    ? `MagicalTracker ${f.version} (build ${f.build})`
    : `MagicalTracker ${f.version}`;

  // "Running the JS it shipped with" is not the same claim as "out of date",
  // and saying the stronger thing would be wrong for a phone that simply has
  // the newest build before anything was published against it.
  const second = f.embedded
    ? 'Running the JS this build shipped with — no update applied.'
    : f.publishedAt
      ? `Running the update published ${stamp(f.publishedAt)}.`
      : 'Running a downloaded update.';

  return [first, second, `Runtime ${short(f.runtime)} · update ${short(f.updateId)}`];
}
