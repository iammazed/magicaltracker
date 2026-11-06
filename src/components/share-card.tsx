import { StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Radius } from '@/constants/theme';
import type { ShareStat } from '@/lib/share-stats';

/**
 * The thing people post, which is the only acquisition channel that does not
 * cost money.
 *
 * Deliberately square. A 1:1 image survives an Instagram feed post, a story
 * with padding, a text message and a Facebook post without being cropped by
 * any of them, and the alternative is picking one platform to look right on.
 *
 * Everything is sized off `width` rather than fixed, because this renders at
 * screen width in the preview and is captured at device pixel ratio — so the
 * same component is both the thing you look at and the thing that gets
 * rasterised, and there is no second set of numbers to keep in step.
 *
 * ## Why no theme tokens
 *
 * The card is the sky gradient, which is dark in both schemes. Theme text
 * tokens inverting to near-black in light mode is exactly the bug that makes
 * a shared image unreadable for half the people who share it, so every colour
 * here is a literal, matching `SkyCard`'s contract.
 *
 * ## What is on it is the sharer's choice
 *
 * The footer takes whatever stats it is handed, nought to three of them, and
 * the picking happens on the share screen. That is not a preferences feature:
 * the card is someone's own travel held up for other people to look at, and
 * which number they are proud of is not a thing this component can know.
 * Someone on their first trip has 11 places and 9 months of the year; the
 * second is the better number and only they can say so.
 */
export function ShareCard({
  width,
  pct,
  stats,
}: {
  width: number;
  /** 0–1, the overall coverage the ring draws. */
  pct: number;
  /** Nought to three. More than three does not fit and is sliced. */
  stats: ShareStat[];
}) {
  const pad = Math.round(width * 0.075);
  const ring = Math.round(width * 0.42);

  // Sliced rather than trusted. The caller enforces three, and a fourth
  // arriving here would silently squeeze the row to the point of wrapping.
  const shown = stats.slice(0, 3);

  const pctSize = Math.round(ring * 0.3);
  const signSize = Math.round(ring * 0.15);

  return (
    <SkyCard
      style={{ width, height: width, padding: pad, justifyContent: 'space-between' }}
      radius={Radius.large}
    >
      <Stars />

      <View style={styles.head}>
        <Wordmark size="md" scriptColor="#E5B45F" restColor="#ffffff" />
        <ThemedText style={styles.eyebrow}>WALT DISNEY WORLD</ThemedText>
      </View>

      <View style={styles.middle}>
        <ProgressRing
          size={ring}
          pct={pct}
          color="#E5B45F"
          trackColor="rgba(255,255,255,0.16)"
        >
          {/*
            `lineHeight` is REQUIRED here, not decoration.

            `ThemedText` defaults to the `default` type, which sets
            `lineHeight: 24` — and a style object further down the cascade that
            sets only `fontSize` leaves that 24 in place. So a ~48pt numeral
            was being drawn into a 24pt line box and got cropped top and
            bottom, which read as a block sitting over the middle of the ring.
            Nothing was overlapping it; the text box was simply half the height
            of the text.

            Composed as an array rather than spread: a StyleSheet entry is not
            guaranteed to be a plain object, and `{...styles.pct}` is the kind
            of thing that works until it quietly does not.
          */}
          <ThemedText
            style={[styles.pct, { fontSize: pctSize, lineHeight: Math.round(pctSize * 1.12) }]}
          >
            {Math.round(pct * 100)}
            <ThemedText
              style={[
                styles.pctSign,
                { fontSize: signSize, lineHeight: Math.round(signSize * 1.12) },
              ]}
            >
              %
            </ThemedText>
          </ThemedText>
        </ProgressRing>
        <ThemedText style={styles.caption}>of Walt Disney World eaten</ThemedText>
      </View>

      {/* No stats picked is a legitimate card — the ring alone is the cleanest
          version of this image, and an empty bordered strip under it would be
          worse than nothing. */}
      {shown.length ? (
        <View style={styles.foot}>
          {shown.map((st) => (
            <Stat key={st.id} value={st.value} label={st.label} />
          ))}
        </View>
      ) : null}
    </SkyCard>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4 },
  eyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  middle: { alignItems: 'center', gap: 10 },
  pct: { color: '#E5B45F', fontWeight: '700' },
  pctSign: { color: '#E5B45F', fontWeight: '700' },
  caption: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  foot: {
    flexDirection: 'row',
    // `space-around` on purpose rather than `space-between`: with one stat
    // picked, `space-between` pins it to the left edge of the card and the
    // whole footer looks like a layout that failed. Around centres it.
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingTop: 12,
  },
  stat: { alignItems: 'center', gap: 2 },
  /**
   * No `lineHeight` on either of these, and that is correct rather than an
   * oversight of the same kind as the percentage above. Both are SMALLER than
   * the inherited 24, so the line box is roomy rather than cropped — and the
   * footer's spacing is already right. The rule is only that a font size
   * above the inherited line height must set its own.
   */
  statValue: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
