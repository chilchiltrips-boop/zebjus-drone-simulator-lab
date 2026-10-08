# ZEBJUS V18.3.60 — AP password and Android app

AP password is **12345678**. Each controller keeps its permanent Device ID and its unique `ZEBJUS-FC-<12-hex>` SSID. Installing this firmware migrates the former saved random AP password on the first reboot; NVS is written only when the saved value differs. AP/STA persistence, control ownership and physical flight logic are retained.

## Android phone flow

Install `android-app/dist/ZEBJUS_Aerion_V18_3_60_Android.apk`. On Android 10+, open Aerion Flight → Connect drone → Connect kit Wi-Fi. Accept the system Wi-Fi/permission dialog and choose the kit. The app supplies 12345678, verifies Device ID over its Wi-Fi-specific native transport and displays the bundled flight screen. Verification and reconnection do not acquire control or ARM automatically.

Android 13+ requests Nearby devices; Android 10–12 needs Location permission for the Wi-Fi network request API. STA mode and Android 8–9 use Phone Wi-Fi settings, followed by return to the same app. The flight screen opens no external browser. Wi-Fi/hardware setup continues to be available in the laptop WebApp.

If a phone joins the AP manually, its captive page offers Open Aerion Flight app through a package-specific Android intent link. The app-link handler accepts only a kit ID and private local address, fences existing outputs, rejects a link for a different saved kit and performs read-only verification. A captive window may block app links; opening the app icon remains the fallback. Android does not guarantee launching an app immediately after Wi-Fi is joined from system Settings. Use the app's connection flow to avoid an additional flight browser window.

## Firmware images

- ZFC-A1 APP/FACTORY images are for the A1 bridge profile.
- ZFC-A2 APP/FACTORY images are for the Aerion F1 flight-controller profile.
- APP images are for matching-layout OTA at 0x10000. FACTORY images contain the bootloader/partitions and are flashed at 0x0 by the board-aware USB updater. They are distinct files and must not be interchanged.

Both profiles were compiled with Arduino-ESP32 3.3.12. Verification covers release text, chip ID, dual OTA slots, size and equality of the APP content inside the FACTORY image. The build report is `FlightCore_Firmware/build-report.json` and catalog checksums are updated.

## GitHub upload

Extract the upload ZIP. Open repository root → Add file → Upload files. Upload **the files/folders inside UPLOAD_01**, commit, then repeat each remaining batch. Do not upload the ZIP or the UPLOAD_XX wrapper folder. Each batch preserves exact repository paths, contains at most 100 files and stays below 14.5 MB raw size. Existing root paths are replaced; new Android sources live under `android-app/`.

GitHub Actions includes the existing firmware build and a new **Build Aerion Android APK** workflow. After all batches are committed, you can run either workflow manually. The Android workflow uploads an APK artifact rather than publishing an app store release. Its GitHub-hosted run has not been executed here; native compilation and package checks were run locally.

## Verification boundary

The development-signed APK was compiled and verified with official Android tools. Native JVM policy tests and the actual bundled UI/transport adapter in Chromium passed, using a simulated native bridge/controller radio. No Android phone, Android emulator, USB/OTA hardware operation, physical Wi-Fi radio or drone flight was tested here. Phone Wi-Fi approvals, intent handoff and real kit operation require on-device verification. The included development keystore is public test signing, not a private production key.

Primary Android references: [Wi-Fi request API](https://developer.android.com/develop/connectivity/wifi/wifi-bootstrap), [Wi-Fi permissions](https://developer.android.com/develop/connectivity/wifi/wifi-permissions), [background activity restrictions](https://developer.android.com/guide/components/activities/secure-bal), [Chrome intent user-gesture rules](https://developer.chrome.com/docs/android/intents).
