import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

/**
 * A circular progress track, with whatever you put inside it at the centre.
 *
 * This waited for a native build. `react-native-svg` is a native dependency,
 * so adding it moves the runtime fingerprint and orphans every installed
 * binary — which is why the app shipped with bars for this long. Hand-rolling
 * an arc out of rotated half-circles was considered and rejected: fiddly
 * geometry that cannot be verified from Windows, when the real thing is one
 * dependency away.
 *
 * ## Why the rotation is on a `<G>` rather than the circle
 *
 * A stroked dash array starts at three o'clock, and progress should start at
 * twelve. Rotating the group by -90 about the centre moves the start without
 * touching the geometry, so `r` and the circumference stay readable as the
 * numbers they are. Rotating the `<Circle>` itself works on iOS and is
 * ignored by some web renderers, and this component also renders on web.
 */
export function ProgressRing({
  size,
  pct,
  color,
  trackColor,
  strokeWidth,
  children,
}: {
  /** Outer diameter in points. The stroke is drawn inside it. */
  size: number;
  /** 0–1. Values outside that range are clamped rather than rejected, because
   *  a count that exceeds its target is a data question, not a render one. */
  pct: number;
  color: string;
  trackColor: string;
  /** Defaults to a twelfth of the diameter, which holds its weight from a
   *  28pt inline ring up to the 128pt one on the share card. */
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const stroke = strokeWidth ?? Math.max(3, Math.round(size / 12));

  // The radius is to the CENTRE of the stroke, so half of it sits either side
  // and the ring lands exactly inside `size`. Using size/2 here clips the
  // outer half of the stroke on every edge.
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, pct));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="none"
          />
          {/*
            Nothing is drawn at zero. A round cap on a zero-length dash still
            paints a dot, so an empty ring would show a stray bead at twelve
            o'clock that reads as one visit logged when there are none.
          */}
          {clamped > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - clamped)}
              strokeLinecap="round"
            />
          ) : null}
        </G>
      </Svg>
      {children ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
