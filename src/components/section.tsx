import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {/* Teal rather than the faintest text tier.
       *
       * This is the cheapest colour in the app: every list screen carries two
       * or three of these headings, so one token here puts the brand on
       * Stats, a trip, Settings, a venue and a resort at once — and a heading
       * is the right thing to colour, because the colour then says "heading"
       * alongside the capitals and the tracking rather than instead of them.
       *
       * `accentText`, not `accent`: the accent is 3.93:1 on the ground and
       * this is 11pt type. */}
      <ThemedText type="small" style={[styles.sectionTitle, { color: theme.accentText }]}>
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
