import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

/**
 * The photos on a logged visit: a row of thumbnails, and the full-screen
 * view they open.
 *
 * The thumbnails were a bare `<Image>` with nothing to tap. A picture at
 * 72pt is a reminder that a photo exists rather than something you can look
 * at, so tapping one and getting nothing reads as a broken control rather
 * than as a deliberate omission — which is exactly how it was reported.
 *
 * **Everything in the viewer is a colour literal**, the same exception the
 * SkyCard gradient gets and for the same reason: the backdrop is black in
 * both schemes, so theme tokens would invert underneath it and the Done
 * button would disappear in light mode.
 */

/** Big enough to recognise the meal, small enough that six of them stay a
 *  strip rather than becoming the visit. */
const THUMB = 72;

export function PhotoStrip({ uris }: { uris: string[] }) {
  const [index, setIndex] = useState<number | null>(null);
  if (!uris.length) return null;

  return (
    <View style={styles.strip}>
      {uris.map((uri, i) => (
        <Pressable
          key={uri}
          onPress={() => setIndex(i)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Photo ${i + 1} of ${uris.length}. Opens full screen.`}
          style={({ pressed }) => (pressed ? styles.thumbPressed : null)}
        >
          <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
        </Pressable>
      ))}

      <PhotoViewer
        uris={uris}
        index={index}
        onIndex={setIndex}
        onClose={() => setIndex(null)}
      />
    </View>
  );
}

function PhotoViewer({
  uris,
  index,
  onIndex,
  onClose,
}: {
  uris: string[];
  /** Null when closed. */
  index: number | null;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  /**
   * Keyed by URI rather than held as one value, so paging to the next photo
   * cannot show the previous one's dimensions for a frame. Only the dev
   * readout uses it, but a readout that is briefly wrong is worse than none
   * — it is there to be trusted.
   */
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});

  const open = index !== null;
  const uri = open ? uris[index] : null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      {/* Tapping the photo or the space around it closes, which is what every
          other transient surface in the app does. */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close photo"
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.full}
            contentFit="contain"
            onLoad={(e) =>
              setDims((d) => ({
                ...d,
                [uri]: { w: e.source.width, h: e.source.height },
              }))
            }
          />
        ) : null}
      </Pressable>

      {/* `box-none` so the backdrop underneath still receives taps everywhere
          these controls are not. */}
      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.chromeTop} pointerEvents="box-none">
          {uris.length > 1 && index !== null ? (
            <ThemedText style={styles.counter}>
              {index + 1} of {uris.length}
            </ThemedText>
          ) : (
            <View />
          )}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.done}
          >
            <ThemedText style={styles.doneText}>Done</ThemedText>
          </Pressable>
        </View>

        <View style={styles.chromeBottom} pointerEvents="box-none">
          {uri ? <DevFileFacts uri={uri} dims={dims[uri]} /> : null}

          {uris.length > 1 && index !== null ? (
            <View style={styles.pager}>
              <PagerButton
                direction="back"
                disabled={index === 0}
                onPress={() => onIndex(index - 1)}
              />
              <PagerButton
                direction="forward"
                disabled={index === uris.length - 1}
                onPress={() => onIndex(index + 1)}
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function PagerButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onPress: () => void;
}) {
  const back = direction === 'back';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={back ? 'Previous photo' : 'Next photo'}
      accessibilityState={{ disabled }}
      style={[styles.pagerButton, disabled ? styles.pagerDisabled : null]}
    >
      <SymbolView
        name={
          back
            ? { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }
            : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }
        }
        size={16}
        weight="semibold"
        tintColor="#ffffff"
      />
    </Pressable>
  );
}

/**
 * Pixel dimensions and file size, in development builds only.
 *
 * Whether `importPhoto` actually resized anything is otherwise invisible: a
 * 4032x3024 original and a 1600x1200 re-encode look identical in a thumbnail
 * AND in a full-screen view, so the only honest way to check is to read the
 * numbers off the stored file. The alternative is trusting that the native
 * module was present in the binary, which is the thing being checked.
 *
 * The filename sits above the numbers, and it is not decoration. Two
 * different photos that resize to the same dimensions and land in the same
 * rounded kilobyte are hard to tell apart from one photo being reported
 * twice, and that is a question worth being able to answer by looking. It is
 * also the key the sync design leans on: one basename, with the local file
 * and the remote object both derived from it.
 *
 * `File.size` is a synchronous native read. That is fine behind `__DEV__` and
 * would not be on a release render path.
 */
function DevFileFacts({
  uri,
  dims,
}: {
  uri: string;
  dims?: { w: number; h: number };
}) {
  if (!__DEV__) return null;

  let bytes = 0;
  try {
    bytes = new File(uri).size;
  } catch {
    bytes = 0;
  }

  const parts = [
    dims ? `${dims.w} × ${dims.h}` : null,
    bytes > 0 ? formatBytes(bytes) : null,
  ].filter(Boolean);
  if (!parts.length) return null;

  return (
    <View style={styles.factsBlock}>
      <ThemedText style={styles.factsName} numberOfLines={1}>
        {uri.split('/').pop()}
      </ThemedText>
      <ThemedText style={styles.facts}>{parts.join('  ·  ')}</ThemedText>
    </View>
  );
}

function formatBytes(n: number): string {
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radius.small },
  thumbPressed: { opacity: 0.7 },

  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { width: '100%', height: '100%' },

  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  chromeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  chromeBottom: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  counter: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  done: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  doneText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  pager: { flexDirection: 'row', gap: Spacing.three },
  pagerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pagerDisabled: { opacity: 0.3 },
  factsBlock: { alignItems: 'center', gap: 1 },
  factsName: { color: 'rgba(255,255,255,0.38)', fontSize: 10 },
  facts: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
