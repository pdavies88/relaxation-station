import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Aura } from '@/components/brand/aura';
import { LogoMark } from '@/components/brand/logo-mark';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME, APP_TAGLINE } from '@/constants/brand';
import { DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const HERO_HEIGHT = 300;
/** In short windows, such as a phone in landscape, the hero gives up space to the list below it. */
const MAX_HERO_SHARE = 0.4;
const FADE_HEIGHT = 120;

/** The hero's height below the status bar. It shrinks in short windows. */
export function useHeroHeight() {
  const window = useWindowDimensions();
  return Math.min(HERO_HEIGHT, window.height * MAX_HERO_SHARE);
}

function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Hero() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const height = useHeroHeight();
  const window = useWindowDimensions();
  // The SVG layers keep their old drawing after a rotation, which leaves a hard-edged block in the hero.
  // A new key per window size redraws them at the new size.
  const layerKey = `${window.width}x${window.height}`;

  return (
    <View style={[styles.hero, { minHeight: height + insets.top, backgroundColor: theme.heroBackground }]}>
      <Aura
        key={`aura-${layerKey}`}
        orbs={[
          { id: 'hero-primary', color: theme.auraPrimary, size: 420, x: '82%', y: '18%', period: 8_000 },
          { id: 'hero-secondary', color: theme.auraSecondary, size: 300, x: '8%', y: '62%', period: 11_000 },
        ]}
      />
      {/* Fades the hero into the page so there's no hard edge where the list begins. */}
      <Svg key={`fade-${layerKey}`} style={styles.fade} width="100%" height={FADE_HEIGHT} pointerEvents="none">
        <Defs>
          <LinearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.background} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={FADE_HEIGHT} fill="url(#hero-fade)" />
      </Svg>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.four,
            // Keeps the text clear of the Dynamic Island in landscape.
            paddingLeft: insets.left + Spacing.four,
            paddingRight: insets.right + Spacing.four,
          },
        ]}>
        <View style={styles.brand}>
          <LogoMark size={32} />
          <ThemedText style={styles.appName}>{APP_NAME}</ThemedText>
        </View>
        <View style={styles.copy}>
          <ThemedText style={styles.greeting}>{greeting(new Date().getHours())}</ThemedText>
          <ThemedText themeColor="textSecondary">{APP_TAGLINE}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  appName: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  copy: {
    gap: Spacing.two,
  },
  greeting: {
    fontSize: 38,
    lineHeight: 44,
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
    letterSpacing: -1.2,
  },
});
