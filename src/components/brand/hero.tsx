import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G } from 'react-native-svg';

import { CALM_SHAPES } from '@/components/brand/calm-shapes';
import { LogoMark } from '@/components/brand/logo-mark';
import { useTheme } from '@/hooks/use-theme';

const CELL = 64;
const ICON_SIZE = 38;
const ICONS_PER_ROW = 10;
const ROW_WIDTH = CELL * ICONS_PER_ROW;
const ROW_COUNT = 7;
export const HERO_HEIGHT = 240;
/** Shapes are muted so the logo stays the focus. */
const PATTERN_OPACITY = { light: 0.55, dark: 0.4 };

export function Hero() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.hero, { height: HERO_HEIGHT + insets.top, backgroundColor: theme.heroBackground }]}>
      <View style={styles.pattern} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: ROW_COUNT }, (_, row) => (
          <FoodRow key={row} row={row} />
        ))}
      </View>
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <View style={[styles.halo, { backgroundColor: theme.background }]}>
          <LogoMark size={96} />
        </View>
      </View>
    </View>
  );
}

/** One diagonal band of food. Two copies sit side by side so the loop has no visible seam. */
function FoodRow({ row }: { row: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const reverse = row % 2 === 1;
  // Slightly different speeds per row keep the pattern from looking mechanical.
  const duration = 38_000 + (row % 3) * 7_000;

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [reduceMotion, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: reverse ? -ROW_WIDTH * (1 - progress.value) : -ROW_WIDTH * progress.value }],
  }));

  return (
    <Animated.View style={[styles.row, { marginLeft: row % 2 === 0 ? 0 : -CELL / 2 }, animatedStyle]}>
      <FoodRowCanvas row={row} />
      <FoodRowCanvas row={row} />
    </Animated.View>
  );
}

function FoodRowCanvas({ row }: { row: number }) {
  const opacity = PATTERN_OPACITY[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const scale = ICON_SIZE / 48;
  const inset = (CELL - ICON_SIZE) / 2;

  return (
    <Svg width={ROW_WIDTH} height={CELL} opacity={opacity}>
      {Array.from({ length: ICONS_PER_ROW }, (_, index) => {
        const Shape = CALM_SHAPES[(index + row * 3) % CALM_SHAPES.length];
        const tilt = ((index * 37 + row * 23) % 50) - 25;
        return (
          <G
            key={index}
            transform={`translate(${index * CELL + inset} ${inset}) scale(${scale}) rotate(${tilt} 24 24)`}>
            <Shape />
          </G>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
  },
  pattern: {
    position: 'absolute',
    top: -CELL * 1.5,
    left: -CELL * 3,
    transform: [{ rotate: '-20deg' }],
  },
  row: {
    flexDirection: 'row',
    width: ROW_WIDTH * 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
});
