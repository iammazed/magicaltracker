import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useCatalogFilters } from '@/hooks/use-catalog-filters';
import { useTheme } from '@/hooks/use-theme';
import { activeFilterCount, useVenues } from '@/hooks/use-venues';
import { useVisits } from '@/hooks/use-visits';

/**
 * The filter sheet.
 *
 * A modal rather than a third row of chips: seven refinements across two chip
 * rows is a wall, and the one the plan actually asks for — service type,
 * reservations, character dining — is the row that would scroll off-screen.
 *
 * Every option shows how many places it would leave you, counted against the
 * other filters currently on. A filter that silently returns nothing is worse
 * than one that says "0" before you tap it.
 */

const KINDS = [
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'lounge', label: 'Lounges' },
  { id: 'snack', label: 'Snacks' },
  { id: 'kiosk', label: 'Kiosks' },
  { id: 'cart', label: 'Carts' },
  { id: 'food-truck', label: 'Food trucks' },
  // Deliberately last and deliberately present: events are the only way to
  // reach the 26 ticketed parties and festivals in the catalog.
  { id: 'event', label: 'Events' },
];

const SERVICE = [
  { id: 'table', label: 'Table service' },
  { id: 'quick', label: 'Quick service' },
  { id: 'lounge', label: 'Lounge' },
  { id: 'snack', label: 'Snack' },
];

export default function FiltersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { filters, set, togglePrice, clear } = useCatalogFilters();
  const { data: venues } = useVenues();
  const { byVenue } = useVisits();

  const active = activeFilterCount(filters);

  /**
   * Counts each option against every OTHER active filter, which is what makes
   * them honest — "Character dining 4" inside Magic Kingdom means four there,
   * not thirteen on property.
   */
  const count = useMemo(() => {
    const base = venues.filter(
      (v) => !filters.areaId || v.area_id === filters.areaId,
    );
    const matches = (
      v: (typeof base)[number],
      skip: keyof typeof filters,
    ): boolean => {
      if (skip !== 'kind') {
        if (filters.kind ? v.venue_kind !== filters.kind : v.venue_kind === 'event') {
          return false;
        }
      }
      if (skip !== 'serviceType' && filters.serviceType) {
        if (!v.service_type.includes(filters.serviceType)) return false;
      }
      if (skip !== 'priceTiers' && filters.priceTiers.length) {
        if (!filters.priceTiers.includes(v.price_tier)) return false;
      }
      if (skip !== 'reservationsOnly' && filters.reservationsOnly) {
        if (!v.reservations_recommended) return false;
      }
      if (skip !== 'characterOnly' && filters.characterOnly) {
        if (!v.is_character_dinner_dining && !v.is_character_breakfast_dining) {
          return false;
        }
      }
      if (skip !== 'signatureOnly' && filters.signatureOnly && !v.is_signature) {
        return false;
      }
      if (skip !== 'unvisitedOnly' && filters.unvisitedOnly && byVenue.has(v.id)) {
        return false;
      }
      return true;
    };

    return {
      kind: (id: string) =>
        base.filter((v) => v.venue_kind === id && matches(v, 'kind')).length,
      service: (id: string) =>
        base.filter((v) => v.service_type.includes(id) && matches(v, 'serviceType'))
          .length,
      price: (tier: number) =>
        base.filter((v) => v.price_tier === tier && matches(v, 'priceTiers')).length,
      reservations: base.filter(
        (v) => v.reservations_recommended && matches(v, 'reservationsOnly'),
      ).length,
      character: base.filter(
        (v) =>
          (v.is_character_dinner_dining || v.is_character_breakfast_dining) &&
          matches(v, 'characterOnly'),
      ).length,
      signature: base.filter((v) => v.is_signature && matches(v, 'signatureOnly'))
        .length,
      unvisited: base.filter((v) => !byVenue.has(v.id) && matches(v, 'unvisitedOnly'))
        .length,
    };
  }, [venues, filters, byVenue]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Filters',
          headerRight: () =>
            active > 0 ? (
              <Pressable onPress={clear} accessibilityRole="button" hitSlop={8}>
                <ThemedText type="small" style={{ color: theme.accent }}>
                  Clear all
                </ThemedText>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Type">
          <View style={styles.wrap}>
            <Option
              label="Anything to eat"
              sub="Hides events"
              active={filters.kind === null}
              onPress={() => set('kind', null)}
            />
            {KINDS.map((k) => (
              <Option
                key={k.id}
                label={k.label}
                sub={String(count.kind(k.id))}
                active={filters.kind === k.id}
                disabled={count.kind(k.id) === 0 && filters.kind !== k.id}
                onPress={() => set('kind', filters.kind === k.id ? null : k.id)}
              />
            ))}
          </View>
        </Section>

        <Section title="Service">
          <View style={styles.wrap}>
            <Option
              label="Any"
              active={filters.serviceType === null}
              onPress={() => set('serviceType', null)}
            />
            {SERVICE.map((s) => (
              <Option
                key={s.id}
                label={s.label}
                sub={String(count.service(s.id))}
                active={filters.serviceType === s.id}
                disabled={count.service(s.id) === 0 && filters.serviceType !== s.id}
                onPress={() =>
                  set('serviceType', filters.serviceType === s.id ? null : s.id)
                }
              />
            ))}
          </View>
        </Section>

        <Section title="Price" note="Pick more than one if you like">
          <View style={styles.wrap}>
            {[1, 2, 3, 4].map((tier) => (
              <Option
                key={tier}
                label={'$'.repeat(tier)}
                sub={String(count.price(tier))}
                active={filters.priceTiers.includes(tier)}
                disabled={count.price(tier) === 0 && !filters.priceTiers.includes(tier)}
                onPress={() => togglePrice(tier)}
              />
            ))}
          </View>
        </Section>

        <Section title="Only show">
          <Toggle
            label="Reservations recommended"
            sub={`${count.reservations} places`}
            value={filters.reservationsOnly}
            onToggle={() => set('reservationsOnly', !filters.reservationsOnly)}
          />
          <Toggle
            label="Character dining"
            sub={`${count.character} places`}
            value={filters.characterOnly}
            onToggle={() => set('characterOnly', !filters.characterOnly)}
          />
          <Toggle
            label="Signature dining"
            sub={`${count.signature} places`}
            value={filters.signatureOnly}
            onToggle={() => set('signatureOnly', !filters.signatureOnly)}
          />
          <Toggle
            label="Not yet visited"
            sub={`${count.unvisited} places`}
            value={filters.unvisitedOnly}
            onToggle={() => set('unvisitedOnly', !filters.unvisitedOnly)}
          />
        </Section>
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        style={[styles.done, { backgroundColor: theme.accent }]}
      >
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          Show results
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textFaint">
          {note}
        </ThemedText>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Option({
  label,
  sub,
  active,
  disabled,
  onPress,
}: {
  label: string;
  sub?: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      style={[
        styles.option,
        {
          backgroundColor: active ? theme.accent : theme.backgroundElement,
          borderColor: active ? theme.accent : theme.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={{ color: active ? theme.onAccent : theme.text }}
      >
        {label}
      </ThemedText>
      {sub ? (
        <ThemedText
          type="small"
          style={{
            color: active ? theme.onAccent : theme.textFaint,
            fontSize: 11,
          }}
        >
          {sub}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function Toggle({
  label,
  sub,
  value,
  onToggle,
}: {
  label: string;
  sub: string;
  value: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[
        styles.toggle,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <View style={styles.toggleText}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor="textFaint">
          {sub}
        </ThemedText>
      </View>
      <View
        style={[
          styles.box,
          value
            ? { backgroundColor: theme.accent, borderColor: theme.accent }
            : { borderColor: theme.border },
        ]}
      >
        {value ? (
          <ThemedText style={[styles.boxMark, { color: theme.onAccent }]}>✓</ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flex: 1, gap: 1 },
  box: {
    width: 24,
    height: 24,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxMark: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  done: {
    margin: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
  },
});
