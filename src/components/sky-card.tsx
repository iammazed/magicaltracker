import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { SkyGradient } from '@/constants/theme';

/**
 * The twilight gradient as a surface, matching the website's hero.
 *
 * Dark in both themes by design — it is dusk, not a theme surface. Anything
 * placed on it must use white, `#E5B45F` gold, or white at >= 70% opacity;
 * the theme's own text tokens will be invisible on it in light mode.
 */
export function SkyCard({
  children,
  style,
  radius = Radius.large,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
}) {
  return (
    <LinearGradient
      colors={SkyGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, { borderRadius: radius }, style]}
    >
      {children}
    </LinearGradient>
  );
}

/** A few stars, for the larger sky surfaces. Positions are fixed rather than
 *  random so they do not jump on every re-render. */
export function Stars() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            borderRadius: s.r / 2,
            backgroundColor: '#ffffff',
            opacity: s.o,
          }}
        />
      ))}
    </View>
  );
}

const STARS = [
  { x: 8, y: 18, r: 2, o: 0.5 }, { x: 22, y: 62, r: 1.5, o: 0.35 },
  { x: 35, y: 12, r: 2.5, o: 0.6 }, { x: 48, y: 44, r: 1.5, o: 0.3 },
  { x: 61, y: 22, r: 2, o: 0.45 }, { x: 74, y: 68, r: 1.5, o: 0.4 },
  { x: 83, y: 30, r: 2.5, o: 0.55 }, { x: 92, y: 55, r: 1.5, o: 0.3 },
  { x: 15, y: 82, r: 1.5, o: 0.35 }, { x: 68, y: 86, r: 2, o: 0.4 },
];

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
