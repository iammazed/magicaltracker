import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { DateField } from '@/components/date-field';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/hooks/use-theme';
import { useVisits } from '@/hooks/use-visits';
import { tapSaved } from '@/lib/haptics';
import { jsonList, todayISO } from '@/lib/local-db';
import { importPhoto } from '@/lib/photos';

/**
 * Logging is two taps from the venue screen and everything below the date is
 * optional. A form that demands a rating before it will save is a form people
 * skip when they are tired and standing in a queue.
 */
/** Walt Disney World opened on 1 October 1971. */
const PARK_OPENED = '1971-10-01';

export default function LogVisitScreen() {
  const { venueId, name, visitId } = useLocalSearchParams<{
    venueId: string;
    name?: string;
    /** Set to correct a visit already logged, rather than add a new one. */
    visitId?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const { visits, addVisit, updateVisit } = useVisits();
  const { isPremium } = usePremium();

  // Read ONCE, at mount, with the `useState` initialiser rather than from
  // `visits` on every render: a pull landing mid-edit would otherwise swap the
  // fields out from under whoever is typing in them.
  const [existing] = useState(() =>
    visitId ? visits.find((v) => v.id === visitId) ?? null : null,
  );
  const editing = !!visitId;

  const [visitedOn, setVisitedOn] = useState(existing?.visited_on ?? todayISO());
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(
    existing?.would_return == null ? null : existing.would_return === 1,
  );
  const [partySize, setPartySize] = useState(
    existing?.party_size == null ? '' : String(existing.party_size),
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [dishes, setDishes] = useState<string[]>(() => jsonList(existing?.dishes));
  const [dish, setDish] = useState('');
  const [photos, setPhotos] = useState<string[]>(() => jsonList(existing?.photos));
  /** Resizing six photos takes a visible moment; without this the Add
   *  button looks dead and gets tapped again. */
  const [importing, setImporting] = useState(false);
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
      // `quality` only applies when the picker re-encodes. `importPhoto` does
      // the real work: it caps the long edge and moves the file somewhere iOS
      // will not reclaim.
      quality: 0.7,
    });
    if (result.canceled) return;

    setImporting(true);
    try {
      // Sequential rather than Promise.all: six full-size images decoded at
      // once is a memory spike on an older phone, and the user is waiting
      // either way.
      const imported: string[] = [];
      for (const asset of result.assets) {
        imported.push(await importPhoto(asset));
      }
      setPhotos((existing) => {
        const merged = [...existing];
        for (const uri of imported) if (!merged.includes(uri)) merged.push(uri);
        return merged.slice(0, 6);
      });
    } finally {
      setImporting(false);
    }
  };

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(visitedOn);

  const save = async () => {
    if (!dateValid || saving) return;
    // An edit whose row has gone — deleted on another device between opening
    // this screen and saving — must not fall through to `addVisit` and quietly
    // become a second visit.
    if (editing && !existing) return;
    if (!editing && !venueId) return;
    setSaving(true);

    const fields = {
      visitedOn,
      rating,
      wouldReturn,
      partySize: partySize ? Number(partySize) : null,
    };

    if (existing) {
      // The note, dishes and photos pass through UNGUARDED here, and the
      // difference from the add path below is deliberate rather than an
      // oversight. All three sit behind `PremiumGate` and all three were
      // seeded from the row itself, so a premium check could not prevent a
      // write that the UI already makes impossible — what it WOULD do is
      // erase the notes, dishes and photos of anyone whose subscription had
      // lapsed, the moment they corrected a date. The venue screen already
      // renders this content for lapsed users on the principle that someone
      // must still be able to read what they wrote; deleting it on an
      // unrelated edit would break the same promise from the other side.
      await updateVisit(existing.id, {
        ...fields,
        note: note.trim() || null,
        dishes,
        photos,
      });
    } else {
      await addVisit({
        venueId,
        ...fields,
        // Guarded as well as gated. If the gate ever regressed, a free user
        // still could not write a premium field by reaching this call.
        note: isPremium && note.trim() ? note.trim() : null,
        dishes: isPremium ? dishes : null,
        photos: isPremium ? photos : null,
      });
    }
    // After the write, before the dismissal: the tap confirms the thing that
    // just happened. Haptics lived only on achievement unlocks, which are
    // rare enough that the first tester assumed they were broken.
    tapSaved();
    router.back();
  };

  // Only reachable if the row vanished between the tap and this mount.
  // Falling through to the blank form would invite logging a duplicate of
  // the visit someone was trying to fix.
  if (editing && !existing) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: 'Edit visit' }} />
        <ThemedText type="small" themeColor="textFaint" style={styles.footnote}>
          This visit is no longer here — it may have been deleted on another
          device.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: editing ? 'Edit visit' : 'Log a visit' }} />
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

        {/* A calendar, not a text field. The same reasoning as the trip
            planner: a typed date can be one that does not exist, and a visit
            dated 2072 is wrong rather than broken, so nobody notices.
            Floor is the day Walt Disney World opened; no ceiling, because
            logging a meal mid-trip on a date the phone thinks is tomorrow is
            a real thing that happens across time zones. */}
        <DateField
          label="Date"
          value={visitedOn}
          placeholder="Pick a date"
          minISO={PARK_OPENED}
          openOn={todayISO()}
          onChange={setVisitedOn}
        />

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
                  disabled={importing}
                  accessibilityRole="button"
                  accessibilityLabel={importing ? 'Adding photos' : 'Add photos'}
                  style={[styles.addPhoto, { borderColor: theme.border }]}
                >
                  {importing ? (
                    <ActivityIndicator color={theme.accent} />
                  ) : (
                    <ThemedText style={{ color: theme.accentText, fontSize: 22 }}>+</ThemedText>
                  )}
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
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save visit'}
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
