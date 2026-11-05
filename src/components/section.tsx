import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * A titled group of rows.
 *
 * Lifted out of the Stats screen so that a section can decide for itself
 * whether it exists. `StepsSection` renders nothing on a device with no
 * pedometer, and when the heading lived in the parent that left a bare "STEPS"
 * label above empty space — which reads as a feature that broke rather than a
 * sensor that is absent. A section that owns its own title can return null and
 * take the title with it.
 */
export function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textFaint" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {caption ? (
        <ThemedText type="small" themeColor="textFaint">
          {caption}
        </ThemedText>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1, fontSize: 11, fontWeight: '700' },
  sectionBody: { gap: Spacing.three },
});
