import { Asset } from 'expo-asset';
import {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioMetadata,
  type AudioPlayer,
} from 'expo-audio';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { APP_NAME } from '@/constants/brand';
import { audioFor, findMeditation, findSoundscape } from '@/content/catalog';
import { clampPosition } from '@/lib/time';

export type TrackKind = 'meditation' | 'soundscape';

export type Track = {
  kind: TrackKind;
  id: string;
  title: string;
  subtitle: string;
};

type PlaybackContextValue = {
  track: Track | null;
  isPlaying: boolean;
  /** Seconds into a meditation. Soundscapes loop forever, so their position isn't meaningful. */
  position: number;
  duration: number;
  /** True once a meditation has played to the end. */
  finished: boolean;
  play: (kind: TrackKind, id: string) => void;
  toggle: () => void;
  stop: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

const SKIP_SECONDS = 15;

function describe(kind: TrackKind, id: string): Track {
  if (kind === 'meditation') {
    const meditation = findMeditation(id);
    if (!meditation) throw new Error(`Unknown meditation "${id}"`);
    return { kind, id, title: meditation.title, subtitle: `${meditation.categoryTitle} · ${meditation.minutes} min` };
  }
  const soundscape = findSoundscape(id);
  if (!soundscape) throw new Error(`Unknown soundscape "${id}"`);
  return { kind, id, title: soundscape.title, subtitle: 'Soundscape · plays until you stop it' };
}

/**
 * expo-audio is configured by setting properties on the shared native player. The React Compiler
 * treats values returned from hooks as read-only, so the assignment lives outside the component.
 */
function setLooping(player: AudioPlayer, loop: boolean): void {
  player.loop = loop;
}

// Lock-screen artwork needs a file URL. The app icon is bundled, so this never touches the network.
let artworkUrl: string | undefined;
async function loadArtwork(): Promise<string | undefined> {
  if (artworkUrl) return artworkUrl;
  try {
    const [asset] = await Asset.loadAsync(require('@/assets/images/icon.png'));
    artworkUrl = asset.localUri ?? asset.uri;
  } catch {
    artworkUrl = undefined;
  }
  return artworkUrl;
}

/**
 * One shared audio player for the whole app. Starting a meditation stops a soundscape and vice
 * versa. Playback continues with the screen locked, and shows lock-screen / notification controls,
 * which Android also needs to keep playing in the background for more than a few minutes.
 */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [track, setTrack] = useState<Track | null>(null);
  const askedForNotifications = useRef(false);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Lock-screen controls require the app to own the audio session.
      interruptionMode: 'doNotMix',
    });
  }, []);

  // When a meditation reaches its end, remove its lock-screen controls. Soundscapes loop, so they never finish.
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (update) => {
      if (update.didJustFinish && !update.loop) player.clearLockScreenControls();
    });
    return () => subscription.remove();
  }, [player]);

  // A meditation is finished once it has stopped at its end.
  const finished =
    track?.kind === 'meditation' &&
    !status.playing &&
    status.duration > 0 &&
    status.currentTime >= status.duration - 0.5;

  const showOnLockScreen = async (next: Track) => {
    // Android 13+ needs notification permission to show media controls. Ask once, on first play.
    if (Platform.OS === 'android' && !askedForNotifications.current) {
      askedForNotifications.current = true;
      await requestNotificationPermissionsAsync().catch(() => undefined);
    }
    const metadata: AudioMetadata = {
      title: next.title,
      artist: APP_NAME,
      albumTitle: next.subtitle,
      artworkUrl: await loadArtwork(),
    };
    player.setActiveForLockScreen(true, metadata, {
      showSeekBackward: next.kind === 'meditation',
      showSeekForward: next.kind === 'meditation',
    });
  };

  const play = (kind: TrackKind, id: string) => {
    if (track?.kind === kind && track.id === id && !finished) {
      player.play();
      return;
    }
    const next = describe(kind, id);
    player.replace(audioFor(kind, id));
    // Soundscapes repeat seamlessly until stopped. Meditations play once.
    setLooping(player, kind === 'soundscape');
    player.play();
    setTrack(next);
    void showOnLockScreen(next);
  };

  const value: PlaybackContextValue = {
    track,
    isPlaying: status.playing,
    position: status.currentTime,
    duration: status.duration,
    finished,
    play,
    toggle: () => {
      if (!track) return;
      if (status.playing) {
        player.pause();
      } else if (finished) {
        void player.seekTo(0).then(() => player.play());
        void showOnLockScreen(track);
      } else {
        player.play();
      }
    },
    stop: () => {
      player.pause();
      player.clearLockScreenControls();
      setTrack(null);
    },
    seekBy: (seconds) => {
      void player.seekTo(clampPosition(status.currentTime + seconds, status.duration));
    },
    seekTo: (seconds) => {
      void player.seekTo(clampPosition(seconds, status.duration));
    },
  };

  return <PlaybackContext value={value}>{children}</PlaybackContext>;
}

export function usePlayback(): PlaybackContextValue {
  const context = use(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
}

export { SKIP_SECONDS };
