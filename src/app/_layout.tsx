import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from "@expo-google-fonts/quicksand";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { SplashOverlay } from "@/components/brand/splash-overlay";
import { Colors } from "@/constants/theme";
import { HeaderDoneButton } from "@/components/header-done-button";
import { PlaybackProvider } from "@/context/playback-context";

SplashScreen.preventAutoHideAsync();

// Navigation headers and modal sheets use the app's palette instead of React Navigation's defaults.
const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};
const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Fonts load at runtime (rather than via the expo-font config plugin) so the app also works in Expo Go.
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  // The native splash stays up until the overlay renders, so nothing shows in the fallback font.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? DarkNavTheme : LightNavTheme}
    >
      <PlaybackProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="player"
            options={{
              title: "Now playing",
              presentation: "modal",
              headerRight: () => <HeaderDoneButton />,
            }}
          />
        </Stack>
        <SplashOverlay />
      </PlaybackProvider>
    </ThemeProvider>
  );
}
