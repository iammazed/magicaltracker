import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useVisits } from '@/hooks/use-visits';
import { todayISO } from '@/lib/local-db';

/** Only check-in is required — someone logging a stay they are currently on
 *  does not yet know the check-out date. */
export default function LogStayScreen() {
  const { resortId, name } = useLocalSearchParams<{ resortId: string; name?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { addStay } = useVisits();

  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [roomType, setRoomType] = useState('');
  const [saving, setSaving] = useState(false);

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const inValid = ISO.test(checkIn);
  const outValid = checkOut === '' || ISO.test(checkOut);
  const backwards = inValid && ISO.test(checkOut) && checkOut < checkIn;
  const canSave = inValid && outValid && !backwards;

  const save = async () => {
    if (!resortId || !canSave || saving) return;
    setSaving(true);
    await addStay({
      resortId,
      checkIn,
      checkOut: checkOut || null,
      rating,
      roomType: roomType.trim() || null,
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

        <Field label="Check in">
          <DateInput value={checkIn} onChange={setCheckIn} valid={inValid} />
        </Field>

        <Field label="Check out" hint="Optional">
          <DateInput value={checkOut} onChange={setCheckOut} valid={outValid} placeholder="Still there?" />
          {backwards ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Check-out is before check-in.
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
                  style={[styles.star, { color: rating && n <= rating ? theme.gold : theme.border }]}
                >
                  ★
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Room type" hint="Optional">
          <TextInput
            value={roomType}
            onChangeText={setRoomType}
            placeholder="Standard view, Club level…"
            placeholderTextColor={theme.textFaint}
            style={[
              styles.input,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text },
            ]}
          />
        </Field>

        <Pressable
          onPress={save}
          disabled={!canSave || saving}
          accessibilityRole="button"
          style={[
            styles.save,
            { backgroundColor: canSave ? theme.accent : theme.backgroundSelected },
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: canSave ? theme.onAccent : theme.textFaint }}
          >
            {saving ? 'Saving…' : 'Save stay'}
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

function DateInput({
  value,
  onChange,
  valid,
  placeholder = 'YYYY-MM-DD',
}: {
  value: string;
  onChange: (v: string) => void;
  valid: boolean;
  placeholder?: string;
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.textFaint}
      autoCapitalize="none"
      autoCorrect={false}
      style={[
        styles.input,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: valid ? theme.border : theme.danger,
          color: theme.text,
        },
      ]}
    />
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
  stars: { flexDirection: 'row', gap: Spacing.two },
  star: { fontSize: 32, lineHeight: 38 },
  save: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
  },
  footnote: { textAlign: 'center', lineHeight: 18 },
});
