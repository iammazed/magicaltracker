import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useVisits } from '@/hooks/use-visits';
import { todayISO } from '@/lib/local-db';

/** Only check-in is required — someone logging a stay they are currently on
 *  does not yet know the check-out date. */
/** Walt Disney World opened on 1 October 1971. */
const PARK_OPENED = '1971-10-01';

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {name ? (
          <ThemedText type="subtitle" style={styles.venue}>
            {name}
          </ThemedText>
        ) : null}

        <DateField
          label="Check in"
          value={checkIn || null}
          placeholder="Pick a date"
          minISO={PARK_OPENED}
          openOn={todayISO()}
          onChange={(iso) => {
            setCheckIn(iso);
            // A check-in after the current check-out leaves the stay ending
            // before it starts, so that choice is dropped rather than kept
            // and rejected at save time.
            if (checkOut && checkOut < iso) setCheckOut('');
          }}
        />

        <Field label="Check out" hint="Leave empty if you are still there">
          {/* Earliest selectable day is the check-in, so a stay that ends
              before it begins is not offerable rather than validated after
              the fact. */}
          <DateField
            label="Check out"
            value={checkOut || null}
            placeholder="Still there"
            minISO={checkIn || PARK_OPENED}
            openOn={checkIn || todayISO()}
            onChange={setCheckOut}
          />
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
