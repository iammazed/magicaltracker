import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { VenueListItem } from '@/hooks/use-venues';

/**
 * Web stand-in for the map.
 *
 * `react-native-maps` has no web implementation, and importing it on web
 * breaks the Expo web bundle rather than degrading. The web build exists to
 * keep `/theme` and the token screen reachable in a browser, not to ship a
 * map, so this says so plainly instead of failing.
 */
export function VenueMap({ venues }: {
  venues: VenueListItem[];
  visitedIds: Set<string>;
  areaName: (id: string) => string;
  onOpen: (venue: VenueListItem) => void;
}) {
  return (
    <View style={styles.center}>
      <ThemedText type="smallBold">The map is iOS and Android only</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {venues.length} places are plotted in the app. Switch to the list to
        browse them here.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  body: { textAlign: 'center', maxWidth: 320 },
});
