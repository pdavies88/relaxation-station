import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo-mark';
import { MiniPlayer } from '@/components/mini-player';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME } from '@/constants/brand';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlayback } from '@/context/playback-context';

const FACTS = [
  {
    title: 'Everything is free',
    body: '15 guided meditations and 10 soundscapes. No accounts, no subscriptions and no ads.',
  },
  {
    title: 'Works completely offline',
    body: 'All audio is built into the app. It works in airplane mode, and the app never connects to the internet.',
  },
  {
    title: 'Plays with your screen locked',
    body: 'Start a meditation or a sound, then lock your phone. Use the lock screen controls to pause or stop.',
  },
  {
    title: 'Your privacy',
    body: 'The app collects no data. Nothing you do in the app leaves your phone.',
  },
  {
    title: 'A gentle note',
    body: 'These meditations are for relaxation and general wellbeing. They are not medical advice or treatment.',
  },
];

export default function AboutScreen() {
  const { track } = usePlayback();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + Spacing.four + (track ? 104 : 0) },
          ]}>
          <View style={styles.header}>
            <LogoMark size={72} />
            <ThemedText type="subtitle">{APP_NAME}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Version {version}
            </ThemedText>
          </View>

          {FACTS.map((fact) => (
            <ThemedView key={fact.title} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{fact.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {fact.body}
              </ThemedText>
            </ThemedView>
          ))}

          <ThemedText type="small" themeColor="textSecondary" style={styles.credits}>
            Meditation voice generated with the open-source Kokoro text-to-speech model (Apache 2.0). All sounds
            and music were synthesized for this app.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
      <MiniPlayer />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  credits: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
});
