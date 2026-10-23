import * as Sentry from '@sentry/react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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
    if (longest > MAX_EDGE) {
      const context = ImageManipulator.manipulate(asset.uri);
      // Constrain the LONG edge, whichever it is. Passing only one dimension
      // lets the manipulator keep the aspect ratio; passing width on a
      // portrait photo would leave a 1600×2133 image, which is not a cap.
      context.resize(height >= width ? { height: MAX_EDGE } : { width: MAX_EDGE });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        compress: QUALITY,
        format: SaveFormat.JPEG,
      });
      source = saved.uri;
    }

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
