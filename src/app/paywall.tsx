import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import {
  FEATURE_COPY,
  usePremium,
  type PremiumFeature,
} from '@/hooks/use-premium';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchPackages,
  purchase,
  restore,
  type PurchaseOutcome,
} from '@/lib/purchases';

/**
 * The paywall.
 *
 * Triggered contextually — you tapped "add a note" — and never as a launch
 * interstitial, so the first line names the thing you were just reaching for
 * rather than opening with a pitch.
 *
 * Purchasing is not wired up. The three products live in App Store Connect,
 * which needs the Apple Developer Program and a signed Paid Apps agreement, so
 * until then the buttons explain themselves instead of failing. The prices and
 * terms are real and shown anyway, because the layout that has to pass review
 * is the one worth building now.
 *
 * Three things here are not optional. Apple rejects for each of them:
 *   - a visible Restore Purchases button,
 *   - price AND renewal terms shown before the purchase point,
 *   - reachable links to the terms and the privacy policy.
 */

/**
 * `productId` must match the identifier in App Store Connect and RevenueCat
 * exactly. `fallbackPrice` is shown ONLY when the store cannot be reached —
 * in Expo Go, or before products are configured — so the layout stays
 * reviewable. A real purchase always renders `priceString` from the store,
 * because a hardcoded "$24.99" charges a British customer £22.99 while
 * showing them dollars, which is both a rejection and a lie.
 */
const PLANS = [
  {
    id: 'annual',
    // `premium_yearly`, not `premium_annual`, because that is what exists in
    // RevenueCat — and the App Store Connect product must be created with the
    // same string. A product identifier can never be renamed once Apple has
    // it, so the spelling is settled here and copied there, not the reverse.
    productId: 'premium_yearly',
    name: 'Annual',
    fallbackPrice: '$24.99',
    per: 'per year',
    note: (price: string) => `7-day free trial, then ${price}/year. Renews automatically.`,
    hero: true,
    // People take a Disney trip about once a year, so the annual plan matches
    // the cadence and is the defence against the real risk: someone subscribes
    // for their trip week and has no reason to open the app for eleven months.
    badge: 'Best value',
  },
  {
    id: 'monthly',
    productId: 'premium_monthly',
    name: 'Monthly',
    fallbackPrice: '$4.99',
    per: 'per month',
    note: (price: string) => `${price}/month. Renews automatically until cancelled.`,
    hero: false,
    badge: null,
  },
  {
    id: 'lifetime',
    productId: 'premium_lifetime',
    name: 'Lifetime',
    fallbackPrice: '$59.99',
    per: 'one time',
    note: () => 'One payment. No subscription, nothing to cancel.',
    hero: false,
    badge: null,
  },
] as const;

const ORDER: PremiumFeature[] = ['notes', 'dishes', 'photos', 'trips', 'nearby', 'export'];

export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: PremiumFeature }>();
  const { isPremium, simulated, setSimulated, refresh, usingTestStore } = usePremium();

  const asked = feature && FEATURE_COPY[feature] ? FEATURE_COPY[feature] : null;

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  /** Blocks a second tap while the Apple sheet is up. */
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPackages().then((p) => {
      if (!cancelled) setPackages(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** The store's package for a plan, or undefined when it cannot be bought
   *  here — Expo Go, no API key, or the product not yet configured. */
  const packageFor = (productId: string) =>
    packages.find((p) => p.product.identifier === productId);

  const unavailable = (what: string) =>
    Alert.alert(
      'Not available here',
      `${what} needs a development or TestFlight build with the store configured. ` +
        'Nothing has been charged.',
      [{ text: 'OK' }],
    );

  /** Shared by buying and restoring: both end by re-reading the entitlement. */
  const settle = async (outcome: PurchaseOutcome, successTitle: string) => {
    if (!outcome.ok) {
      // Backing out of the Apple sheet is a normal thing to do, not an error
      // worth an alert.
      if (!outcome.cancelled) Alert.alert('Something went wrong', outcome.message);
      return;
    }
    await refresh();
    if (outcome.entitled) {
      Alert.alert(
        successTitle,
        usingTestStore
          ? 'Simulated through RevenueCat’s Test Store — no real payment was taken.'
          : 'Premium is unlocked. Thank you.',
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } else {
      Alert.alert('Nothing to restore', 'No active purchase was found for this Apple ID.');
    }
  };

  const buy = async (productId: string, name: string) => {
    const pkg = packageFor(productId);
    if (!pkg) return unavailable(name);
    setBusy(true);
    try {
      await settle(await purchase(pkg), 'You’re all set');
    } finally {
      setBusy(false);
    }
  };

  const restorePurchases = async () => {
    setBusy(true);
    try {
      await settle(await restore(), 'Purchases restored');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <SkyCard style={styles.hero}>
          <Stars />
          <View style={styles.heroInner}>
            <ThemedText style={styles.heroEyebrow}>MAGICALTRACKER PREMIUM</ThemedText>
            <ThemedText style={styles.heroTitle}>
              {asked ? asked.title : 'Go deeper on every trip'}
            </ThemedText>
            <ThemedText style={styles.heroBody}>
              {asked
                ? asked.blurb
                : 'Keep the detail, plan more than one trip, and take your record with you.'}
            </ThemedText>
          </View>
        </SkyCard>

        {isPremium ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.goldSurface, borderColor: theme.gold },
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.gold }}>
              {simulated ? 'Premium simulated (developer)' : 'Premium is active'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {simulated
                ? 'Nothing has been purchased. This is the developer override, which exists only in development builds.'
                : 'Everything below is unlocked.'}
            </ThemedText>
          </View>
        ) : null}

        {/* ── What you get ─────────────────────────────────────────── */}
        <Section title="What premium adds">
          {ORDER.map((f) => (
            <View
              key={f}
              style={[
                styles.feature,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: theme.gold }]} />
              <View style={styles.featureText}>
                <ThemedText type="smallBold">{FEATURE_COPY[f].title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {FEATURE_COPY[f].blurb}
                </ThemedText>
              </View>
            </View>
          ))}
        </Section>

        {/* Free users keep logging. Charging for data entry would starve the
            ratings that make the community features possible later. */}
        <View
          style={[
            styles.note,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Logging stays free, always. Unlimited check-offs, unlimited ratings,
            the whole catalog, search, the map, and your passport percentages
            are not behind this.
          </ThemedText>
        </View>

        {/* ── Plans ────────────────────────────────────────────────── */}
        <Section title="Plans">
          {PLANS.map((p) => {
            const pkg = packageFor(p.productId);
            const price = pkg?.product.priceString ?? p.fallbackPrice;
            return (
            <Pressable
              key={p.id}
              onPress={() => void buy(p.productId, p.name)}
              disabled={busy}
              accessibilityRole="button"
              style={[
                styles.plan,
                p.hero
                  ? { backgroundColor: theme.goldSurface, borderColor: theme.gold }
                  : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <View style={styles.planTop}>
                <ThemedText type="smallBold">{p.name}</ThemedText>
                {p.badge ? (
                  <View style={[styles.badge, { backgroundColor: theme.gold }]}>
                    <ThemedText style={[styles.badgeText, { color: theme.onGold }]}>
                      {p.badge.toUpperCase()}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <View style={styles.priceRow}>
                <ThemedText style={[styles.price, { color: theme.text }]}>
                  {price}
                </ThemedText>
                <ThemedText type="small" themeColor="textFaint">
                  {p.per}
                </ThemedText>
              </View>
              {/* Renewal terms at the purchase point, not buried in a link. */}
              <ThemedText type="small" themeColor="textSecondary">
                {p.note(price)}
              </ThemedText>
            </Pressable>
            );
          })}
        </Section>

        {/* Required by Apple, and a guaranteed rejection without it. */}
        <Pressable
          onPress={() => void restorePurchases()}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.restore, { borderColor: theme.border }]}
        >
          <ThemedText type="small" style={{ color: theme.accent }}>
            Restore purchases
          </ThemedText>
        </Pressable>

        <View style={styles.legal}>
          <ThemedText type="small" themeColor="textFaint" style={styles.legalText}>
            Subscriptions renew automatically unless cancelled at least 24 hours
            before the period ends. Manage or cancel in your App Store account
            settings.
          </ThemedText>
          <View style={styles.legalLinks}>
            <Pressable
              onPress={() => void Linking.openURL('https://magicaltracker.com/terms')}
              accessibilityRole="link"
              hitSlop={8}
            >
              <ThemedText type="small" style={{ color: theme.accent }}>
                Terms
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textFaint">
              ·
            </ThemedText>
            <Pressable
              onPress={() => void Linking.openURL('https://magicaltracker.com/privacy')}
              accessibilityRole="link"
              hitSlop={8}
            >
              <ThemedText type="small" style={{ color: theme.accent }}>
                Privacy
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Development only. A release build never renders this, and
            `setSimulated` refuses to do anything there either. */}
        {__DEV__ ? (
          <Pressable
            onPress={async () => {
              await setSimulated(!isPremium);
              router.back();
            }}
            accessibilityRole="button"
            style={[styles.devToggle, { borderColor: theme.warning }]}
          >
            <ThemedText type="small" style={{ color: theme.warning }}>
              {isPremium ? 'DEV: turn premium off' : 'DEV: simulate premium'}
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </ThemedView>
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
  hero: { minHeight: 150 },
  heroInner: { padding: Spacing.four, gap: Spacing.one },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  heroTitle: { color: '#ffffff', fontSize: 26, lineHeight: 32, fontWeight: '700' },
  heroBody: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.one,
  },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.two },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  featureText: { flex: 1, gap: 2 },
  note: {
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  plan: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  price: { fontSize: 28, lineHeight: 32, fontWeight: '700' },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.small,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  restore: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legal: { gap: Spacing.two, alignItems: 'center' },
  legalText: { textAlign: 'center', lineHeight: 16 },
  legalLinks: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  devToggle: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
