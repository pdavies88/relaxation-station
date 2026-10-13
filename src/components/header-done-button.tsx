import { router } from 'expo-router';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** Closes a modal screen. Swiping down also works, but a visible button helps VoiceOver users. */
export function HeaderDoneButton() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close player"
      hitSlop={10}
      onPress={() => router.back()}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M6 6l12 12M18 6L6 18" stroke={theme.tint} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}
