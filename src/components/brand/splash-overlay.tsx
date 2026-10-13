import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { LogoMark } from '@/components/brand/logo-mark';
import { useTheme } from '@/hooks/use-theme';

/** Matches `imageWidth` for expo-splash-screen in app.json, so the handoff from the native splash is seamless. */
const SPLASH_LOGO_SIZE = 120;

/**
 * Draws the same logo and background as the native splash screen, hides the native splash
 * once this has laid out, then fades away to reveal the app.
 */
export function SplashOverlay() {
  const theme = useTheme();
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(450)}
      style={[styles.overlay, { backgroundColor: theme.heroBackground }]}
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => setVisible(false));
      }}>
      <LogoMark size={SPLASH_LOGO_SIZE} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
