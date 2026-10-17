import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
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

/** Full-screen player for guided meditations. Soundscapes are started and stopped from their tiles. */
export default function PlayerScreen() {
  const theme = useTheme();
  const { track, isPlaying, position, duration, finished, toggle, stop, seekBy } = usePlayback();

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
        orbs={[
          { id: 'player-primary', color: theme.auraPrimary, size: 520, x: '50%', y: '30%', period: 9_000 },
          { id: 'player-secondary', color: theme.auraSecondary, size: 360, x: '15%', y: '75%', period: 12_000 },
        ]}
      />
      <View style={styles.content}>
        <BreathingOrb />

        <View style={styles.titles}>
          <ThemedText style={styles.title}>{track.title}</ThemedText>
          <ThemedText themeColor="textSecondary">{track.subtitle}</ThemedText>
        </View>

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
    </ThemedView>
  );
}

/** A soft, lit sphere at the center of the player. */
function BreathingOrb() {
  const theme = useTheme();
  const half = ORB_SIZE / 2;
  return (
    <View style={styles.orb} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={ORB_SIZE} height={ORB_SIZE}>
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
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    justifyContent: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
