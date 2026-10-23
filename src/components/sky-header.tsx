import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

/**
 * Two thresholds, not one, so the header cannot flicker.
 *
 * With a single boundary, a list resting at exactly that offset toggles on
 * every pixel of movement. Collapsing at 60 and only re-expanding below 20
 * means the gap has to be crossed deliberately.
 */
const COLLAPSE_AT = 60;
const EXPAND_AT = 20;

/**
 * Drives the header collapse from a list's scroll position.
 *
 * Lives here rather than in each screen because Dining and Resorts need
 * identical behaviour, and the last control these screens shared — the
 * List/Map toggle — was unreadable on one of them for a while precisely
 * because there were two copies.
 *
 * **No Reanimated here, and that is the result of two failed attempts.** A
 * shared value driving `useAnimatedStyle` is the idiomatic way to do this and
 * it did nothing on device — twice, with no error, no warning and nothing
 * wrong on inspection. Rather than guess at a third variation, this uses
 * plain React state and React Native's own `Animated`, which cannot fail
 * silently: if the state flips, the view re-renders.
 *
 * It is also cheaper than it looks. The state is a BOOLEAN, not an offset, so
 * `setCollapsed` bails out on every scroll event that does not cross a
 * threshold — two re-renders per scroll session rather than one per frame.
 * A per-frame interpolation would have needed the UI thread; a binary flip
 * does not.
 *
 * `reset` is for when the list unmounts, such as switching to the map, which
 * would otherwise leave the header collapsed over a full-height map.
 */
export function useHeaderCollapse() {
  const [collapsed, setCollapsed] = useState(false);

  /** TEMPORARY. Three implementations of this collapse behaved identically on
   *  device, which points at `onScroll` never firing rather than at anything
   *  downstream of it. Counts events so one reload can say so. Remove once
   *  the cause is known. */
  const [debug, setDebug] = useState('no scroll events yet');
  const count = useRef(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    count.current += 1;
    if (__DEV__) setDebug(`y=${Math.round(y)} events=${count.current}`);
    setCollapsed((prev) => {
      if (!prev && y > COLLAPSE_AT) return true;
      if (prev && y < EXPAND_AT) return false;
      return prev;
    });
  }, []);

  const reset = useCallback(() => setCollapsed(false), []);

  return { collapsed, onScroll, reset, debug };
}

/**
 * The twilight band at the top of a list screen.
 *
 * Dining and Resorts were a big black-on-grey title over a grey search field,
 * which is a settings screen. This gives both the same surface the home
 * planner and the countdown use, so the app reads as one thing.
 *
 * The gradient bleeds to the top edge: the safe-area inset is applied INSIDE
 * it rather than above it, so the colour runs under the status bar instead of
 * stopping in a line beneath it. Only the bottom corners are rounded, because
 * the top ones would be cut off by the screen edge anyway.
 *
 * **Everything in here is a colour literal**, per the SkyCard rule — the
 * gradient is dark in both themes, so theme text tokens invert underneath it
 * and vanish in light mode.
 */
export function SkyHeader({
  eyebrow,
  title,
  progress,
  action,
  collapsed = false,
  debug,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** A slim coverage bar. The question "how much of this have I done?" is the
   *  one both these screens exist to answer. */
  progress?: { done: number; total: number; label: string };
  /** A top-right escape. The tab screens are under `headerShown: false`, so a
   *  screen in a temporary mode — adding dining to a trip — has no navigation
   *  bar and no back button, and its only way out was a footer that turned
   *  out to be behind the tab bar. Two exits, not one. */
  action?: { label: string; onPress: () => void };
  /** From `useHeaderCollapse()`. Omit it and the header never collapses. */
  collapsed?: boolean;
  /** TEMPORARY diagnostic from `useHeaderCollapse()`. Dev builds only. */
  debug?: string;
  children?: React.ReactNode;
}) {
  const pct =
    progress && progress.total > 0
      ? Math.min(1, progress.done / progress.total)
      : 0;

  /**
   * Measured ONCE, from an inner view the animation does not touch.
   *
   * Measuring the animated view itself would feed its own output back in:
   * the height shrinks, `onLayout` fires with the smaller value, that becomes
   * the new natural height, and the block walks itself to zero. The inner
   * view keeps its natural height and is clipped by the parent instead.
   */
  const [blockHeight, setBlockHeight] = useState(0);
  const measure = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && blockHeight === 0) setBlockHeight(h);
    },
    [blockHeight],
  );

  /**
   * 1 is open, 0 is collapsed. `useNativeDriver` is false because height and
   * margin are layout properties, which the native driver cannot touch — at
   * 180ms on a single view that is not worth caring about.
   */
  const open = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(open, {
      toValue: collapsed ? 0 : 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [collapsed, open]);

  const collapsing = {
    height: open.interpolate({ inputRange: [0, 1], outputRange: [0, blockHeight] }),
    opacity: open,
    // `inner` lays its children out with `gap`, which survives a child
    // collapsing to zero height — so without this the band keeps a stripe of
    // empty space exactly where the title used to be.
    marginBottom: open.interpolate({
      inputRange: [0, 1],
      outputRange: [-Spacing.three, 0],
    }),
  };

  return (
    <SkyCard radius={0} style={styles.card}>
      <Stars />
      <SafeAreaView edges={['top']}>
        <View style={styles.inner}>
          {/* The identity block: who you are and how far through you are.
              Both are orientation, not controls — so this is what gives way
              on scroll, while the search field and the List/Map toggle below
              stay put. Collapsing those would mean scrolling back up to
              change a filter.

              Rendered plainly until it has been measured, then swapped for
              the animated copy. That ordering is what makes the animation
              work at all: Reanimated fixes an animated style's property set
              from the worklet's FIRST run, so mounting it before the height
              was known registered an empty style that later values could not
              fill in. */}
          {blockHeight === 0 ? (
            <View onLayout={measure} style={styles.collapsibleInner}>
          <View style={styles.headingRow}>
            <View style={styles.heading}>
              {eyebrow ? <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText> : null}
              <ThemedText style={styles.title} numberOfLines={1}>
                {title}
              </ThemedText>
            </View>
            {action ? (
              <Pressable
                onPress={action.onPress}
                accessibilityRole="button"
                hitSlop={10}
                style={styles.action}
              >
                <ThemedText style={styles.actionText}>{action.label}</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {progress ? (
            <View style={styles.progress}>
              <View style={styles.track}>
                {/* Width as a percentage string, so it needs no layout
                    measurement and cannot be wrong on first paint. A floor of
                    2% keeps a single visit visible instead of rounding to
                    nothing. */}
                <View
                  style={[
                    styles.fill,
                    { width: `${pct > 0 ? Math.max(pct * 100, 2) : 0}%` },
                  ]}
                />
              </View>
              <ThemedText style={styles.progressLabel}>
                {progress.done} of {progress.total} {progress.label}
              </ThemedText>
            </View>
          ) : null}
            </View>
          ) : (
            <Animated.View style={[styles.collapsible, collapsing]}>
              <View style={styles.collapsibleInner}>
          <View style={styles.headingRow}>
            <View style={styles.heading}>
              {eyebrow ? <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText> : null}
              <ThemedText style={styles.title} numberOfLines={1}>
                {title}
              </ThemedText>
            </View>
            {action ? (
              <Pressable
                onPress={action.onPress}
                accessibilityRole="button"
                hitSlop={10}
                style={styles.action}
              >
                <ThemedText style={styles.actionText}>{action.label}</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {progress ? (
            <View style={styles.progress}>
              <View style={styles.track}>
                {/* Width as a percentage string, so it needs no layout
                    measurement and cannot be wrong on first paint. A floor of
                    2% keeps a single visit visible instead of rounding to
                    nothing. */}
                <View
                  style={[
                    styles.fill,
                    { width: `${pct > 0 ? Math.max(pct * 100, 2) : 0}%` },
                  ]}
                />
              </View>
              <ThemedText style={styles.progressLabel}>
                {progress.done} of {progress.total} {progress.label}
              </ThemedText>
            </View>
          ) : null}
              </View>
            </Animated.View>
          )}

          {children}

          {/* TEMPORARY. Remove with the `debug` plumbing once the
              collapse is understood. */}
          {__DEV__ && debug ? (
            <ThemedText style={styles.debug}>
              {debug} · measured={Math.round(blockHeight)} · collapsed={String(collapsed)}
            </ThemedText>
          ) : null}
        </View>
      </SafeAreaView>
    </SkyCard>
  );
}

/**
 * The List/Map toggle, for use inside a SkyHeader.
 *
 * Shared because Dining and Resorts need the identical control, and the first
 * version of this on Dining was styled so faintly — a transparent track and a
 * selected fill a few percent of lightness from the background — that it did
 * not read as a toggle at all. Gold on translucent white is unmistakable, and
 * having one copy means that mistake cannot come back on only one screen.
 */
export function SkySegment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label} view`}
            style={[styles.segmentItem, active ? styles.segmentItemOn : null]}
          >
            <ThemedText
              style={[
                styles.segmentText,
                {
                  color: active ? '#23133A' : 'rgba(255,255,255,0.75)',
                  fontWeight: active ? '700' : '600',
                },
              ]}
            >
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The translucent field style, so the search input matches on both screens.
 *
 * Carries no `flex`. It had `flex: 1`, which is right inside a row — Dining
 * pairs the field with a Filters button — and wrong as a direct child of the
 * header's column, where it stretches to fill the height instead of staying
 * 48pt. Sizing is the layout's business; add `flex: 1` at the call site that
 * needs it.
 */
export const skyInput = {
  paddingHorizontal: Spacing.three,
  height: 48,
  borderRadius: Radius.medium,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.26)',
  backgroundColor: 'rgba(255,255,255,0.10)',
  color: '#ffffff',
  fontSize: 16,
} as const;

export const SKY_PLACEHOLDER = 'rgba(255,255,255,0.45)';

const styles = StyleSheet.create({
  card: {
    borderBottomLeftRadius: Radius.large + 8,
    borderBottomRightRadius: Radius.large + 8,
  },
  inner: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  /** `overflow: hidden` is what lets the inner view keep its natural height
   *  and simply be clipped, which is what makes measuring it safe. */
  collapsible: { overflow: 'hidden' },
  debug: { color: '#E5B45F', fontSize: 11, fontVariant: ['tabular-nums'] },
  collapsibleInner: { gap: Spacing.three },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  heading: { gap: 2, flexShrink: 1 },
  action: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  eyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: { color: '#ffffff', fontSize: 30, lineHeight: 35, fontWeight: '700' },
  progress: { gap: Spacing.two },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#E5B45F' },
  progressLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 14 },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  segmentItem: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one + 3,
    borderRadius: Radius.pill,
  },
  segmentItemOn: { backgroundColor: '#E5B45F' },
  segmentText: { fontSize: 14 },
});
