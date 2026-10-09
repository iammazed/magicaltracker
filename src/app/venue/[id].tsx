import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { menuLinks, useVenue } from '@/hooks/use-venue';
import { useVenueVisits } from '@/hooks/use-visits';
import { formatArray, formatCuisine, formatSubArea, titleCase } from '@/lib/labels';

const SERVICE_LABEL: Record<string, string> = {
  quick: 'Quick service',
  table: 'Table service',
  lounge: 'Lounge',
  snack: 'Snack',
};

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { venue, context, loading, error } = useVenue(id);
  const { visits, deleteVisit } = useVenueVisits(id ?? '');

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  if (error || !venue) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">Could not load this place</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {error ?? 'It may have been removed from the catalog.'}
        </ThemedText>
      </ThemedView>
    );
  }

  const menus = menuLinks(venue);
  const price = '$'.repeat(Math.max(1, Math.min(4, venue.price_tier)));
  const service = venue.service_type.map((s) => SERVICE_LABEL[s] ?? s).join(', ');
  const character =
    venue.is_character_breakfast_dining || venue.is_character_dinner_dining;

  const openMap = () => {
    if (venue.lat == null || venue.lng == null) return;
    const label = encodeURIComponent(venue.name);
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${label}&ll=${venue.lat},${venue.lng}`
        : `geo:${venue.lat},${venue.lng}?q=${venue.lat},${venue.lng}(${label})`;
    void Linking.openURL(url);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: venue.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Heading ─────────────────────────────────────────────── */}
        <View style={styles.block}>
          <ThemedText type="subtitle" style={styles.title}>
            {venue.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[context.resortName ?? context.areaName,
              venue.sub_area ? formatSubArea(venue.sub_area) : null]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>

          <View style={styles.badges}>
            {venue.is_signature ? <Badge label="Signature" tone="gold" /> : null}
            {character ? <Badge label="Character dining" tone="gold" /> : null}
            {venue.reservations_recommended ? (
              <Badge label="Reservations recommended" tone="accent" />
            ) : null}
            {venue.status !== 'open' ? (
              <Badge
                label={venue.status === 'seasonal' ? 'Seasonal' : 'Closed'}
                tone="warning"
              />
            ) : null}
          </View>
        </View>

        {venue.description ? (
          <ThemedText style={styles.description}>{venue.description}</ThemedText>
        ) : null}

        {/* ── Your visits ─────────────────────────────────────────── */}
        <Section title="Your visits">
          {visits.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              You have not logged a visit here yet.
            </ThemedText>
          ) : (
            <View style={styles.visitList}>
              {visits.map((v, i) => (
                <View
                  key={v.id}
                  style={[styles.visitRow, { borderColor: theme.borderSoft }]}
                >
                  <View style={styles.visitMain}>
                    <ThemedText type="smallBold">
                      {v.visited_on}
                      {i === 0 && visits.length > 1 ? '  (most recent)' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {v.rating ? '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating) : 'Not rated'}
                      {v.would_return == null
                        ? ''
                        : v.would_return
                          ? '  ·  Would return'
                          : '  ·  Would not return'}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => void deleteVisit(v.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete visit on ${v.visited_on}`}
                    hitSlop={8}
                  >
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
              {visits.length > 1 ? (
                <ThemedText type="small" themeColor="textFaint">
                  Your rating for this place is your most recent visit, not an average.
                </ThemedText>
              ) : null}
            </View>
          )}

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/log-visit',
                params: { venueId: venue.id, name: venue.name },
              })
            }
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {visits.length ? 'Log another visit' : 'Log a visit'}
            </ThemedText>
          </Pressable>
        </Section>

        {/* ── Facts ───────────────────────────────────────────────── */}
        <Section title="Details">
          <Fact label="Cuisine" value={formatCuisine(venue.cuisine)} />
          <Fact label="Service" value={service} />
          <Fact
            label="Style"
            value={formatArray(venue.dining_style)}
          />
          <Fact label="Price" value={price} />
          <Fact label="Type" value={titleCase(venue.venue_kind)} />
        </Section>

        {/* ── Menus ───────────────────────────────────────────────── */}
        {menus.length ? (
          <Section title="Menus">
            {menus.map(({ label, url }) => (
              <Pressable
                key={label}
                onPress={() => void WebBrowser.openBrowserAsync(url)}
                accessibilityRole="link"
                style={[styles.linkRow, { borderColor: theme.border }]}
              >
                <ThemedText type="small">{label}</ThemedText>
                <ThemedText type="small" style={{ color: theme.accent }}>
                  Open ↗
                </ThemedText>
              </Pressable>
            ))}
            <ThemedText type="small" themeColor="textFaint">
              Menus open on disneyworld.com.
            </ThemedText>
          </Section>
        ) : null}

        {venue.lat != null && venue.lng != null ? (
          <Pressable
            onPress={openMap}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: theme.border }]}
          >
            <ThemedText type="small" style={{ color: theme.accent }}>
              Open in Maps
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.factLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'gold' | 'accent' | 'warning' }) {
  const theme = useTheme();
  const bg = tone === 'gold' ? theme.goldSurface : theme.backgroundElement;
  const fg = tone === 'gold' ? theme.gold : tone === 'warning' ? theme.warning : theme.accent;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: fg }]}>
      <ThemedText type="small" style={{ color: fg, fontSize: 11 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  centerText: { textAlign: 'center' },
  block: { gap: Spacing.two },
  title: { fontSize: 26, lineHeight: 32 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  description: { lineHeight: 23 },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.two },
  fact: { flexDirection: 'row', gap: Spacing.three },
  factLabel: { width: 80 },
  factValue: { flex: 1, textTransform: 'capitalize' },
  visitList: { gap: Spacing.two },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  visitMain: { flex: 1, gap: 2 },
  primary: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
  },
  secondary: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
