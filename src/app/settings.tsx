import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PremiumBadge } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { Radius, Spacing } from '@/constants/theme';
import { useCatalog } from '@/hooks/use-catalog';
import { useOnboarding } from '@/hooks/use-onboarding';
import { usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/hooks/use-theme';
import { useVisits } from '@/hooks/use-visits';
import { exportFilename, shareCsv, staysCsv, visitsCsv } from '@/lib/export-csv';

/**
 * Settings, export, and the About block.
 *
 * The non-affiliation disclaimer lives here and is not optional — it also has
 * to appear in the App Store description and in the website footer.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { visits, stays } = useVisits();
  const { venues, resorts, areas, version, source, refresh, refreshing } = useCatalog();
  const { isPremium, simulated } = usePremium();
  const { reset } = useOnboarding();
  const [busy, setBusy] = useState<string | null>(null);

  const areaName = useMemo(() => {
    const map = new Map(areas.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? id;
  }, [areas]);

  const resortName = useMemo(() => {
    const map = new Map(resorts.map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? id;
  }, [resorts]);

  const exportVisits = async () => {
    if (!visits.length) {
      Alert.alert('Nothing to export', 'Log a visit first and it will appear here.');
      return;
    }
    setBusy('visits');
    try {
      await shareCsv(
        exportFilename('visits'),
        visitsCsv(visits, venues, areaName, resortName),
      );
    } catch (e) {
      Alert.alert('Could not export', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const exportStays = async () => {
    if (!stays.length) {
      Alert.alert('Nothing to export', 'Log a resort stay first and it will appear here.');
      return;
    }
    setBusy('stays');
    try {
      await shareCsv(exportFilename('stays'), staysCsv(stays, resorts, areaName));
    } catch (e) {
      Alert.alert('Could not export', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const rerunOnboarding = () =>
    Alert.alert(
      'Run the quick start again?',
      'It will offer the same well-known places. Anything you have already logged is left alone, not duplicated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run it',
          onPress: async () => {
            await reset();
            router.push('/onboarding');
          },
        },
      ],
    );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Premium ──────────────────────────────────────────────── */}
        <Section title="Premium">
          <Pressable
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
            style={[
              styles.row,
              isPremium
                ? { backgroundColor: theme.goldSurface, borderColor: theme.gold }
                : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <View style={styles.rowMain}>
              <ThemedText type="smallBold">
                {isPremium
                  ? simulated
                    ? 'Premium simulated (developer)'
                    : 'Premium is active'
                  : 'Upgrade to Premium'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isPremium
                  ? simulated
                    ? 'Nothing purchased. Development only.'
                    : 'Notes, dishes, photos, unlimited trips, near me and export.'
                  : 'Notes, dishes, photos, unlimited trips, near me and export.'}
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.accent }}>
              {isPremium ? 'Manage' : 'See plans'}
            </ThemedText>
          </Pressable>
        </Section>

        {/* ── Export ───────────────────────────────────────────────── */}
        <Section title="Your data">
          <Row
            label="Export visits"
            sub={`${visits.length} logged`}
            action={busy === 'visits' ? 'Working…' : 'CSV'}
            premium={!isPremium}
            onPress={
              isPremium
                ? exportVisits
                : () => router.push({ pathname: '/paywall', params: { feature: 'export' } })
            }
          />
          <Row
            label="Export resort stays"
            sub={`${stays.length} logged`}
            action={busy === 'stays' ? 'Working…' : 'CSV'}
            premium={!isPremium}
            onPress={
              isPremium
                ? exportStays
                : () => router.push({ pathname: '/paywall', params: { feature: 'export' } })
            }
          />
          <ThemedText type="small" themeColor="textFaint">
            Everything you log is stored on this device. There are no accounts
            yet, so a reinstall loses it — exporting is how you keep a copy
            until syncing arrives.
          </ThemedText>
        </Section>

        {/* ── Catalog ──────────────────────────────────────────────── */}
        <Section title="Catalog">
          <Row
            label="Check for updates"
            sub={`${venues.length} places · ${resorts.length} resorts`}
            action={refreshing ? 'Checking…' : 'Refresh'}
            onPress={() => void refresh()}
          />
          <Row label="Quick start" sub="Tap through the best-known places again" action="Run" onPress={rerunOnboarding} />
          <ThemedText type="small" themeColor="textFaint">
            Catalog {version}
            {source === 'remote' ? ', updated from the server' : ', as shipped'}.
          </ThemedText>
        </Section>

        {/* ── About ────────────────────────────────────────────────── */}
        <Section title="About">
          <View
            style={[
              styles.about,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <Wordmark size="md" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
              MagicalTracker is an independent app from Grey Fox Creations LLC.
              It is not affiliated with, endorsed by, sponsored by, or in any way
              officially connected to The Walt Disney Company or any of its
              subsidiaries or affiliates. Walt Disney World, EPCOT and all
              related names are trademarks of their respective owners.
            </ThemedText>
          </View>
          <Row
            label="Privacy policy"
            action="Open"
            onPress={() => void Linking.openURL('https://magicaltracker.com/privacy')}
          />
          <Row
            label="Terms of use"
            action="Open"
            onPress={() => void Linking.openURL('https://magicaltracker.com/terms')}
          />
          <Row
            label="Support"
            action="Open"
            onPress={() => void Linking.openURL('https://magicaltracker.com/support')}
          />
        </Section>

        {__DEV__ ? (
          <Section title="Developer">
            <Row label="Design tokens" action="Open" onPress={() => router.push('/theme')} />
          </Section>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function Row({
  label,
  sub,
  action,
  premium,
  onPress,
}: {
  label: string;
  sub?: string;
  action: string;
  premium?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowTitle}>
          <ThemedText type="smallBold">{label}</ThemedText>
          {premium ? <PremiumBadge /> : null}
        </View>
        {sub ? (
          <ThemedText type="small" themeColor="textFaint">
            {sub}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" style={{ color: theme.accent }}>
        {action}
      </ThemedText>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  about: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  disclaimer: { lineHeight: 18 },
});
