# App Store release kit

Everything App Store Connect asks for, ready to paste. Fill these in on the **website** (appstoreconnect.apple.com → Apps → Relaxation Station). The App Store Connect iPhone app can't edit versions.

## Go-live checklist

- [ ] Repo is public and GitHub Pages serves `docs/`, so the URLs below open.
- [ ] A TestFlight build plays a meditation and a soundscape with the screen locked on a real iPhone.
- [ ] Version page: build selected, screenshots, description, keywords, support URL, copyright.
- [ ] App Information: categories, content rights, age rating.
- [ ] App Privacy: "Data Not Collected", then **Publish**.
- [ ] Regulated medical device: **No**.
- [ ] Pricing and Availability: Free.
- [ ] App Review notes pasted. A screen recording is attached if Apple asks for one.
- [ ] **Add for Review → Submit to App Review**.

## Build and upload

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

On the first run, EAS asks which Expo account owns the project. You're signed in to two, `preston5` and `prestonbuilds`. Whatcha Eatin' uses `preston5`, so pick that one unless you want this app under the other account. EAS then asks to sign in to Apple and creates the signing certificate, provisioning profile and App Store Connect record. Commit the `extra.eas.projectId` it adds to `app.json`.

## URLs

| Field | Value |
| --- | --- |
| Privacy Policy URL | https://pdavies88.github.io/relaxation-station/privacy/ |
| Support URL | https://pdavies88.github.io/relaxation-station/support/ |
| Marketing URL (optional) | https://pdavies88.github.io/relaxation-station/ |

The app links to the privacy policy and support page from its **About** tab, as Apple requires.

## App information

| Field | Value | Limit |
| --- | --- | --- |
| Name | Relaxation Station | 30 |
| Subtitle | Meditation & Sounds | 30 |
| Primary category | Health & Fitness | |
| Secondary category | Lifestyle | |
| Content rights | No, it does not contain, show or access third-party content | |
| Copyright | 2026 Preston Davies | |
| Price | Free | |

### Promotional text (170 characters)

```
15 free guided meditations and 12 soothing soundscapes. No account, no subscription, and it works completely offline, even in airplane mode.
```

### Description (4,000 characters)

```
Relaxation Station helps you slow down, breathe and fall asleep. Everything is free, and everything works offline.

GUIDED MEDITATIONS
15 calm, gently paced sessions in five categories:
- Sleep: wind down and let the day go
- Stress Relief: loosen the grip of a busy mind
- Breathing: steady your breath with box breathing and longer exhales
- Body Scan: release tension from head to toe
- Focus: clear the noise before you begin something important
Each category has a 3, 5 and 10 minute session, so there's always one that fits.

SOOTHING SOUNDSCAPES
12 sounds that play on a seamless loop until you stop them, like a sound machine on your nightstand:
Gentle Rain, Wind Chimes, Ocean Waves, Music Box Lullaby, Heartbeat, Crackling Fire, Guitar Lullaby, Box Fan, Brown Noise, Relaxing Bells, Car Ride and Gentle Shush. Car Ride and Gentle Shush are made to help little ones nap.

PLAYS WITH YOUR SCREEN LOCKED
Start a sound, lock your phone and drift off. Pause or stop from the lock screen whenever you like.

PRIVATE AND OFFLINE
- No account or sign-up
- No ads, tracking or analytics
- No internet needed: every meditation and sound is built into the app
- Nothing you do in the app leaves your phone

The meditations are for relaxation and general wellbeing. They are not medical advice or treatment.
```

### Keywords (100 characters, comma-separated, no spaces after commas)

```
meditation,sleep sounds,rain,brown noise,relax,calm,breathing,mindfulness,stress,sound machine,nap
```

## App Privacy questionnaire

App Store Connect → **App Privacy → Get Started**.

1. **Do you or your third-party partners collect data from this app?** **No, we do not collect data from this app.**
2. Click **Publish**.

The label then shows **Data Not Collected**. This matches the app's privacy manifest, which declares no collected data types. The app has no network code, accounts, analytics or ads.

## Age rating

Answer **None** or **No** to every content question: violence, sexual content, profanity, drugs, gambling, horror and so on. Then:

| Question | Answer | Why |
| --- | --- | --- |
| Medical or Treatment Information | **None** | It offers relaxation, not diagnosis or treatment. |
| Health or Wellness Topics | **Yes** | Meditation and sleep are wellness topics. |
| Unrestricted web access | No | It only opens its own privacy and support pages. |
| User-generated content, messaging, advertising | No | |

Expected result: the lowest age rating (4+).

**Regulated medical device** (EU, UK, US): **No**.

## App Review information

| Field | Value |
| --- | --- |
| Sign-in required | No |
| Contact name, phone and email | Yours. Apple uses these only to reach you. |

### Notes

These notes answer Apple's six standard questions for new submissions up front. Paste them into the **Notes** field. If Apple asks for more information, paste them as your reply too. They're well under the 4,000 character limit.

```
1. SCREEN RECORDING
Available on request: a recording on a physical iPhone showing launch, playing a meditation, starting a soundscape, locking the screen while audio continues, and stopping playback from the lock screen. The app has no account registration or login, no user-generated content, and no paid content or in-app purchases.

2. PURPOSE AND AUDIENCE
Relaxation Station is a free meditation and sleep sounds app for anyone who wants to relax, manage everyday stress or fall asleep. It offers 15 guided meditations (Sleep, Stress Relief, Breathing, Body Scan and Focus, each in 3, 5 and 10 minute versions) and 12 looping soundscapes such as rain and ocean waves. Many apps in this space need accounts and subscriptions; this one is completely free, private, and works offline.

3. SETUP AND TEST INSTRUCTIONS
No login, keys or setup are needed. All audio is bundled in the app.
a. Launch the app. On the Meditate tab, tap any session, for example "Settle In" (3 min). The player opens and the meditation plays.
b. Lock the iPhone. The meditation keeps playing and shows Now Playing controls on the lock screen.
c. Unlock and tap "End session", or close the player with the X. Closing the player stops the meditation.
d. Open the Sounds tab and tap "Ocean Waves". It loops until stopped. Tap the tile again, or use the lock screen controls, to stop it.
e. The About tab links to the privacy policy and support page.

BACKGROUND AUDIO
The app uses the "audio" background mode so meditations and sleep soundscapes keep playing with the screen locked. This is the app's core purpose: users fall asleep to a soundscape.

4. EXTERNAL SERVICES
None. The app has no backend, network requests, authentication, payments, analytics, advertising or AI services. All meditations and sounds are bundled audio files.

5. REGIONAL DIFFERENCES
None. The app works the same in all regions.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
The app is not a medical device and makes no medical claims. It provides general relaxation content and states in the app that it is not medical advice or treatment.
All content was created for this app. The meditation scripts were written for it, and the narration was generated with the open-source Qwen3-TTS text-to-speech model (Apache 2.0 license, which permits commercial use). All music and soundscapes were synthesized for the app. No third-party copyrighted material is used.

Privacy policy: https://pdavies88.github.io/relaxation-station/privacy/
Support: https://pdavies88.github.io/relaxation-station/support/
```

### Screen recording, if Apple asks

Record on a physical iPhone running the latest iOS. Use Control Center → Screen Recording, or QuickTime with the iPhone connected.

1. On the Home Screen, tap the app icon.
2. Meditate tab: scroll the categories, then tap **Settle In**.
3. Lock the phone and wake it to show the lock screen controls with audio still playing. Unlock.
4. Tap **End session**, open **Sounds** and tap **Ocean Waves**. Lock the phone again to show it keeps playing, then stop it from the lock screen.
5. Open **About** and tap **Privacy policy**.

## Screenshots

All screenshots come from the iPhone 18 Pro Max simulator with a clean 9:41 status bar. Upload in this order:

1. `01-meditate.png`: hero, logo and the Sleep sessions
2. `02-player.png`: a 10-minute meditation playing
3. `03-sounds.png`: the soundscape grid with Ocean Waves playing
4. `04-player-dark.png`: dark mode meditation player
5. `05-meditate-dark.png`: dark mode hero

| Folder | Size | App Store Connect slot |
| --- | --- | --- |
| `screenshots/` | 1320 × 2868 | 6.9" display |
| `screenshots/6.3-inch/` | 1206 × 2622 | 6.1" / 6.3" display |

To retake them, run the app on the iPhone 18 Pro Max simulator. Set the status bar with `xcrun simctl status_bar booted override --time 9:41 --batteryState discharging --batteryLevel 100`. Save each screen with `xcrun simctl io booted screenshot <file>.png`, writing **outside** the project while Metro runs, because new files in the project reload the app. Make the 6.3" copies with `for f in 0*.png; do sips -z 2622 1206 "$f" --out "6.3-inch/$f"; done` from `store/screenshots/`.

## After approval

- If you chose manual release, click **Release This Version**.
- For each update, bump `version` in `app.json`. EAS raises the build number automatically.
