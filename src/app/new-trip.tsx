import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { TripPlanner } from '@/components/trip-planner';
import { Spacing } from '@/constants/theme';

/**
 * The planner as a modal.
 *
 * The same `TripPlanner` the home screen renders inline — this route exists for
 * "plan another trip" and for anything that deep-links to it, not as a second
 * implementation. All the behaviour lives in the component.
 */
export default function NewTripScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag">
        <TripPlanner
          onCreated={(id) => router.replace({ pathname: '/trip/[id]', params: { id } })}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, paddingBottom: Spacing.six },
});
