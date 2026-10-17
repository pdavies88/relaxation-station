import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export type AuraOrb = {
  /** Unique within one Aura. SVG gradients are looked up by id. */
  id: string;
  color: string;
  size: number;
  /** Position of the orb's center inside the parent. */
  x: DimensionValue;
  y: DimensionValue;
  /** Milliseconds for one slow swell. Different values keep orbs out of step. */
  period?: number;
};

/** Soft glowing light that fills its parent. Purely decorative, so screen readers skip it. */
export function Aura({ orbs }: { orbs: AuraOrb[] }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {orbs.map((orb) => (
        <BreathingGlow key={orb.id} orb={orb} />
      ))}
    </View>
  );
}

function BreathingGlow({ orb }: { orb: AuraOrb }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const period = orb.period ?? 7_000;

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(progress);
  }, [reduceMotion, period, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + progress.value * 0.25,
    transform: [{ scale: 1 + progress.value * 0.12 }],
  }));

  return (
    <Animated.View
      style={[
        styles.orb,
        { left: orb.x, top: orb.y, width: orb.size, height: orb.size, marginLeft: -orb.size / 2, marginTop: -orb.size / 2 },
        animatedStyle,
      ]}>
      <Glow id={orb.id} color={orb.color} size={orb.size} />
    </Animated.View>
  );
}

/** A circle of color that fades out to fully transparent at its edge. */
export function Glow({ id, color, size }: { id: string; color: string; size: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.85} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.4} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
});
