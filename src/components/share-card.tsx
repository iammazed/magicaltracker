import { StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Radius } from '@/constants/theme';

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
 */
export type ShareSummary = {
  pct: number;
  visited: number;
  total: number;
  stamps: number;
  stampTotal: number;
  resorts: number;
  resortTotal: number;
};

export function ShareCard({
  width,
  summary,
}: {
  width: number;
  summary: ShareSummary;
}) {
  const pad = Math.round(width * 0.075);
  const ring = Math.round(width * 0.42);

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
          pct={summary.pct}
          color="#E5B45F"
          trackColor="rgba(255,255,255,0.16)"
        >
          {/* Composed as an array rather than spread: a StyleSheet entry is
              not guaranteed to be a plain object, and `{...styles.pct}` is the
              kind of thing that works until it quietly does not. */}
          <ThemedText style={[styles.pct, { fontSize: Math.round(ring * 0.3) }]}>
            {Math.round(summary.pct * 100)}
            <ThemedText
              style={[styles.pctSign, { fontSize: Math.round(ring * 0.15) }]}
            >
              %
            </ThemedText>
          </ThemedText>
        </ProgressRing>
        <ThemedText style={styles.caption}>of Walt Disney World eaten</ThemedText>
      </View>

      <View style={styles.foot}>
        <Stat value={`${summary.visited}`} label="PLACES" />
        <Stat value={`${summary.stamps}/${summary.stampTotal}`} label="STAMPS" />
        <Stat value={`${summary.resorts}/${summary.resortTotal}`} label="RESORTS" />
      </View>
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
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingTop: 12,
  },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
