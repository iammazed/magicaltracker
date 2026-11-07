import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { PhotoStrip } from '@/components/photo-viewer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AreaTone, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { menuLinks, useVenue } from '@/hooks/use-venue';
import { useVenueVisits } from '@/hooks/use-visits';
import { formatDate } from '@/lib/calendar';
import { jsonList } from '@/lib/local-db';
import { formatArray, formatCuisine, formatSubArea, titleCase } from '@/lib/labels';

/** SF Symbol on iOS, Material name elsewhere. */
const g = (ios: string, md: string): SymbolViewProps['name'] =>
  ({ ios, android: md, web: md }) as SymbolViewProps['name'];

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
  /** The same park colour the list row carried, and the map pin, and the
   *  passport stamp. See the AreaTone note in constants/theme.ts. */
  const tone = theme[AreaTone[venue.area_id] ?? 'brandTeal'];
  const price = '$'.repeat(Math.max(1, Math.min(4, venue.price_tier)));
  const service = venue.service_type.map((s) => SERVICE_LABEL[s] ?? s).join(', ');
  const character =
    venue.is_character_breakfast_dining || venue.is_character_dinner_dining;

  /** The app's own map, where the pins know what you have already done and
   *  what else is in walking distance. See `show-on-map`. */
  const showOnMap = () =>
    router.push({
      pathname: '/show-on-map',
      params: { id: venue.id, kind: 'venue' },
    });

  /**
   * Apple or Google Maps, kept as the secondary action rather than dropped.
   *
   * The in-app map says where a place is among the places around it; this is
   * the only one of the two that can route you there, which is worth having
   * for a restaurant you are driving to. Our map cannot do turn-by-turn and
   * should not pretend to.
   */
  const openDirections = () => {
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
        {/* ── Heading ─────────────────────────────────────────────────
            Built like the row that was tapped to get here: the park's colour
            as a stripe and a wash behind the name. The list was the only
            place in the app that said which park a restaurant belongs to in
            COLOUR, so opening one dropped that colour and the screen behind
            it was a white page of facts.

            A filled chip in the tone was the first attempt and was dropped:
            it needs `onAccent` ink, which lands at 4.2:1 on dark-mode
            indigo. A wash takes no ink of its own, so the heading keeps the
            13:1 it already had in both schemes. */}
        <View
          style={[
            styles.head,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <View style={[styles.headWash, { backgroundColor: tone, opacity: 0.1 }]} />
          <View style={[styles.headStripe, { backgroundColor: tone }]} />
          <View style={styles.headInner}>
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
                      {/* An onboarding backfill has today's date as a
                          placeholder, so showing it would be a small lie. */}
                      {v.date_exact ? formatDate(v.visited_on) : 'Visited — date not set'}
                      {i === 0 && visits.length > 1 ? '  (most recent)' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {v.rating ? '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating) : 'Not rated'}
                      {v.would_return == null
                        ? ''
                        : v.would_return
                          ? '  ·  Would return'
                          : '  ·  Would not return'}
                      {v.party_size ? `  ·  Party of ${v.party_size}` : ''}
                    </ThemedText>

                    {/* Premium detail. Rendered whenever it exists rather than
                        behind another premium check: a user who lapses must
                        still be able to read what they already wrote. */}
                    {jsonList(v.dishes).length ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {jsonList(v.dishes).join(', ')}
                      </ThemedText>
                    ) : null}
                    {v.note ? (
                      <ThemedText type="small" themeColor="textFaint" style={styles.visitNote}>
                        {v.note}
                      </ThemedText>
                    ) : null}
                    <PhotoStrip uris={jsonList(v.photos)} />
                  </View>
                  <View style={styles.visitActions}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/log-visit',
                          params: { venueId: venue.id, name: venue.name, visitId: v.id },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Edit visit on ${formatDate(v.visited_on)}`}
                      hitSlop={8}
                    >
                      <ThemedText type="small" style={{ color: theme.accentText }}>
                        Edit
                      </ThemedText>
                    </Pressable>
                    {/* Confirmed now that Edit sits next to it. Deleting was a
                        single unguarded tap, which was survivable while it was
                        the only control on the row; with a second target
                        beside it, a mis-tap silently destroys a visit — and a
                        rating and a note someone typed — with no undo. */}
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          'Delete this visit?',
                          v.date_exact
                            ? `Your visit on ${formatDate(v.visited_on)} will be removed. This cannot be undone.`
                            : 'This visit will be removed. This cannot be undone.',
                          [
                            { text: 'Keep it', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => void deleteVisit(v.id),
                            },
                          ],
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Delete visit on ${formatDate(v.visited_on)}`}
                      hitSlop={8}
                    >
                      <ThemedText type="small" style={{ color: theme.danger }}>
                        Delete
                      </ThemedText>
                    </Pressable>
                  </View>
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
        {/* Two columns rather than five label-over-value rows.
            A stack of "label        value" lines is a table, and a table is
            read top to bottom even when nobody wants all of it. Paired cells
            with a glyph apiece are scanned — you find the price without
            reading the cuisine. */}
        <Section title="Details">
          <View style={styles.factGrid}>
            <Fact
              label="Cuisine"
              glyph={g('globe', 'public')}
              value={formatCuisine(venue.cuisine)}
            />
            <Fact label="Service" glyph={g('fork.knife', 'restaurant')} value={service} />
            <Fact
              label="Style"
              glyph={g('sparkles', 'auto_awesome')}
              value={formatArray(venue.dining_style)}
            />
            <Fact label="Price" glyph={g('dollarsign.circle', 'paid')} value={price} />
            <Fact
              label="Type"
              glyph={g('mappin.and.ellipse', 'place')}
              value={titleCase(venue.venue_kind)}
            />
          </View>
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
                <ThemedText type="small" style={{ color: theme.accentText }}>
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
          <View style={styles.mapActions}>
            <Pressable
              onPress={showOnMap}
              accessibilityRole="button"
              style={[
                styles.secondary,
                styles.mapAction,
                { borderColor: theme.border },
              ]}
            >
              <ThemedText type="small" style={{ color: theme.accentText }}>
                Show on map
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={openDirections}
              accessibilityRole="button"
              style={[
                styles.secondary,
                styles.mapAction,
                { borderColor: theme.border },
              ]}
            >
              <ThemedText type="small" style={{ color: theme.accentText }}>
                Directions ↗
              </ThemedText>
            </Pressable>
          </View>
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

function Fact({
  label,
  value,
  glyph,
}: {
  label: string;
  value: string | null;
  glyph: SymbolViewProps['name'];
}) {
  const theme = useTheme();
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <View style={styles.factHead}>
        <SymbolView name={glyph} size={13} weight="semibold" tintColor={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.factLabel}>
          {label}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
  );
}

/**
 * An outlined pill.
 *
 * The edge takes the fill colour and the LABEL takes the ink colour, which
 * are different tokens — a 3:1 edge and 4.5:1 type. Set in one colour, the
 * gold badge was 3.4:1 on its own gold surface.
 */
function Badge({ label, tone }: { label: string; tone: 'gold' | 'accent' | 'warning' }) {
  const theme = useTheme();
  const bg = tone === 'gold' ? theme.goldSurface : theme.backgroundElement;
  const edge = tone === 'gold' ? theme.gold : tone === 'warning' ? theme.warning : theme.accent;
  const fg =
    tone === 'gold' ? theme.goldText : tone === 'warning' ? theme.warning : theme.accentText;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: edge }]}>
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
  head: {
    flexDirection: 'row',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headWash: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  /** The same 5pt as a list row's stripe, deliberately. */
  headStripe: { width: 5, alignSelf: 'stretch' },
  headInner: { flex: 1, padding: Spacing.three, gap: Spacing.two },
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
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  /** Two per row. `flexBasis` rather than `width` so a lone fifth cell on the
   *  last row stays column-width instead of stretching across. */
  fact: { flexBasis: '50%', flexGrow: 0, paddingRight: Spacing.three, gap: 2 },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  factLabel: { flexShrink: 1 },
  factValue: { textTransform: 'capitalize' },
  visitList: { gap: Spacing.two },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  visitNote: { lineHeight: 18, fontStyle: 'italic' },
  visitMain: { flex: 1, gap: 2 },
  visitActions: { alignItems: 'flex-end', gap: Spacing.two },
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
  mapActions: { flexDirection: 'row', gap: Spacing.two },
  /** Equal halves. The arrow on "Directions" is what distinguishes them —
   *  one stays in the app and one leaves it. */
  mapAction: { flex: 1 },
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
