import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type RampToken } from '@/constants/theme';

/**
 * Web stand-in for the map.
 *
 * `react-native-maps` has no web implementation, and importing it on web
 * breaks the Expo web bundle rather than degrading. The web build exists to
 * keep the token screen reachable in a browser, not to ship a map, so this
 * says so plainly instead of failing.
 */

export type MapPlace = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  tone: RampToken;
  line1?: string;
  line2?: string;
};

export function CatalogMap({ places }: {
  places: MapPlace[];
  doneIds: Set<string>;
  doneLabel: string;
  onOpen: (place: MapPlace) => void;
}) {
  return (
    <View style={styles.center}>
      <ThemedText type="smallBold">The map is iOS and Android only</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {places.length} places are plotted in the app. Switch to the list to
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
