import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Hero } from '@/components/brand/hero';
import { MiniPlayer, PlayPauseIcon } from '@/components/mini-player';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME, APP_TAGLINE } from '@/constants/brand';
import { BottomTabInset, DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { CATEGORIES, type Meditation } from '@/content/catalog';
import { usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';

export default function MeditateScreen() {
  const { track } = usePlayback();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four + (track ? 104 : 0) }}>
        <Hero />
        <View style={styles.content}>
          <View style={styles.intro}>
            <ThemedText style={styles.appName}>{APP_NAME}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.tagline}>
              {APP_TAGLINE}
            </ThemedText>
          </View>

          {CATEGORIES.map((category) => (
            <View key={category.id} style={styles.category}>
              <View>
                <ThemedText style={styles.categoryTitle}>{category.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {category.description}
                </ThemedText>
              </View>
              {category.meditations.map((meditation) => (
                <SessionRow key={meditation.id} meditation={meditation} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <MiniPlayer />
    </ThemedView>
  );
}

function SessionRow({ meditation }: { meditation: Meditation }) {
  const theme = useTheme();
  const { track, isPlaying, play } = usePlayback();
  const isCurrent = track?.kind === 'meditation' && track.id === meditation.id;

  const open = () => {
    if (!isCurrent) play('meditation', meditation.id);
    router.push('/player');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meditation.title}, ${meditation.minutes} minutes. ${meditation.description}`}
      onPress={open}>
      {({ pressed }) => (
        <ThemedView
          type="backgroundElement"
          style={[styles.row, { borderColor: isCurrent ? theme.tint : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
          <View style={[styles.minutes, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText style={styles.minutesNumber}>{meditation.minutes}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.minutesLabel}>
              min
            </ThemedText>
          </View>
          <View style={styles.rowText}>
            <ThemedText type="smallBold">{meditation.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {meditation.description}
            </ThemedText>
          </View>
          <PlayPauseIcon playing={isCurrent && isPlaying} color={theme.tint} />
        </ThemedView>
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
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  intro: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  appName: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
  },
  category: {
    gap: Spacing.two,
  },
  categoryTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 2,
  },
  minutes: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutesNumber: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
  },
  minutesLabel: {
    fontSize: 11,
    lineHeight: 13,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
