import * as Sharing from 'expo-sharing';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Rasterises a mounted view and hands the PNG to the share sheet.
 *
 * ## The view must be on screen
 *
 * `captureRef` snapshots what the render server actually drew, so the usual
 * trick of parking the card off-screen at `left: -9999` produces a blank or
 * failed capture on iOS depending on how aggressively the view was culled.
 * That is why the share card has its own screen showing the card at full size
 * instead of capturing invisibly from Stats: the preview is not decoration,
 * it is what makes the capture reliable. It also means nobody posts an image
 * of their own data without having seen it first.
 *
 * ## tmpfile, not base64
 *
 * `result: 'tmpfile'` keeps the image out of the JS heap. A square card at 3x
 * is a megabyte or so of PNG, and base64 would move all of it through a
 * string before handing it straight back to the OS.
 */
export async function shareViewAsPng(
  ref: React.RefObject<View | null>,
  dialogTitle: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const raw = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  // iOS returns a bare path here, Android a `file://` URL, and `shareAsync`
  // rejects the bare path. Normalising is cheaper than branching on platform.
  const uri = raw.startsWith('file://') ? raw : `file://${raw}`;

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle,
  });
}
