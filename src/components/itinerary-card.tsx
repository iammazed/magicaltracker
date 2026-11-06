import { StyleSheet, View } from 'react-native';

import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Radius } from '@/constants/theme';
import type { Itinerary } from '@/lib/trip-share';

/**
 * A trip as a poster.
 *
 * ## Not square, unlike `ShareCard`
 *
 * The passport card is 1:1 because it is one number and it goes in a feed.
 * This is a LIST, and a list forced into a square either sets five days in
 * type too small to read or crops the rest of the week. It grows with the
 * trip instead and is sent in a message, where a tall image scrolls fine.
 *
 * ## Why no theme tokens
 *
 * Same contract as `ShareCard` and for the same reason: this is the sky
 * gradient, which is dark in both schemes, so a theme text token would invert
 * to near-black in light mode and make half of all shared images unreadable.
 * Every colour here is a literal.
 */

/** Past this, a poster stops being readable and becomes a spreadsheet. */
const MAX_DAYS = 14;
const MAX_MEALS_PER_DAY = 3;

export function ItineraryCard({
  width,
  itinerary: it,
  includeDining,
}: {
  width: number;
  itinerary: Itinerary;
  /** Off, this is the shape of the week; on, it is the whole plan. */
  includeDining: boolean;
}) {
  const pad = Math.round(width * 0.075);
  const nameSize = Math.round(width * 0.075);

  const shown = it.days.slice(0, MAX_DAYS);
  const hiddenDays = it.days.length - shown.length;

  return (
    <SkyCard style={{ width, padding: pad }} radius={Radius.large}>
      <Stars />

      <View style={styles.head}>
        <Wordmark size="sm" scriptColor="#E5B45F" restColor="#ffffff" />
        <ThemedText style={styles.eyebrow}>WALT DISNEY WORLD</ThemedText>
      </View>

      <View style={styles.title}>
        {/*
          `lineHeight` is required on anything above the inherited 24 — see
          the note in `share-card.tsx`. A trip name at 0.075 of a 380pt card
          is ~29pt and would be cropped top and bottom without it.
        */}
        <ThemedText
          style={[styles.name, { fontSize: nameSize, lineHeight: Math.round(nameSize * 1.2) }]}
          numberOfLines={2}
        >
          {it.name}
        </ThemedText>
        <ThemedText style={styles.dates}>{it.dates}</ThemedText>
        {it.resort ? (
          <ThemedText style={styles.resort} numberOfLines={1}>
            {it.resort}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.days}>
        {shown.map((d) => (
          <View key={d.date} style={styles.day}>
            <View style={styles.dayHead}>
              <ThemedText style={styles.dayLabel}>{d.label}</ThemedText>
              {/* An undecided day keeps its row and says so. Dropping it
                  would make a seven-night trip look like five. */}
              <ThemedText style={d.where ? styles.where : styles.whereBlank} numberOfLines={1}>
                {d.where ?? 'Nothing planned yet'}
              </ThemedText>
            </View>
            {includeDining && d.meals.length ? (
              <View style={styles.meals}>
                {d.meals.slice(0, MAX_MEALS_PER_DAY).map((m, i) => (
                  <ThemedText key={`${m.name}-${i}`} style={styles.meal} numberOfLines={1}>
                    {m.booked ? '✓' : '·'} {m.name}
                  </ThemedText>
                ))}
                {d.meals.length > MAX_MEALS_PER_DAY ? (
                  <ThemedText style={styles.more}>
                    +{d.meals.length - MAX_MEALS_PER_DAY} more
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}

        {hiddenDays > 0 ? (
          <ThemedText style={styles.more}>
            +{hiddenDays} more {hiddenDays === 1 ? 'day' : 'days'}
          </ThemedText>
        ) : null}
      </View>

      {/* The counts are the reason to include the dining list at all without
          printing every restaurant, so they only appear when it is on. */}
      {includeDining && it.mealCount > 0 ? (
        <View style={styles.foot}>
          <ThemedText style={styles.footText}>
            {it.mealCount} {it.mealCount === 1 ? 'meal planned' : 'meals planned'}
            {it.bookedCount > 0 ? ` · ${it.bookedCount} booked` : ''}
          </ThemedText>
        </View>
      ) : null}
    </SkyCard>
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
  title: { alignItems: 'center', gap: 2, marginTop: 18, marginBottom: 18 },
  name: { color: '#ffffff', fontWeight: '700', textAlign: 'center' },
  dates: { color: '#E5B45F', fontSize: 13, fontWeight: '600' },
  resort: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  days: { gap: 10 },
  day: { gap: 3 },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  dayLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    // Fixed so every park name starts at the same x. Without it the column
    // ragged-edges between "SAT 7" and "WED 14" and the list stops scanning.
    width: 56,
  },
  where: { color: '#ffffff', fontSize: 14, fontWeight: '600', flex: 1 },
  whereBlank: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    fontStyle: 'italic',
    flex: 1,
  },

  meals: { paddingLeft: 56 + 10, gap: 1 },
  meal: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  more: { color: 'rgba(255,255,255,0.45)', fontSize: 11, paddingLeft: 56 + 10 },

  foot: {
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingTop: 12,
    alignItems: 'center',
  },
  footText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
