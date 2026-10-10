import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { SkyCard, Stars } from '@/components/sky-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TierTone } from '@/constants/theme';
import { TIER_LABEL, useResorts } from '@/hooks/use-resorts';
import { FREE_TRIP_LIMIT, usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/hooks/use-theme';
import { useTrips } from '@/hooks/use-trips';
import { nightsBetween } from '@/lib/calendar';
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
 * It renders on the twilight gradient, and that is the point rather than
 * decoration: this is the one surface the brand owns, it is the same gradient
 * as the countdown and the website hero, and a planner that looks like a
 * settings form is a planner nobody is excited to fill in.
 *
 * **Every colour in here is a literal, deliberately.** The gradient is dark in
 * both themes, so `theme.text` and friends invert underneath it and vanish in
 * light mode. The rule from AGENTS.md holds: on a SkyCard, use white, gold
 * `#E5B45F`, or white at an explicit opacity.
 *
 * A name is not asked for. It is derived from the dates, because "what do I
 * call this trip?" is a question nobody wants between choosing dates and
 * seeing a countdown — and `April 2027` is what the user would have typed
 * anyway. It stays editable afterwards.
 */
export function TripPlanner({
  title = 'Plan your trip',
  subtitle,
  onCreated,
  autoFocusName = false,
}: {
  /** Lives INSIDE the card. A section label floating above it made the card
   *  look like a form bolted on under someone else's heading. */
  title?: string;
  subtitle?: string;
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
    <SkyCard style={styles.card}>
      <Stars />
      <View style={styles.inner}>
        <View style={styles.heading}>
          <ThemedText style={styles.eyebrow}>WALT DISNEY WORLD</ThemedText>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
        </View>

        <View style={styles.dateRow}>
          <DateField
            label="Arrive"
            value={start}
            placeholder="Pick a date"
            minISO={today}
            tone="sky"
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
            tone="sky"
            onChange={setEnd}
          />
        </View>

        {/* The night count is the first thing the planner gives back, so it is
            sized like a reward rather than like a form summary. */}
        {start && end ? (
          <View style={styles.nightsRow}>
            <ThemedText style={styles.nights}>{nights}</ThemedText>
            <ThemedText style={styles.nightsUnit}>
              {nights === 1 ? 'night on property' : 'nights on property'}
            </ThemedText>
          </View>
        ) : (
          <ThemedText style={styles.hint}>
            {start
              ? 'Now pick the day you leave.'
              : 'Pick your dates and the countdown starts.'}
          </ThemedText>
        )}

        {/* The rest only appears once there are dates. An empty four-field
            form reads as work; one that grows as you answer reads as
            progress. */}
        {start && end ? (
          <>
            <Field label="Trip name" hint={name.trim() ? undefined : 'Using the dates'}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={suggestedName}
                placeholderTextColor="rgba(255,255,255,0.42)"
                autoFocus={autoFocusName}
                style={styles.input}
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
                  style={styles.chosenResort}
                >
                  <View
                    style={[
                      styles.tierBar,
                      { backgroundColor: theme[TierTone[chosen.tier] ?? 'brandTeal'] },
                    ]}
                  />
                  <View style={styles.chosenResortText}>
                    <ThemedText style={styles.resortName}>{chosen.name}</ThemedText>
                    <ThemedText style={styles.resortMeta}>
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
                    placeholderTextColor="rgba(255,255,255,0.42)"
                    style={styles.input}
                  />
                  {matches.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        setResortId(r.id);
                        setResortSearch('');
                      }}
                      accessibilityRole="button"
                      style={styles.suggestion}
                    >
                      <View
                        style={[
                          styles.tierDot,
                          { backgroundColor: theme[TierTone[r.tier] ?? 'brandTeal'] },
                        ]}
                      />
                      <ThemedText numberOfLines={1} style={styles.suggestionText}>
                        {r.name}
                      </ThemedText>
                      <ThemedText style={styles.resortMeta}>
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
          style={({ pressed }) => [
            styles.save,
            canSave ? styles.saveReady : styles.saveIdle,
            canSave && pressed ? styles.savePressed : null,
          ]}
        >
          <ThemedText
            style={[
              styles.saveText,
              { color: canSave ? '#23133A' : 'rgba(255,255,255,0.5)' },
            ]}
          >
            {saving
              ? 'Creating…'
              : !start
                ? 'Pick your dates'
                : !end
                  ? 'Pick the day you leave'
                  : 'Start the countdown'}
          </ThemedText>
          {canSave && !saving ? (
            <ThemedText style={styles.saveSub}>{finalName}</ThemedText>
          ) : null}
        </Pressable>
      </View>
    </SkyCard>
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
        <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
        {hint ? <ThemedText style={styles.fieldHint}>{hint}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 260 },
  inner: { padding: Spacing.four, gap: Spacing.three },

  heading: { gap: Spacing.one },
  eyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: { color: '#ffffff', fontSize: 30, lineHeight: 35, fontWeight: '700' },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 21,
    marginTop: Spacing.half,
  },

  dateRow: { flexDirection: 'row', gap: Spacing.three },

  nightsRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  nights: { color: '#E5B45F', fontSize: 40, lineHeight: 44, fontWeight: '700' },
  nightsUnit: { color: 'rgba(255,255,255,0.78)', fontSize: 15 },
  hint: { color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 21 },

  field: { gap: Spacing.two },
  fieldHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  fieldLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  fieldHint: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  input: {
    paddingHorizontal: Spacing.three,
    height: 50,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    color: '#ffffff',
    fontSize: 16,
  },

  chosenResort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#E5B45F',
    backgroundColor: 'rgba(229,180,95,0.14)',
    overflow: 'hidden',
    paddingRight: Spacing.three,
  },
  tierBar: { width: 5, alignSelf: 'stretch' },
  chosenResortText: { paddingVertical: Spacing.three, gap: 1, flexShrink: 1 },
  resortName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  resortMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  tierDot: { width: 9, height: 9, borderRadius: 4.5 },
  suggestionText: { flex: 1, color: '#ffffff', fontSize: 15 },

  save: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
    gap: 1,
  },
  saveReady: {
    backgroundColor: '#E5B45F',
    // A warm lift under the gold, so the button reads as sitting above the
    // sky rather than painted onto it. iOS honours the shadow props;
    // elevation is what Android reads.
    shadowColor: '#E5B45F',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  savePressed: { opacity: 0.88 },
  saveIdle: { backgroundColor: 'rgba(255,255,255,0.12)' },
  saveText: { fontSize: 17, fontWeight: '700' },
  saveSub: { color: 'rgba(35,19,58,0.72)', fontSize: 12, fontWeight: '600' },

  limit: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
});
