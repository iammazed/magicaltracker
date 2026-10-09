import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { usePremium } from '@/hooks/use-premium';
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
  const { isPremium } = usePremium();

  const [visitedOn, setVisitedOn] = useState(todayISO());
  const [rating, setRating] = useState<number | null>(null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [partySize, setPartySize] = useState('');
  const [note, setNote] = useState('');
  const [dishes, setDishes] = useState<string[]>([]);
  const [dish, setDish] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const addDish = () => {
    const next = dish.trim();
    if (!next || dishes.includes(next)) return setDish('');
    setDishes((d) => [...d, next]);
    setDish('');
  };

  /**
   * Photos are copied into the app's own directory by the picker and stored as
   * local URIs. They are never uploaded — Supabase Storage comes with accounts.
   * Permission is requested at the point of use, which is both what Apple
   * expects and the only point at which the reason is obvious.
   */
  const pickPhotos = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Photo access is off',
        'Allow photo access in Settings to attach pictures to a visit.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.7,
    });
    if (result.canceled) return;
    setPhotos((existing) => {
      const merged = [...existing];
      for (const asset of result.assets) {
        if (!merged.includes(asset.uri)) merged.push(asset.uri);
      }
      return merged.slice(0, 6);
    });
  };

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
      // Guarded as well as gated. If the gate ever regressed, a free user
      // still could not write a premium field by reaching this call.
      note: isPremium && note.trim() ? note.trim() : null,
      dishes: isPremium ? dishes : null,
      photos: isPremium ? photos : null,
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

        {/* ── Premium depth ──────────────────────────────────────── */}
        <PremiumGate feature="notes">
          <Field label="Notes" hint="Optional">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What was it actually like?"
              placeholderTextColor={theme.textFaint}
              multiline
              style={[
                styles.input,
                styles.multiline,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
          </Field>
        </PremiumGate>

        <PremiumGate feature="dishes">
          <Field label="Dishes ordered" hint="Optional">
            <View style={styles.dishRow}>
              <TextInput
                value={dish}
                onChangeText={setDish}
                onSubmitEditing={addDish}
                placeholder="Add a dish"
                placeholderTextColor={theme.textFaint}
                returnKeyType="done"
                style={[
                  styles.input,
                  styles.dishInput,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
              <Pressable
                onPress={addDish}
                accessibilityRole="button"
                accessibilityLabel="Add dish"
                style={[styles.addDish, { backgroundColor: theme.accent }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  Add
                </ThemedText>
              </Pressable>
            </View>
            {dishes.length ? (
              <View style={styles.pills}>
                {dishes.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDishes((all) => all.filter((x) => x !== d))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${d}`}
                    style={[
                      styles.pill,
                      { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                    ]}
                  >
                    <ThemedText type="small">{d}</ThemedText>
                    <ThemedText type="small" themeColor="textFaint">
                      ✕
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Field>
        </PremiumGate>

        <PremiumGate feature="photos">
          <Field label="Photos" hint="Optional">
            <View style={styles.pills}>
              {photos.map((uri) => (
                <Pressable
                  key={uri}
                  onPress={() => setPhotos((all) => all.filter((x) => x !== uri))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                </Pressable>
              ))}
              {photos.length < 6 ? (
                <Pressable
                  onPress={pickPhotos}
                  accessibilityRole="button"
                  style={[styles.addPhoto, { borderColor: theme.border }]}
                >
                  <ThemedText style={{ color: theme.accent, fontSize: 22 }}>+</ThemedText>
                </Pressable>
              ) : null}
            </View>
            <ThemedText type="small" themeColor="textFaint">
              {photos.length
                ? 'Tap a photo to remove it. Stored on this device only.'
                : 'Up to six, stored on this device only.'}
            </ThemedText>
          </Field>
        </PremiumGate>

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
  multiline: { height: 96, paddingTop: Spacing.two, textAlignVertical: 'top' },
  dishRow: { flexDirection: 'row', gap: Spacing.two },
  dishInput: { flex: 1 },
  addDish: {
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: Radius.medium,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 64, height: 64, borderRadius: Radius.medium },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: { textAlign: 'center', lineHeight: 18 },
});
