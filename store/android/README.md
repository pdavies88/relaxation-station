# Android: Google Play

Two ways to release:

- **Internal testing** (recommended to start). Up to 100 invited testers install from the Play Store and get updates automatically. It doesn't need the 12-tester closed test.
- **Production** (public). New personal accounts must first run a closed test with at least 12 testers opted in for 14 days in a row.

You already have a Play Console developer account and a verified Android device from Whatcha Eatin', so you can skip account setup. Play Console labels change often, so names below may differ slightly.

## 1. Create the app

**Home → Create app**:

| Field | Value |
| --- | --- |
| App name | Relaxation Station |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both |

The package name is `com.pdavies.relaxationstation`, set in `app.json`. It's permanent after the first upload.

## 2. Build

```bash
npx eas-cli@latest build --platform android --profile production
```

- On the first run, pick the same Expo account you used for the iOS build.
- Answer **Yes** to creating a new Android keystore. EAS keeps it, and every update must use the same key.
- Download the `.aab` from the link EAS prints.

## 3. Upload the first release

**Test and release → Testing → Internal testing**:

1. **Testers** tab: create or reuse an email list. Upload a CSV with one email per line and no header. Keep that file out of git. Tick the list.
2. **Releases** tab: **Create new release**. Accept Play App Signing, drag in the `.aab`, set the release name to `1.0.0` and click **Save and publish**.
3. **Publishing overview → Send changes for review.** A new app's first release is reviewed, even on internal testing.
4. Send testers the **Join on the web** link from the Testers tab. Google doesn't email them.

## 4. Main store listing

**Grow users → Store presence → Main store listing**:

| Field | Value |
| --- | --- |
| App name | `Relaxation Station` |
| Short description | `Free guided meditations and sleep sounds that work completely offline.` (70/80) |
| App icon | `play-icon-512.png` |
| Feature graphic | `feature-graphic-1024x500.png` |
| Phone screenshots | All five in `screenshots/` in number order (1320 × 2640) |

Full description: use the **Description** block from `../README.md`. It works for Android as written and is under 4,000 characters.

**Store settings:**

| Field | Value |
| --- | --- |
| Category | Health & Fitness |
| Tags | For example: Meditation, Sleep, Relaxation |
| Email | `preston5@protonmail.com` |
| Website | `https://pdavies88.github.io/relaxation-station/` |

## 5. App content

**Policy and programs → App content** (or the dashboard's **Set up your app** list):

| Form | Answer |
| --- | --- |
| Privacy policy | `https://pdavies88.github.io/relaxation-station/privacy/` |
| App access | All functionality is available without special access |
| Ads | No |
| Content rating | Category **All Other App Types**. Answer **No** to every question. Expected: Everyone / PEGI 3. |
| Target audience | **18 and over** is simplest. Younger groups bring the Families policy. The content is suitable for all ages, so you can widen this later if you accept those rules. |
| Data safety | **No**, the app doesn't collect or share any user data. |
| Health apps | Choose the meditation, mindfulness or sleep option. Choose none of the medical options. |
| Government app, financial features, news app | No / None |

### Foreground service permissions (required for this app)

Background playback runs as an Android **media playback foreground service**, so Play requires a declaration under **App content → Foreground service permissions**:

| Field | What to enter |
| --- | --- |
| Type | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` |
| Use case | Media playback (audio) |
| Functionality description | `Plays guided meditations and looping sleep soundscapes that the user starts. Playback continues when the screen is locked or the user switches apps, with pause and stop controls in a media notification.` |
| User impact if deferred or interrupted | `Audio the user started would stop or not start, for example the sleep sound they are falling asleep to would cut out.` |
| Video link | A short screen recording, uploaded as an unlisted YouTube video or a shared Google Drive link |

To record the video on an Android phone, use the Screen recorder in quick settings:

1. Open the app and tap a soundscape on the **Sounds** tab.
2. Press the power button to lock the screen, wait a few seconds, then wake it to show the notification and that audio is still playing.
3. Pause and stop from the notification.

## 6. Things to check on an Android phone

- Audio keeps playing with the screen off for longer than 3 minutes. Android stops background audio around then if the media notification isn't active.
- The first time you play something, Android 13 and later ask for notification permission. Allow it so the playback controls appear.
- Closing the player stops a meditation, tapping a playing sound tile stops it, and text isn't clipped.

## Going public later

Run a closed test with at least 12 testers for 14 days, then apply for production access in Play Console. The store listing and App content above carry over.
