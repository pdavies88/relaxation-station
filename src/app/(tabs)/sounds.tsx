import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SoundIcon } from '@/components/sound-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { SOUNDSCAPES, type Soundscape } from '@/content/catalog';
import { usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';

/** Windows at least this wide, such as an unfolded iPhone Duo or a phone in landscape, get three columns. */
const WIDE_WINDOW = 600;

export default function SoundsScreen() {
  const window = useWindowDimensions();
  const tileWidth = window.width >= WIDE_WINDOW ? '30%' : '47%';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Sounds</ThemedText>
            <ThemedText themeColor="textSecondary">
              Tap a sound to start it. It keeps playing, even with your screen locked. Tap it again to stop.
            </ThemedText>
          </View>
          <View style={styles.grid}>
            {SOUNDSCAPES.map((soundscape) => (
              <View key={soundscape.id} style={[styles.tileSlot, { width: tileWidth }]}>
                <SoundTile soundscape={soundscape} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SoundTile({ soundscape }: { soundscape: Soundscape }) {
  const theme = useTheme();
  const { track, isPlaying, play, stop } = usePlayback();
  const isCurrent = track?.kind === 'soundscape' && track.id === soundscape.id;
  const active = isCurrent && isPlaying;

  return (
    <Pressable
      style={styles.tilePressable}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${soundscape.title}. ${soundscape.description}`}
      accessibilityHint={active ? 'Stops this sound' : 'Plays this sound until you stop it'}
      onPress={() => (active ? stop() : play('soundscape', soundscape.id))}>
      {({ pressed }) => (
        <View
          style={[
            styles.tile,
            {
              backgroundColor: active ? theme.tint : theme.backgroundElement,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}>
          <SoundIcon id={soundscape.id} color={active ? theme.onTint : theme.tint} size={36} />
          <View style={styles.tileText}>
            <ThemedText style={[styles.tileTitle, { color: active ? theme.onTint : theme.text }]}>
              {soundscape.title}
            </ThemedText>
            <ThemedText
              type="small"
              numberOfLines={3}
              style={{ color: active ? theme.onTint : theme.textSecondary, opacity: active ? 0.85 : 1 }}>
              {active ? 'Playing · tap to stop' : soundscape.description}
            </ThemedText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tileSlot: {
    flexGrow: 1,
  },
  tilePressable: {
    flex: 1,
  },
  tile: {
    flex: 1,
    minHeight: 160,
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  tileText: {
    gap: Spacing.half,
  },
  tileTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
});
