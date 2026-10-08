import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { TIER_LABEL, TRANSPORT_LABEL, useResort } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
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

  const openMap = () => {
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
        <View style={styles.block}>
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
                      {s.check_in}
                      {s.check_out ? ` – ${s.check_out}` : '  (no check-out logged)'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {s.rating ? '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating) : 'Not rated'}
                      {s.room_type ? `  ·  ${s.room_type}` : ''}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => void deleteStay(s.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete stay from ${s.check_in}`}
                    hitSlop={8}
                  >
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      Delete
                    </ThemedText>
                  </Pressable>
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
            <ThemedText type="small" style={{ color: theme.accent }}>
              View on disneyworld.com ↗
            </ThemedText>
          </Pressable>
        ) : null}

        {resort.lat != null && resort.lng != null ? (
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

function Badge({ label, tone }: { label: string; tone: 'accent' | 'warning' | 'plain' }) {
  const theme = useTheme();
  const fg =
    tone === 'warning' ? theme.warning : tone === 'accent' ? theme.accent : theme.textSecondary;
  return (
    <View style={[styles.badge, { borderColor: fg, backgroundColor: theme.backgroundElement }]}>
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
});
