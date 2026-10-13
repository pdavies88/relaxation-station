import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/mini-player';
import { SoundIcon } from '@/components/sound-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { SOUNDSCAPES, type Soundscape } from '@/content/catalog';
import { usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';

export default function SoundsScreen() {
  const { track } = usePlayback();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + Spacing.four + (track ? 104 : 0) },
          ]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Sounds</ThemedText>
            <ThemedText themeColor="textSecondary">
              Tap a sound to start it. It keeps playing, even with your screen locked, until you stop it.
            </ThemedText>
          </View>
          <View style={styles.grid}>
            {SOUNDSCAPES.map((soundscape) => (
              <SoundTile key={soundscape.id} soundscape={soundscape} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
      <MiniPlayer />
    </ThemedView>
  );
}

function SoundTile({ soundscape }: { soundscape: Soundscape }) {
  const theme = useTheme();
  const { track, isPlaying, play, toggle } = usePlayback();
  const isCurrent = track?.kind === 'soundscape' && track.id === soundscape.id;
  const active = isCurrent && isPlaying;

  return (
    <Pressable
      style={styles.tilePressable}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${soundscape.title}. ${soundscape.description}`}
      accessibilityHint={active ? 'Pauses this sound' : 'Plays this sound until you stop it'}
      onPress={() => (isCurrent ? toggle() : play('soundscape', soundscape.id))}>
      {({ pressed }) => (
        <View
          style={[
            styles.tile,
            {
              backgroundColor: active ? theme.tint : theme.backgroundElement,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <SoundIcon id={soundscape.id} color={active ? theme.onTint : theme.tint} size={36} />
          <View style={styles.tileText}>
            <ThemedText type="smallBold" style={{ color: active ? theme.onTint : theme.text }}>
              {soundscape.title}
            </ThemedText>
            <ThemedText
              type="small"
              numberOfLines={3}
              style={{ color: active ? theme.onTint : theme.textSecondary, opacity: active ? 0.85 : 1 }}>
              {active ? 'Playing · tap to pause' : soundscape.description}
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
  tilePressable: {
    width: '47%',
    flexGrow: 1,
  },
  tile: {
    flex: 1,
    minHeight: 150,
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  tileText: {
    gap: Spacing.half,
  },
});
