import * as Sentry from '@sentry/react-native';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Photos attached to a visit, on disk.
 *
 * Two things happen on import, and the second matters more than it looks.
 *
 * **Resize.** The picker was handing back whatever the camera produced — a
 * 12MP iPhone photo at `quality: 0.7` is 1–2 MB, and a visit can hold six.
 * Capped at 1600px on the long edge that becomes roughly 200–400 KB, which is
 * the difference between Supabase Storage being affordable later and not. It
 * is still far more resolution than a thumbnail or a full-screen view needs.
 *
 * **Move out of the cache.** `expo-image-picker` returns a URI inside the
 * CACHE directory, and so does the manipulator. iOS reclaims that directory
 * whenever it feels like it, which means photos could already vanish from a
 * saved visit without the app being deleted or anything going wrong — the
 * record would keep a URI pointing at nothing. Imported photos now live in
 * the document directory, which is backed up and never reclaimed.
 */

/** Long edge, in points. */
const MAX_EDGE = 1600;
/** JPEG quality for the re-encode. */
const QUALITY = 0.7;
const DIR_NAME = 'visit-photos';

/**
 * The resizer is loaded at the point of use, never at import. That is a
 * launch-crash fix, not a performance one.
 *
 * `expo-image-manipulator` calls `requireNativeModule('ExpoImageManipulator')`
 * while its own module body evaluates, and that THROWS when the native module
 * is not in the binary — a development build made before this package was
 * added, or a prebuild that lost it. Expo's Metro config sets
 * `experimentalImportSupport: true` with `inlineRequires: false`, so a static
 * `import` is hoisted and runs on module load rather than on first use.
 *
 * This file is reachable from `use-visits`, which the root layout mounts, so
 * an eager import turns a missing resizer into a white screen before React
 * renders — and it happens outside every try/catch below, so none of the
 * fallbacks here would run. Same judgement as the missing Sentry DSN: losing
 * photo resizing is a bad day, and an app that will not launch is a one-star
 * review.
 *
 * `false` records a load that already failed, so a binary without the module
 * reports once instead of on every photo.
 */
type Manipulator = typeof import('expo-image-manipulator');
let manipulator: Manipulator | false | null = null;

async function loadManipulator(): Promise<Manipulator | false> {
  if (manipulator !== null) return manipulator;
  try {
    manipulator = await import('expo-image-manipulator');
  } catch (e) {
    Sentry.captureException(e);
    manipulator = false;
  }
  return manipulator;
}

function photosDirectory(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function filename(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}.jpg`;
}

export type PickedPhoto = {
  uri: string;
  width?: number | null;
  height?: number | null;
};

/**
 * Resizes if needed, then moves the file somewhere permanent.
 *
 * Returns the new `file://` URI, or the original on failure. Falling back to
 * the unprocessed picker URI is deliberate: a photo that is larger than we
 * wanted, or sitting somewhere iOS may reclaim, is still better than silently
 * dropping a picture someone chose to attach.
 */
export async function importPhoto(asset: PickedPhoto): Promise<string> {
  try {
    let source = asset.uri;

    const width = asset.width ?? 0;
    const height = asset.height ?? 0;
    const longest = Math.max(width, height);

    // Re-encoding an already-small photo costs quality and gains nothing.
    const mod = longest > MAX_EDGE ? await loadManipulator() : false;
    if (mod) {
      const context = mod.ImageManipulator.manipulate(asset.uri);
      // Constrain the LONG edge, whichever it is. Passing only one dimension
      // lets the manipulator keep the aspect ratio; passing width on a
      // portrait photo would leave a 1600×2133 image, which is not a cap.
      context.resize(height >= width ? { height: MAX_EDGE } : { width: MAX_EDGE });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        compress: QUALITY,
        format: mod.SaveFormat.JPEG,
      });
      source = saved.uri;
    }
    // No resizer is a reason to keep the photo at its original size, not to
    // drop it — so the move below still runs, which is the half of this
    // function that prevents actual data loss.

    const destination = new File(photosDirectory(), filename());
    await new File(source).move(destination);
    return destination.uri;
  } catch (e) {
    Sentry.captureException(e);
    return asset.uri;
  }
}

/**
 * Deletes every file in the photo directory that no visit refers to.
 *
 * Reconciliation rather than deleting on removal, because the two are not the
 * same: taking a photo off a visit and then cancelling the sheet must leave
 * the original visit — and its photo — untouched. Deleting eagerly on the tap
 * would break exactly that case, and only that case, which is the kind of bug
 * nobody finds until a user loses something.
 *
 * Safe to call at any time; it only removes what nothing points at.
 */
export function pruneOrphanPhotos(referenced: Iterable<string>): number {
  try {
    const dir = new Directory(Paths.document, DIR_NAME);
    if (!dir.exists) return 0;

    const keep = new Set<string>();
    for (const uri of referenced) keep.add(uri);

    let removed = 0;
    for (const entry of dir.list()) {
      if (entry instanceof Directory) continue;
      if (!keep.has(entry.uri)) {
        entry.delete();
        removed += 1;
      }
    }
    return removed;
  } catch (e) {
    Sentry.captureException(e);
    return 0;
  }
}
