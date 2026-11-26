#!/usr/bin/env bash
# Builds a debug APK. Needs Node 20+, JDK 21 and the Android SDK (Android Studio installs both).
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
[ -d android ] || npx cap add android
npx capacitor-assets generate --android --iconBackgroundColor '#1d1760' --splashBackgroundColor '#1d1760' --splashBackgroundColorDark '#1d1760'
python3 scripts/patch_manifest.py
npx cap sync android
(cd android && ./gradlew assembleDebug)
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
