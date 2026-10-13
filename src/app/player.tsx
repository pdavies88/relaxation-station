import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/button';
import { PlayPauseIcon } from '@/components/mini-player';
import { SoundIcon } from '@/components/sound-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { SKIP_SECONDS, usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';
import { formatClock } from '@/lib/time';

export default function PlayerScreen() {
  const theme = useTheme();
  const { track, isPlaying, position, duration, finished, toggle, stop, seekBy } = usePlayback();

  if (!track) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText themeColor="textSecondary">Nothing is playing.</ThemedText>
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  const isMeditation = track.kind === 'meditation';

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.art, { backgroundColor: theme.heroBackground }]}>
          {isMeditation ? <LogoMark size={140} /> : <SoundIcon id={track.id} color={theme.tint} size={120} />}
        </View>

        <View style={styles.titles}>
          <ThemedText style={styles.title}>{track.title}</ThemedText>
          <ThemedText themeColor="textSecondary">{track.subtitle}</ThemedText>
        </View>

        {isMeditation ? (
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
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.loopNote}>
            Lock your screen anytime. The sound keeps playing.
          </ThemedText>
        )}

        {finished ? (
          <ThemedText style={styles.finished}>Session complete. Well done.</ThemedText>
        ) : null}

        <View style={styles.controls}>
          {isMeditation ? (
            <SkipButton seconds={-SKIP_SECONDS} onPress={() => seekBy(-SKIP_SECONDS)} />
          ) : (
            <View style={styles.skip} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : finished ? 'Play again' : 'Play'}
            onPress={toggle}
            style={({ pressed }) => [styles.play, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
            <PlayPauseIcon playing={isPlaying} color={theme.onTint} size={36} />
          </Pressable>
          {isMeditation ? (
            <SkipButton seconds={SKIP_SECONDS} onPress={() => seekBy(SKIP_SECONDS)} />
          ) : (
            <View style={styles.skip} />
          )}
        </View>

        <Button
          title="Stop"
          variant="secondary"
          onPress={() => {
            stop();
            router.back();
          }}
        />
      </View>
    </ThemedView>
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
  art: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    textAlign: 'center',
  },
  progress: {
    gap: Spacing.two,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loopNote: {
    textAlign: 'center',
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
