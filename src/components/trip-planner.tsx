import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TierTone } from '@/constants/theme';
import { TIER_LABEL, useResorts } from '@/hooks/use-resorts';
import { FREE_TRIP_LIMIT, usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/hooks/use-theme';
import { useTrips } from '@/hooks/use-trips';
import { formatShort, nightsBetween } from '@/lib/calendar';
import { todayISO } from '@/lib/local-db';

/**
 * The trip planner.
 *
 * Defined once and used in both places it appears: inline on the home screen,
 * where planning is the app's main job and so belongs on the first screen
 * rather than behind a button, and on `/new-trip` for the deep link and for
 * "plan another trip". Two copies of a form with a date range and a resort
 * search in it would drift within a week.
 *
 * A name is not asked for. It is derived from the dates, because "what do I
 * call this trip?" is a question nobody wants between choosing dates and
 * seeing a countdown — and `April 2027` is what the user would have typed
 * anyway. It stays editable afterwards.
 */
export function TripPlanner({
  onCreated,
  autoFocusName = false,
}: {
  onCreated?: (tripId: string) => void;
  autoFocusName?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { addTrip, trips } = useTrips();
  const { data: resorts } = useResorts();
  const { isPremium } = usePremium();

  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [resortId, setResortId] = useState<string | null>(null);
  const [resortSearch, setResortSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => todayISO(), []);
  const atLimit = !isPremium && trips.length >= FREE_TRIP_LIMIT;

  /** `April 2027`, or `Mar – Apr 2027` when the trip straddles two months. */
  const suggestedName = useMemo(() => {
    if (!start) return '';
    const [sy, sm] = start.split('-');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const startLabel = `${months[Number(sm) - 1]} ${sy}`;
    if (!end) return startLabel;
    const [ey, em] = end.split('-');
    if (sm === em && sy === ey) return startLabel;
    return `${months[Number(sm) - 1].slice(0, 3)} – ${months[Number(em) - 1].slice(0, 3)} ${ey}`;
  }, [start, end]);

  const finalName = name.trim() || suggestedName;
  const canSave = !!start && !!end && finalName.length > 0 && !atLimit;
  const nights = start && end ? nightsBetween(start, end) : 0;

  const matches = resortSearch.trim()
    ? resorts
        .filter((r) => r.name.toLowerCase().includes(resortSearch.toLowerCase()))
        .slice(0, 5)
    : [];
  const chosen = resorts.find((r) => r.id === resortId) ?? null;

  const save = async () => {
    if (!canSave || saving || !start || !end) return;
    setSaving(true);
    try {
      const id = await addTrip({
        name: finalName,
        startDate: start,
        endDate: end,
        resortId,
      });
      // Reset, because the inline copy on the home screen stays mounted and
      // would otherwise still be holding the trip that was just created.
      setStart(null);
      setEnd(null);
      setName('');
      setResortId(null);
      setResortSearch('');
      if (onCreated) onCreated(id);
      else router.push({ pathname: '/trip/[id]', params: { id } });
    } finally {
      setSaving(false);
    }
  };

  if (atLimit) {
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/paywall', params: { feature: 'trips' } })}
        accessibilityRole="button"
        style={[styles.limit, { backgroundColor: theme.goldSurface, borderColor: theme.gold }]}
      >
        <ThemedText type="smallBold">Plan another trip</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Free covers one trip at a time. Premium plans as many as you like,
          including trips years out.
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.gold }}>
          See plans
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        <DateField
          label="Arrive"
          value={start}
          placeholder="Pick a date"
          minISO={today}
          onChange={(iso) => {
            setStart(iso);
            // A new arrival after the current departure would leave the trip
            // ending before it starts, so that choice is dropped rather than
            // silently kept and rejected at save time.
            if (end && end < iso) setEnd(null);
          }}
        />
        <DateField
          label="Depart"
          value={end}
          placeholder={start ? 'Pick a date' : 'Arrive first'}
          // Cannot depart before arriving, so the calendar simply will not
          // offer those days.
          minISO={start ?? today}
          disabled={!start}
          onChange={setEnd}
        />
      </View>

      {start && end ? (
        <ThemedText type="small" themeColor="textSecondary">
          {nights} {nights === 1 ? 'night' : 'nights'} · {formatShort(start)} to{' '}
          {formatShort(end)}
        </ThemedText>
      ) : null}

      {/* The rest only appears once there are dates. An empty four-field form
          reads as work; one that grows as you answer reads as progress. */}
      {start && end ? (
        <>
          <Field label="Trip name" hint={name.trim() ? undefined : 'Using the dates'}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={suggestedName}
              placeholderTextColor={theme.textFaint}
              autoFocus={autoFocusName}
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
          </Field>

          <Field label="Where are you staying?" hint="Optional">
            {chosen ? (
              <Pressable
                onPress={() => {
                  setResortId(null);
                  setResortSearch('');
                }}
                accessibilityRole="button"
                style={[
                  styles.chosenResort,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.accent },
                ]}
              >
                <View
                  style={[
                    styles.tierBar,
                    { backgroundColor: theme[TierTone[chosen.tier] ?? 'brandTeal'] },
                  ]}
                />
                <View style={styles.chosenResortText}>
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
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                {matches.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setResortId(r.id);
                      setResortSearch('');
                    }}
                    accessibilityRole="button"
                    style={[styles.suggestion, { borderColor: theme.borderSoft }]}
                  >
                    <View
                      style={[
                        styles.tierDot,
                        { backgroundColor: theme[TierTone[r.tier] ?? 'brandTeal'] },
                      ]}
                    />
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
        </>
      ) : null}

      <Pressable
        onPress={save}
        disabled={!canSave || saving}
        accessibilityRole="button"
        style={[
          styles.save,
          { backgroundColor: canSave ? theme.gold : theme.backgroundSelected },
        ]}
      >
        <ThemedText
          type="smallBold"
          style={{ color: canSave ? theme.onGold : theme.textFaint }}
        >
          {saving
            ? 'Creating…'
            : !start
              ? 'Pick your dates'
              : !end
                ? 'Pick the day you leave'
                : `Start the countdown · ${finalName}`}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textFaint">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  field: { gap: Spacing.two },
  fieldHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  input: {
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  dateRow: { flexDirection: 'row', gap: Spacing.two },
  chosenResort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    overflow: 'hidden',
    paddingRight: Spacing.three,
  },
  tierBar: { width: 5, alignSelf: 'stretch' },
  chosenResortText: { paddingVertical: Spacing.three, gap: 1, flexShrink: 1 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  suggestionText: { flex: 1 },
  save: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
  },
  limit: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
});
