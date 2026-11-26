# Daybreak

Daily routines that reset every morning, plus a full to-do list. Works as an installable web app (PWA) and as a native Android app with real alarms.

## Get the Android APK (no Android Studio needed)
1. Create a free GitHub account and a new empty repository.
2. Upload everything in this folder (drag & drop works).
3. Open the **Actions** tab, choose **Build Daybreak APK**, click **Run workflow**.
4. After ~6 minutes download `Daybreak-debug-apk` from the run, unzip it, and install `app-debug.apk` on your phone (allow "install unknown apps").
5. On first launch allow notifications. In Settings > Reminders tap **Allow** next to *Exact alarms* so reminders fire on time.

## Build locally
Install Node 20+, JDK 21 and Android Studio, then run `npm run build:android`.

## Use as a web app instead
Host the `www` folder over HTTPS (Netlify Drop, GitHub Pages, Cloudflare Pages), open it in Chrome and tap **Install**.
Web reminders only fire while the app is running; the Android build uses system alarms.

## Notes
- Reminders for the next 14 days are scheduled each time you open the app or change a task.
- Data lives on the device. Use Settings > Backup & restore to move it.
