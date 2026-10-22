# Relaxation Station

Free guided meditations and soothing soundscapes. Everything is built into the app, so it works fully offline, even in airplane mode.

- **15 guided meditations** in five categories: Sleep, Stress Relief, Breathing, Body Scan and Focus. Each category has a 3, 5 and 10 minute session.
- **12 soundscapes:** Gentle Rain, Wind Chimes, Ocean Waves, Music Box Lullaby, Heartbeat, Crackling Fire, Guitar Lullaby, Box Fan, Brown Noise, Relaxing Bells, Car Ride and Gentle Shush. Each plays on a seamless loop until you stop it, like a sound machine.
- **Keeps playing with the screen locked,** with lock screen and notification controls.
- **No network, no accounts, no data collection.**

Built with Expo SDK 57, React Native 0.86 (New Architecture), Expo Router, the React Compiler, TypeScript and `expo-audio`.

## Getting started

Requirements: Node 24 LTS. Simulator builds also need Xcode and CocoaPods.

```bash
npm install
npx expo start --go       # Expo Go on your phone (scan the QR code)
npx expo run:ios          # development build on the iOS Simulator
```

Background playback and lock screen controls need a development or production build. They are native settings that Expo Go can't change.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Unit tests (jest-expo) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (eslint-config-expo) |
| `npm run generate:audio` | Regenerate the meditations and soundscapes (see below) |
| `npm run generate:brand` | Re-render the app icon, splash, Play icon and website logo |
| `node scripts/generate-play-assets.mjs` | Re-render the Google Play feature graphic and screenshots |

## How the audio is made

All audio is generated on a Mac and committed to `assets/audio/`. The app never downloads anything.

- **Catalog:** `content/catalog.json` lists every category, meditation and soundscape. The app and the generator both read it.
- **Scripts:** `content/meditations.txt` holds the meditation scripts. Each `## <id> <bed>` header names the background bed (`warm`, `guitar`, `ocean`, `piano` or `flute`). Lines are spoken, `~` adds a longer pause and `[N]` adds an exact pause of N seconds.
- **Generator:** `audio-tools/generate_audio.py`:
  - speaks each line with the open-source Qwen3-TTS text-to-speech model (Apache 2.0). The narrator is a gentle female voice. Qwen3-TTS VoiceDesign created her once from a written description, and her clip is kept in `audio-tools/narrator-reference.wav`. The Base model clones that clip for every sentence. The generator speeds each sentence up by 8% without changing its pitch, then softens the voice slightly
  - spreads the pauses so every session is exactly 3, 5 or 10 minutes
  - mixes the voice over the session's background bed, which dips slightly while the narrator speaks, with a singing bowl at the start and end
  - synthesizes the soundscapes from filtered noise and tones, and crossfades each one's end into its start so it loops seamlessly
  - encodes everything to AAC with macOS's `afconvert`
- **Soundscapes:** the lullaby is Brahms' Lullaby (1868, public domain) on a synthesized music box. The lullaby and bells are built as exact circles, so their notes and reverb wrap around the loop point.
- **Audio map:** the generator also writes `src/content/audio-files.ts`, the static `require()` map that bundles the files.

One-time generator setup. It needs Python 3.12 and an Apple Silicon Mac. The virtual environment lives in the git-ignored `.tts/` folder. The Qwen3-TTS models, about 9 GB, download to the Hugging Face cache on the first run:

```bash
python3.12 -m venv .tts/venv
.tts/venv/bin/pip install qwen-tts soundfile scipy audiotsm
npm run generate:audio                 # everything
npm run generate:audio -- meditations sleep-3   # one meditation
npm run generate:audio -- sounds rain                   # one soundscape
npm run generate:audio -- voice         # redesign the narrator from VOICE_DESCRIPTION
```

## Project layout

```
content/                  Catalog and meditation scripts (source of truth for the audio)
audio-tools/              Audio generator (Python, run on a Mac only)
assets/audio/             Generated meditations and soundscapes (AAC)
src/
  app/                    Expo Router routes: (tabs)/ Meditate, Sounds, About; player.tsx modal
  components/             Play/pause icon, sound icons, button; brand/ logo, hero, splash
  content/                Typed catalog and the generated audio map
  context/                Playback: one shared player, background audio, lock screen controls
  lib/                    Small pure helpers with tests
plugins/
  with-ios-scene-lifecycle.js   Adopts the UIScene life cycle required by the iOS 27 SDK (remove on SDK 58)
```

## Releasing

- **Website:** `docs/` holds the public home page, privacy policy and support page, served by GitHub Pages.
- **App Store:** [`store/README.md`](store/README.md) has the build command, listing copy, App Privacy and age rating answers, App Review notes and screenshots.
- **Google Play:** [`store/android/README.md`](store/android/README.md) has the Play Console steps, including the foreground service declaration that background audio needs.

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
npx eas-cli@latest build --platform android --profile production
```

## License

Copyright (c) 2026 Preston Davies. All rights reserved. See [LICENSE](LICENSE).
