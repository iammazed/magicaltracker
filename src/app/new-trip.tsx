import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TierTone } from '@/constants/theme';
import { TIER_LABEL, useResorts } from '@/hooks/use-resorts';
import { useTheme } from '@/hooks/use-theme';
import { useTrips } from '@/hooks/use-trips';
import { todayISO } from '@/lib/local-db';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function NewTripScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { addTrip } = useTrips();
  const { data: resorts } = useResorts();

  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [resortId, setResortId] = useState<string | null>(null);
  const [resortSearch, setResortSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const startOk = ISO.test(start);
  const endOk = ISO.test(end);
  const backwards = startOk && endOk && end < start;
  const canSave = name.trim().length > 0 && startOk && endOk && !backwards;

  const matches = resortSearch.trim()
    ? resorts.filter((r) => r.name.toLowerCase().includes(resortSearch.toLowerCase())).slice(0, 6)
    : [];
  const chosen = resorts.find((r) => r.id === resortId) ?? null;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const id = await addTrip({
      name: name.trim(),
      startDate: start,
      endDate: end,
      resortId,
    });
    router.replace({ pathname: '/trip/[id]', params: { id } });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag">
        <Field label="Trip name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Spring Break 2027"
            placeholderTextColor={theme.textFaint}
            style={input(theme, true)}
          />
        </Field>

        <View style={styles.dates}>
          <Field label="Arrive" style={styles.dateField}>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder={todayISO()}
              placeholderTextColor={theme.textFaint}
              autoCapitalize="none"
              style={input(theme, start === '' || startOk)}
            />
          </Field>
          <Field label="Depart" style={styles.dateField}>
            <TextInput
              value={end}
              onChangeText={setEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textFaint}
              autoCapitalize="none"
              style={input(theme, end === '' || endOk)}
            />
          </Field>
        </View>
        {backwards ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            You cannot depart before you arrive.
          </ThemedText>
        ) : null}

        <Field label="Where are you staying?" hint="Optional — decide later">
          {chosen ? (
            <Pressable
              onPress={() => {
                setResortId(null);
                setResortSearch('');
              }}
              accessibilityRole="button"
              style={[styles.chosen, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}
            >
              <View style={[styles.tierBar, { backgroundColor: theme[TierTone[chosen.tier] ?? 'brandTeal'] }]} />
              <View style={styles.chosenText}>
                <ThemedText type="smallBold">{chosen.name}</ThemedText>
                <ThemedText type="small" themeColor="textFaint">
                  {TIER_LABEL[chosen.tier] ?? chosen.tier} · tap to change
                </ThemedText>
              </View>
            </Pressable>
          ) : (
            <>
              <TextInput
                value={resortSearch}
                onChangeText={setResortSearch}
                placeholder="Search resorts"
                placeholderTextColor={theme.textFaint}
                style={input(theme, true)}
              />
              {matches.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setResortId(r.id)}
                  accessibilityRole="button"
                  style={[styles.suggestion, { borderColor: theme.borderSoft }]}
                >
                  <View style={[styles.tierDot, { backgroundColor: theme[TierTone[r.tier] ?? 'brandTeal'] }]} />
                  <ThemedText type="small" numberOfLines={1} style={styles.suggestionText}>
                    {r.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textFaint">
                    {TIER_LABEL[r.tier] ?? r.tier}
                  </ThemedText>
                </Pressable>
              ))}
            </>
          )}
        </Field>

        <Pressable
          onPress={save}
          disabled={!canSave || saving}
          accessibilityRole="button"
          style={[styles.save, { backgroundColor: canSave ? theme.accent : theme.backgroundSelected }]}
        >
          <ThemedText type="smallBold" style={{ color: canSave ? theme.onAccent : theme.textFaint }}>
            {saving ? 'Creating…' : 'Create trip'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function input(theme: ReturnType<typeof useTheme>, valid: boolean) {
  return [
    styles.input,
    {
      backgroundColor: theme.backgroundElement,
      borderColor: valid ? theme.border : theme.danger,
      color: theme.text,
    },
  ];
}

function Field({
  label, hint, style, children,
}: { label: string; hint?: string; style?: object; children: React.ReactNode }) {
  return (
    <View style={[styles.field, style]}>
      <View style={styles.fieldHead}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {hint ? <ThemedText type="small" themeColor="textFaint">{hint}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  field: { gap: Spacing.two },
  fieldHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  dates: { flexDirection: 'row', gap: Spacing.two },
  dateField: { flex: 1 },
  input: {
    paddingHorizontal: Spacing.three, height: 44,
    borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, fontSize: 16,
  },
  chosen: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
    borderRadius: Radius.medium, borderWidth: 1, overflow: 'hidden',
    paddingRight: Spacing.three,
  },
  tierBar: { width: 5, alignSelf: 'stretch' },
  chosenText: { paddingVertical: Spacing.three, gap: 1, flexShrink: 1 },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  suggestionText: { flex: 1 },
  save: {
    marginTop: Spacing.two, paddingVertical: Spacing.three,
    borderRadius: Radius.medium, alignItems: 'center',
  },
});
