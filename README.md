# Relaxation Station

Free guided meditations and soothing soundscapes. Everything is built into the app, so it works fully offline, even in airplane mode.

- **15 guided meditations** in five categories: Sleep, Stress Relief, Breathing, Body Scan and Focus. Each category has a 3, 5 and 10 minute session.
- **10 soundscapes:** Gentle Rain, Thunderstorm, Ocean Waves, Mountain Stream, Soft Wind, Crackling Fire, Summer Night, Box Fan, Brown Noise and Dreamy Drone. Each plays on a seamless loop until you stop it, like a sound machine.
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
- **Scripts:** `content/meditations.txt` holds the meditation scripts. Lines are spoken, `~` adds a longer pause and `[N]` adds an exact pause of N seconds.
- **Generator:** `audio-tools/generate_audio.py`:
  - speaks each line with the open-source Kokoro text-to-speech model (Apache 2.0, voice `af_bella`, "Bella")
  - spreads the pauses so every session is exactly 3, 5 or 10 minutes
  - mixes in a soft drone and a singing bowl at the start and end
  - synthesizes the soundscapes from filtered noise and tones, and crossfades each one's end into its start so it loops seamlessly
  - encodes everything to AAC with macOS's `afconvert`
- **Audio map:** the generator also writes `src/content/audio-files.ts`, the static `require()` map that bundles the files.

One-time generator setup (about 400 MB, kept in the git-ignored `.tts/` folder):

```bash
python3 -m venv .tts/venv
.tts/venv/bin/pip install kokoro-onnx soundfile scipy
curl -L -o .tts/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o .tts/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
npm run generate:audio                 # everything
npm run generate:audio -- meditations sleep-3   # one meditation
```

## Project layout

```
content/                  Catalog and meditation scripts (source of truth for the audio)
audio-tools/              Audio generator (Python, run on a Mac only)
assets/audio/             Generated meditations and soundscapes (AAC)
src/
  app/                    Expo Router routes: (tabs)/ Meditate, Sounds, About; player.tsx modal
  components/             Mini player, sound icons, button; brand/ logo, hero, splash
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
