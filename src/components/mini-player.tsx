import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TabBarClearance } from '@/constants/theme';
import { usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';

export function PlayPauseIcon({ playing, color, size = 22 }: { playing: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {playing ? (
        <>
          <Rect x={6} y={5} width={4} height={14} rx={1.5} fill={color} />
          <Rect x={14} y={5} width={4} height={14} rx={1.5} fill={color} />
        </>
      ) : (
        <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill={color} />
      )}
    </Svg>
  );
}

/** Shows what's playing above the tab bar, on every tab. Tap it to open the full player. */
export function MiniPlayer() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { track, isPlaying, toggle, stop } = usePlayback();
  if (!track) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + TabBarClearance }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Now playing ${track.title}. Open player`}
        onPress={() => router.push('/player')}
        style={[styles.bar, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        <View style={styles.text}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {track.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {track.subtitle}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          hitSlop={8}
          onPress={toggle}
          style={[styles.circle, { backgroundColor: theme.tint }]}>
          <PlayPauseIcon playing={isPlaying} color={theme.onTint} size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop"
          hitSlop={8}
          onPress={stop}
          style={[styles.circle, { backgroundColor: theme.controlSurface }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Rect x={6} y={6} width={12} height={12} rx={2} fill={theme.text} />
          </Svg>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
  },
  text: {
    flex: 1,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
