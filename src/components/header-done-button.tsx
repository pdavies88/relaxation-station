import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Closes a modal screen. Swiping down also works, but a visible button helps VoiceOver users. */
export function HeaderDoneButton() {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close player" hitSlop={10} onPress={() => router.back()}>
      <ThemedText type="smallBold" style={{ color: theme.tint }}>
        Done
      </ThemedText>
    </Pressable>
  );
}
