import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AreaTone, Radius, Spacing, TierTone } from '@/constants/theme';
import { TIER_LABEL, useResorts } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, tripStatus, useTrips } from '@/hooks/use-trips';
import { useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';
import { formatCuisine } from '@/lib/labels';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { trips, plansFor, removePlan, toggleBooked, deleteTrip } = useTrips();
  const { data: venues } = useVenues();
  const { data: resorts } = useResorts();
  const { byVenue } = useVisits();

  const trip = trips.find((t) => t.id === id) ?? null;
  const venueById = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);
  const resort = trip?.resort_id ? resorts.find((r) => r.id === trip.resort_id) : null;

  if (!trip) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">Trip not found</ThemedText>
      </ThemedView>
    );
  }

  const plans = plansFor(trip.id);
  const status = tripStatus(trip);
  const booked = plans.filter((p) => p.booked).length;

  const confirmDelete = () =>
    Alert.alert('Delete this trip?', 'The dining list goes with it. Logged visits are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(trip.id);
          router.back();
        },
      },
    ]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: trip.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <SkyCard style={styles.hero}>
          <Stars />
          <View style={styles.heroInner}>
            <ThemedText style={styles.eyebrow}>
              {status === 'current' ? 'HAPPENING NOW' : status === 'past' ? 'PAST TRIP' : 'UPCOMING'}
            </ThemedText>
            {status === 'upcoming' ? (
              <View style={styles.countRow}>
                <ThemedText style={styles.count}>{daysUntil(trip.start_date)}</ThemedText>
                <ThemedText style={styles.countUnit}>
                  {daysUntil(trip.start_date) === 1 ? 'day to go' : 'days to go'}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.count}>
                {status === 'current' ? `${daysUntil(trip.end_date)}d left` : 'Complete'}
              </ThemedText>
            )}
            <ThemedText style={styles.meta}>
              {trip.start_date} – {trip.end_date}
            </ThemedText>
          </View>
        </SkyCard>

        {/* ── Resort ───────────────────────────────────────────── */}
        <Section title="Staying at">
          {resort ? (
            <Pressable
              onPress={() => router.push({ pathname: '/resort/[id]', params: { id: resort.id } })}
              accessibilityRole="button"
              style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
            >
              <View style={[styles.bar, { backgroundColor: theme[TierTone[resort.tier] ?? 'brandTeal'] }]} />
              <View style={styles.cardText}>
                <ThemedText type="smallBold">{resort.name}</ThemedText>
                <ThemedText type="small" themeColor="textFaint">
                  {TIER_LABEL[resort.tier] ?? resort.tier}
                </ThemedText>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/resorts')}
              accessibilityRole="button"
              style={[styles.dashed, { borderColor: theme.border }]}
            >
              <ThemedText type="small" style={{ color: theme.accent }}>
                Choose a resort
              </ThemedText>
            </Pressable>
          )}
        </Section>

        {/* ── Dining plan ──────────────────────────────────────── */}
        <Section
          title={`Dining list  ·  ${booked}/${plans.length} booked`}
          action="Add places"
          onAction={() => router.push({ pathname: '/dining', params: { addToTrip: trip.id } })}
        >
          {plans.length === 0 ? (
            <Pressable
              onPress={() => router.push({ pathname: '/dining', params: { addToTrip: trip.id } })}
              accessibilityRole="button"
              style={[styles.dashed, { borderColor: theme.border }]}
            >
              <ThemedText type="small" style={{ color: theme.accent }}>
                + Add restaurants to this trip
              </ThemedText>
            </Pressable>
          ) : (
            plans.map((p) => {
              const v = venueById.get(p.venue_id);
              const visited = byVenue.has(p.venue_id);
              return (
                <View
                  key={p.id}
                  style={[styles.planRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                >
                  <View
                    style={[
                      styles.bar,
                      { backgroundColor: theme[AreaTone[v?.area_id ?? ''] ?? 'brandTeal'] },
                    ]}
                  />
                  <View style={styles.planMain}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {v?.name ?? p.venue_id}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textFaint" numberOfLines={1}>
                      {visited ? 'Already visited' : formatCuisine(v?.cuisine)}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => void toggleBooked(p.id, !p.booked)}
                    accessibilityRole="button"
                    accessibilityState={{ checked: !!p.booked }}
                    hitSlop={6}
                    style={[
                      styles.bookedPill,
                      p.booked
                        ? { backgroundColor: theme.gold, borderColor: theme.gold }
                        : { borderColor: theme.border },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: p.booked ? '#23133A' : theme.textFaint, fontSize: 11 }}
                    >
                      {p.booked ? 'Booked' : 'Book'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => void removePlan(trip.id, p.venue_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${v?.name ?? 'venue'} from trip`}
                    hitSlop={6}
                  >
                    <ThemedText type="small" style={{ color: theme.textFaint }}>✕</ThemedText>
                  </Pressable>
                </View>
              );
            })
          )}
        </Section>

        <Pressable onPress={confirmDelete} accessibilityRole="button" style={styles.delete}>
          <ThemedText type="small" style={{ color: theme.danger }}>
            Delete trip
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function Section({
  title, action, onAction, children,
}: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </ThemedText>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" style={{ color: theme.accent }}>{action}</ThemedText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  hero: { minHeight: 140 },
  heroInner: { padding: Spacing.four, gap: Spacing.one },
  eyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  count: { color: '#E5B45F', fontSize: 46, lineHeight: 50, fontWeight: '700' },
  countUnit: { color: 'rgba(255,255,255,0.75)', fontSize: 15 },
  meta: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
  section: { gap: Spacing.two },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  sectionBody: { gap: Spacing.two },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
    borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', paddingRight: Spacing.three,
  },
  cardText: { paddingVertical: Spacing.three, gap: 1, flexShrink: 1 },
  bar: { width: 5, alignSelf: 'stretch' },
  dashed: {
    alignItems: 'center', paddingVertical: Spacing.three,
    borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed',
  },
  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', paddingRight: Spacing.three,
  },
  planMain: { flex: 1, paddingVertical: Spacing.three, gap: 1 },
  bookedPill: {
    paddingHorizontal: Spacing.two, paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  delete: { alignItems: 'center', paddingVertical: Spacing.three },
});
