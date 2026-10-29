import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { Aura } from '@/components/brand/aura';
import { Button } from '@/components/button';
import { PlayPauseIcon } from '@/components/play-pause-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { SKIP_SECONDS, usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';
import { formatClock } from '@/lib/time';

const ORB_SIZE = 200;
/** The orb never takes more than this share of the player's height, so the controls fit. */
const MAX_ORB_SHARE = 0.3;
/** In two columns the orb shares its column only with the titles, so it can take a little more of the height. */
const MAX_WIDE_ORB_SHARE = 0.35;

/** Full-screen player for guided meditations. Soundscapes are started and stopped from their tiles. */
export default function PlayerScreen() {
  const theme = useTheme();
  const { track, isPlaying, position, duration, finished, toggle, stop, seekBy } = usePlayback();
  // Measured from the player itself, not the window: on an unfolded iPhone Duo the window is landscape
  // but the player is a narrow sheet.
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  // A phone in landscape is too short for one column, so the controls move beside the orb.
  const wide = frame.width > frame.height && frame.height > 0;
  const orbSize = Math.min(ORB_SIZE, (frame.height || ORB_SIZE / MAX_ORB_SHARE) * (wide ? MAX_WIDE_ORB_SHARE : MAX_ORB_SHARE));

  // Closing the player (the close button, a swipe down or Android back) ends the meditation.
  const endMeditation = useEffectEvent(() => {
    if (track?.kind === 'meditation') stop();
  });
  useEffect(() => () => endMeditation(), []);

  if (track?.kind !== 'meditation') {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText themeColor="textSecondary">Nothing is playing.</ThemedText>
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Aura
        // Redraws the glow at the new size after a rotation.
        key={`${frame.width}x${frame.height}`}
        orbs={[
          { id: 'player-primary', color: theme.auraPrimary, size: 520, x: '50%', y: '30%', period: 9_000 },
          { id: 'player-secondary', color: theme.auraSecondary, size: 360, x: '15%', y: '75%', period: 12_000 },
        ]}
      />
      {/* Pads only the sides that touch a safe area. On an unfolded iPhone Duo the player is a sheet that
          doesn't reach the window's right edge, so the window's insets would push it off-center. */}
      <SafeAreaView
        edges={['left', 'right']}
        style={styles.container}
        onLayout={(event: LayoutChangeEvent) => {
          const { width, height } = event.nativeEvent.layout;
          setFrame({ width, height });
        }}>
        {/* Scrolls only when the player is too short for everything. */}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, wide && styles.contentWide]}>
          <View style={[styles.column, wide && styles.columnWide]}>
            <BreathingOrb size={orbSize} />

            <View style={styles.titles}>
              <ThemedText style={styles.title}>{track.title}</ThemedText>
              <ThemedText themeColor="textSecondary">{track.subtitle}</ThemedText>
            </View>
          </View>

          <View style={[styles.column, wide && styles.columnWide]}>
            <View style={styles.progress}>
              <ProgressBar />
              <View style={styles.times}>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatClock(position)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  -{formatClock(duration - position)}
                </ThemedText>
              </View>
            </View>

            {finished ? <ThemedText style={styles.finished}>Session complete. Well done.</ThemedText> : null}

            <View style={styles.controls}>
              <SkipButton seconds={-SKIP_SECONDS} onPress={() => seekBy(-SKIP_SECONDS)} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : finished ? 'Play again' : 'Play'}
                onPress={toggle}
                style={({ pressed }) => [
                  styles.play,
                  { backgroundColor: theme.tint, transform: [{ scale: pressed ? 0.95 : 1 }] },
                ]}>
                <PlayPauseIcon playing={isPlaying} color={theme.onTint} size={34} />
              </Pressable>
              <SkipButton seconds={SKIP_SECONDS} onPress={() => seekBy(SKIP_SECONDS)} />
            </View>

            <Button
              title="End session"
              variant="secondary"
              // Closing the player ends the meditation, so going back is all this needs to do.
              onPress={() => router.back()}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** A soft, lit sphere at the center of the player. */
function BreathingOrb({ size }: { size: number }) {
  const theme = useTheme();
  const half = size / 2;
  return (
    <View style={styles.orb} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="player-orb" cx="38%" cy="32%" r="75%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.45" stopColor={theme.auraSecondary} />
            <Stop offset="1" stopColor={theme.tint} />
          </RadialGradient>
        </Defs>
        <Circle cx={half} cy={half} r={half - 1} fill="none" stroke={theme.tint} strokeOpacity={0.25} />
        <Circle cx={half} cy={half} r={half * 0.62} fill="url(#player-orb)" />
      </Svg>
    </View>
  );
}

function ProgressBar() {
  const theme = useTheme();
  const { position, duration, seekTo } = usePlayback();
  const [width, setWidth] = useState(0);
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;

  const seek = (event: GestureResponderEvent) => {
    if (width > 0) seekTo((event.nativeEvent.locationX / width) * duration);
  };

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position), text: formatClock(position) }}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      onPress={seek}
      hitSlop={{ top: 16, bottom: 16 }}
      style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.tint }]} />
    </Pressable>
  );
}

function SkipButton({ seconds, onPress }: { seconds: number; onPress: () => void }) {
  const theme = useTheme();
  const back = seconds < 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={back ? `Back ${-seconds} seconds` : `Forward ${seconds} seconds`}
      onPress={onPress}
      hitSlop={8}
      style={styles.skip}>
      <Svg width={40} height={40} viewBox="0 0 40 40">
        <Path
          d={back ? 'M20 8a12 12 0 1 1-11.3 8' : 'M20 8a12 12 0 1 0 11.3 8'}
          stroke={theme.text}
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
        />
        <Path d={back ? 'M20 3v10l-6-5z' : 'M20 3v10l6-5z'} fill={theme.text} />
        <SvgText x={20} y={25} fontSize={10} fontWeight="700" fill={theme.text} textAnchor="middle">
          {Math.abs(seconds)}
        </SvgText>
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    justifyContent: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  contentWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.five,
  },
  column: {
    gap: Spacing.four,
  },
  columnWide: {
    flex: 1,
  },
  orb: {
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  titles: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  progress: {
    gap: Spacing.two,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  finished: {
    textAlign: 'center',
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  play: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
