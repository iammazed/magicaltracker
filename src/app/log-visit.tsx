import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useVisits } from '@/hooks/use-visits';
import { todayISO } from '@/lib/local-db';

/**
 * Logging is two taps from the venue screen and everything below the date is
 * optional. A form that demands a rating before it will save is a form people
 * skip when they are tired and standing in a queue.
 */
export default function LogVisitScreen() {
  const { venueId, name } = useLocalSearchParams<{ venueId: string; name?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { addVisit } = useVisits();

  const [visitedOn, setVisitedOn] = useState(todayISO());
  const [rating, setRating] = useState<number | null>(null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [partySize, setPartySize] = useState('');
  const [saving, setSaving] = useState(false);

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(visitedOn);
  const future = dateValid && visitedOn > todayISO();

  const save = async () => {
    if (!venueId || !dateValid || saving) return;
    setSaving(true);
    await addVisit({
      venueId,
      visitedOn,
      rating,
      wouldReturn,
      partySize: partySize ? Number(partySize) : null,
    });
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag">
        {name ? (
          <ThemedText type="subtitle" style={styles.venue}>
            {name}
          </ThemedText>
        ) : null}

        <Field label="Date">
          <TextInput
            value={visitedOn}
            onChangeText={setVisitedOn}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: dateValid ? theme.border : theme.danger,
                color: theme.text,
              },
            ]}
          />
          {!dateValid ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Use the format YYYY-MM-DD.
            </ThemedText>
          ) : future ? (
            // Warn, never block. Someone logging a trip they are mid-way
            // through can be right about a date that looks wrong.
            <ThemedText type="small" style={{ color: theme.warning }}>
              That date is in the future. Saving it anyway is fine.
            </ThemedText>
          ) : null}
        </Field>

        <Field label="Rating" hint="Optional">
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setRating(rating === n ? null : n)}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
                hitSlop={6}
              >
                <ThemedText
                  style={[
                    styles.star,
                    { color: rating && n <= rating ? theme.gold : theme.border },
                  ]}
                >
                  ★
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Would you go back?" hint="Optional">
          <View style={styles.choices}>
            <Choice
              label="Yes"
              active={wouldReturn === true}
              onPress={() => setWouldReturn(wouldReturn === true ? null : true)}
            />
            <Choice
              label="No"
              active={wouldReturn === false}
              onPress={() => setWouldReturn(wouldReturn === false ? null : false)}
            />
          </View>
          <ThemedText type="small" themeColor="textFaint">
            A better signal than stars, which everyone rounds up to four.
          </ThemedText>
        </Field>

        <Field label="Party size" hint="Optional">
          <TextInput
            value={partySize}
            onChangeText={(t) => setPartySize(t.replace(/[^0-9]/g, ''))}
            placeholder="2"
            placeholderTextColor={theme.textFaint}
            keyboardType="number-pad"
            style={[
              styles.input,
              styles.small,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
        </Field>

        <Pressable
          onPress={save}
          disabled={!dateValid || saving}
          accessibilityRole="button"
          style={[
            styles.save,
            { backgroundColor: dateValid ? theme.accent : theme.backgroundSelected },
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: dateValid ? theme.onAccent : theme.textFaint }}
          >
            {saving ? 'Saving…' : 'Save visit'}
          </ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="textFaint" style={styles.footnote}>
          Saved on this device. When accounts arrive, everything logged here
          syncs to the cloud automatically.
        </ThemedText>
      </ScrollView>
    </ThemedView>
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

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.choice,
        {
          backgroundColor: active ? theme.accent : theme.backgroundElement,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <ThemedText type="small" style={{ color: active ? theme.onAccent : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  venue: { fontSize: 22, lineHeight: 28 },
  field: { gap: Spacing.two },
  fieldHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  input: {
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  small: { width: 90 },
  stars: { flexDirection: 'row', gap: Spacing.two },
  star: { fontSize: 32, lineHeight: 38 },
  choices: { flexDirection: 'row', gap: Spacing.two },
  choice: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  save: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
  },
  footnote: { textAlign: 'center', lineHeight: 18 },
});
