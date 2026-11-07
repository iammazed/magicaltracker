import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TierTone } from '@/constants/theme';
import { TIER_LABEL, TRANSPORT_LABEL, useResort } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatRange } from '@/lib/calendar';
import { useResortStays } from '@/hooks/use-visits';

export default function ResortDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { resort, loading, error } = useResort(id);
  const { stays, deleteStay } = useResortStays(id ?? '');

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  if (error || !resort) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">Could not load this resort</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {error ?? 'It may have been removed from the catalog.'}
        </ThemedText>
      </ThemedView>
    );
  }

  /** The tier colour the resorts list gave this row. Resorts are ordered
   *  by price rather than by park, so they have their own scale. */
  const tone = theme[TierTone[resort.tier] ?? 'brandTeal'];

  /** The app's own map, where the pins know what you have already done and
   *  what else is in walking distance. See `show-on-map`. */
  const showOnMap = () =>
    router.push({
      pathname: '/show-on-map',
      params: { id: resort.id, kind: 'resort' },
    });

  /**
   * Apple or Google Maps, kept as the secondary action rather than dropped.
   *
   * The in-app map says where a place is among the places around it; this is
   * the only one of the two that can route you there, which is worth having
   * for a resort you are driving to. Our map cannot do turn-by-turn and
   * should not pretend to.
   */
  const openDirections = () => {
    if (resort.lat == null || resort.lng == null) return;
    const label = encodeURIComponent(resort.name);
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${label}&ll=${resort.lat},${resort.lng}`
        : `geo:${resort.lat},${resort.lng}?q=${resort.lat},${resort.lng}(${label})`;
    void Linking.openURL(url);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: resort.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Built like the row that was tapped to get here — see the longer
            note on the matching block in venue/[id].tsx. */}
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
              {resort.name}
            </ThemedText>
            <View style={styles.badges}>
              <Badge label={TIER_LABEL[resort.tier] ?? resort.tier} tone="accent" />
              {resort.ownership === 'partner' ? (
                <Badge label="Partner hotel" tone="warning" />
              ) : null}
              {resort.status !== 'open' ? <Badge label="Closed" tone="warning" /> : null}
            </View>
          </View>
        </View>

        {resort.description ? (
          <ThemedText style={styles.description}>{resort.description}</ThemedText>
        ) : null}

        <Section title="Your stays">
          {stays.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              You have not logged a stay here yet.
            </ThemedText>
          ) : (
            <View style={styles.list}>
              {stays.map((s) => (
                <View key={s.id} style={[styles.listRow, { borderColor: theme.borderSoft }]}>
                  <View style={styles.listMain}>
                    <ThemedText type="smallBold">
                      {s.check_out
                        ? formatRange(s.check_in, s.check_out)
                        : `${formatDate(s.check_in)}  ·  still there`}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {s.rating ? '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating) : 'Not rated'}
                      {s.room_type ? `  ·  ${s.room_type}` : ''}
                    </ThemedText>
                  </View>
                  <View style={styles.listActions}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/log-stay',
                          params: { resortId: resort.id, name: resort.name, stayId: s.id },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Edit stay from ${formatDate(s.check_in)}`}
                      hitSlop={8}
                    >
                      <ThemedText type="small" style={{ color: theme.accentText }}>
                        Edit
                      </ThemedText>
                    </Pressable>
                    {/* Confirmed for the same reason as a visit: Edit beside
                        it turns a stray tap into lost data with no undo. */}
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          'Delete this stay?',
                          `Your stay from ${formatDate(s.check_in)} will be removed. This cannot be undone.`,
                          [
                            { text: 'Keep it', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => void deleteStay(s.id),
                            },
                          ],
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Delete stay from ${formatDate(s.check_in)}`}
                      hitSlop={8}
                    >
                      <ThemedText type="small" style={{ color: theme.danger }}>
                        Delete
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/log-stay',
                params: { resortId: resort.id, name: resort.name },
              })
            }
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {stays.length ? 'Log another stay' : 'Log a stay'}
            </ThemedText>
          </Pressable>
        </Section>

        <Section title="Getting around">
          <View style={styles.badges}>
            {resort.transport.map((t) => (
              <Badge key={t} label={TRANSPORT_LABEL[t] ?? t} tone="plain" />
            ))}
          </View>
          {resort.transport_notes ? (
            <ThemedText type="small" themeColor="textSecondary">
              {resort.transport_notes}
            </ThemedText>
          ) : null}
        </Section>

        {resort.official_url ? (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(resort.official_url as string)}
            accessibilityRole="link"
            style={[styles.secondary, { borderColor: theme.border }]}
          >
            <ThemedText type="small" style={{ color: theme.accentText }}>
              View on disneyworld.com ↗
            </ThemedText>
          </Pressable>
        ) : null}

        {resort.lat != null && resort.lng != null ? (
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

/** Edge and label are separate tokens, for the reason given on the twin of
 *  this function in venue/[id].tsx: 3:1 for an edge, 4.5:1 for type. */
function Badge({ label, tone }: { label: string; tone: 'accent' | 'warning' | 'plain' }) {
  const theme = useTheme();
  const edge =
    tone === 'warning' ? theme.warning : tone === 'accent' ? theme.accent : theme.textSecondary;
  const fg =
    tone === 'warning'
      ? theme.warning
      : tone === 'accent'
        ? theme.accentText
        : theme.textSecondary;
  return (
    <View style={[styles.badge, { borderColor: edge, backgroundColor: theme.backgroundElement }]}>
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
  headStripe: { width: 5, alignSelf: 'stretch' },
  headInner: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  title: { fontSize: 24, lineHeight: 30 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  description: { lineHeight: 23 },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.two },
  list: { gap: Spacing.two },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listMain: { flex: 1, gap: 2 },
  listActions: { alignItems: 'flex-end', gap: Spacing.two },
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
});
