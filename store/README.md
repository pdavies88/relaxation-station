# App Store release kit

Everything App Store Connect asks for, ready to paste. Fill these in on the **website** (appstoreconnect.apple.com → Apps → Relaxation Station). The App Store Connect iPhone app can't edit versions.

## Go-live checklist

- [ ] Repo is public and GitHub Pages serves `docs/`, so the URLs below open.
- [ ] A TestFlight build plays a meditation and a soundscape with the screen locked on a real iPhone.
- [ ] Version page: build selected, iPhone and iPhone Duo screenshots, promotional text, What's New, description, keywords, support URL, copyright.
- [ ] App Information: categories, content rights, age rating.
- [ ] App Privacy: "Data Not Collected", then **Publish**.
- [ ] Regulated medical device: **No**.
- [ ] Pricing and Availability: Free.
- [ ] Screen recording from a physical iPhone attached in App Review Information, and the App Review notes pasted.
- [ ] **Add for Review → Submit to App Review**.

## Build and upload

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

Version 1.2.0 is the Expo SDK 58 build. `eas.json` pins the production iOS build to the `sdk-58` image, which uses Xcode 27.1 and the iOS 27.1 SDK. Apple treats only builds from Xcode 27.1 or later as iPhone Duo-optimized. Check the **Spin up build environment** step in the EAS log to confirm the Xcode version.

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
Now optimized for iPhone Duo. 15 free guided meditations and 12 soothing soundscapes. No account, no subscription, and it works completely offline.
```

### What's New in 1.2.1 (4,000 characters)

```
Relaxation Station is now optimized for iPhone Duo. Use it folded or unfolded, upright or sideways, and it fills the screen you are using.

You can now turn any iPhone sideways, too. In landscape the player shows its controls beside the breathing orb, and meditations and sounds keep playing as the screen rotates.

Also updated for iOS 27.
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

These notes answer Apple's six "Guideline 2.1 - Information Needed" questions for new developer accounts up front, so App Review doesn't have to ask. Before you submit, record the screen recording below and attach it in **App Review Information → Attachment**. Then paste this text into the **Notes** field. If Apple still asks for information, paste the same text as your reply and attach the recording again. The text is about 3,000 characters, under the 4,000 limit.

```
WHAT'S NEW IN 1.2.1
- Optimized for iPhone Duo. The layout adapts to the inner and outer displays, folded or unfolded. On the unfolded display the tab bar runs down the right edge and the player opens as a sheet.
- The app now rotates on every iPhone. In landscape the player shows the controls beside the breathing orb, so every control stays on screen.
- Built with the iOS 27.1 SDK.

1. SCREEN RECORDING
Attached: a recording on a physical iPhone running the latest iOS, starting from launch. It shows playing a meditation, locking the screen while audio continues, the lock screen controls, starting and stopping a soundscape, and the About tab. The app has no account registration or login, no user-generated content, and no paid content or in-app purchases.

2. PURPOSE AND AUDIENCE
Relaxation Station is a free meditation and sleep sounds app for anyone who wants to relax, manage everyday stress or fall asleep. It offers 15 guided meditations written and narrated for this app (Sleep, Stress Relief, Breathing, Body Scan and Focus, each in 3, 5 and 10 minute versions) and 12 looping soundscapes made for it, such as rain and ocean waves. Most apps in this category require an account, a subscription or an internet connection. This one is completely free, has no ads or tracking, and plays everything offline.

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
All content was created for this app. The meditation scripts were written for it, and the narration was generated with the open-source Qwen3-TTS text-to-speech model (Apache 2.0 license, which permits commercial use). All music and soundscapes were synthesized for the app. "Music Box Lullaby" is a new recording of Brahms' Lullaby (1868), which is in the public domain. No third-party copyrighted material is used.
```

### Screen recording to attach

Record on a physical iPhone running the latest iOS, in about 2 minutes. Install the submitted build from TestFlight first.

1. Add **Screen Recording** to Control Center (Settings → Control Center) if it isn't there. Start a recording from Control Center.
2. On the Home Screen, tap the app icon.
3. Meditate tab: scroll the categories, then tap **Settle In**.
4. Lock the phone, then wake it to show the lock screen controls with audio still playing. Unlock.
5. Turn the phone sideways to show the player in landscape, then turn it back.
6. Tap **End session**, open **Sounds** and tap **Ocean Waves**. Lock the phone again to show it keeps playing, then stop it from the lock screen.
7. Open **About** and tap **Privacy policy**.
8. Stop the recording. It's saved to Photos. AirDrop it to your Mac and attach it in App Store Connect. If the file is too large, export a 1080p copy with QuickTime (File → Export As).

## Screenshots

All screenshots come from a Release build of version 1.2.0 with a clean 9:41 status bar, captured on October 26, 2026. A Release build shows no developer banner. Upload each set in this order:

1. `01-meditate.png`: hero, logo and the Sleep sessions
2. `02-player.png`: a 10-minute meditation playing
3. `03-sounds.png`: the soundscape grid with Ocean Waves playing
4. `04-player-dark.png`: dark mode meditation player
5. `05-meditate-dark.png`: dark mode hero

| Folder | Size | App Store Connect slot |
| --- | --- | --- |
| `screenshots/` | 1320 × 2868 | 6.9" display, from the iPhone 18 Pro Max simulator |
| `screenshots/6.3-inch/` | 1206 × 2622 | 6.1" / 6.3" display, resized from the 6.9" set |
| `screenshots/iphone-duo/` | 2853 × 2007 | iPhone Duo, the unfolded inner display in landscape |

### iPhone Duo screenshots

Uploading the `iphone-duo/` set adds a badge to the product page saying the app is optimized for iPhone Duo. From April 2027, every submission must include iPhone Duo screenshots. Check the 2853 × 2007 size against App Store Connect's iPhone Duo specifications before you upload.

Unfolded, the tabs run down the right edge, and the player opens as a sheet beside the Meditate list. The Sounds grid shows three columns.

### Retaking screenshots

1. Build a Release version: `npx expo run:ios --configuration Release --device <UDID>`. Install the same `.app` on the other simulator with `xcrun simctl install <UDID> <path to RelaxationStation.app>`.
2. Unfold the iPhone Duo simulator in Device Hub before you launch the app.
3. Set the status bar with `xcrun simctl status_bar <UDID> override --time 9:41 --batteryState discharging --batteryLevel 100`.
4. Switch themes with `xcrun simctl ui <UDID> appearance dark` or `light`.
5. Save each screen with `xcrun simctl io <UDID> screenshot <file>.png`. Write outside the project if Metro is running, because new files in the project reload a debug app.
6. Make the 6.3" copies with `for f in 0*.png; do sips -z 2622 1206 "$f" --out "6.3-inch/$f"; done` from `store/screenshots/`.

For the player shots, tap the forward button eight times so the progress bar reads about 2:15.

## iPhone Duo

Apple treats a build as optimized for iPhone Duo when it's made with Xcode 27.1 (the iOS 27.1 SDK) or later. Older builds run in a smaller window on the inner display.

What the app does on iPhone Duo:

- **Inner display:** the app fills the screen. Content stays centered with a maximum width of 800 points, and the tabs run down the right edge.
- **Landscape:** the hero shrinks, and the player puts its controls beside the orb, so nothing needs a scroll. Checked on the iPhone 18 Pro Max simulator. The Duo's outer display in landscape uses the same layout but hasn't been checked on the simulator yet.
- **Cold launch while unfolded:** `patches/react-native-screens+4.30.0.patch` makes the tab bar appear. Without it, the tab bar is missing until the device folds or rotates. See the main README.
- **Not yet tested:** the outer display in landscape, and folding while a meditation plays.

## After approval

- If you chose manual release, click **Release This Version**.
- For each update, bump `version` in `app.json`. EAS raises the build number automatically.
