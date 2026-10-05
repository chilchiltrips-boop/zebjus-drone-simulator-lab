# Aerion Flight Android — 18.3.66-android.3

Rebuilt with versionCode 1836603 and the same development certificate. This
update accompanies the web lab's fifth-position Python Lab and compact Wix
embed layout. The Android interface retains Controls, Safety and Wi-Fi;
advanced setup and Python continue in the web lab. Matching controller firmware 18.3.66 adds exclusive app simulator destinations.

An installable Android development app containing the Aerion Flight joystick screen. The interface is bundled with the APK and opens without internet, including on its first launch. It has no Python editor, camera stream or external JavaScript runtime.

## Install and connect

1. Install `dist/ZEBJUS_Aerion_V18_3_66_Android.apk` on an Android 8.0 or later phone. This development APK uses the same development certificate as the previous APK, so it can update that installation.
2. On **Android 10+**, open **Aerion Flight → Connect drone**. Enter the kit's complete Device ID from the case if it is a new pairing, then tap **Connect kit Wi-Fi**.
3. Allow **Nearby devices** on Android 13+; Android 10–12 needs the platform's Location permission for this Wi-Fi API. Choose the correct unique `ZEBJUS-FC-...` SSID in Android's connection dialog. The app supplies AP password the password shown on the kit label.
4. On connection, the app verifies the kit identity and shows its flight screen inside the same app. This explicit connection reserves a MOBILE session without RC frames or ARM. A laptop on the same AP becomes view-only. Tap **Take control**, then **ARM** manually when the controller is ready. **STOP** lowers throttle, disarms and releases control.
5. For **STA mode or Android 8–9**, use the separate **Phone Wi-Fi settings** button, join the appropriate network and return to the app. In AP mode, the address is `192.168.4.1`; in STA mode, enter the kit's local IP and tap **Check connection**.

മലയാളം: App തുറക്കുക → **Connect drone → Connect kit Wi-Fi** → Android dialog-ൽ ശരിയായ kit തിരഞ്ഞെടുക്കുക → app-ൽ തന്നെ flight screen. AP password on the kit label. Connection/permission dialog മാത്രം; flight control-നായി മറ്റൊരു browser തുറക്കുന്നില്ല. **Take control**, **ARM** സ്വയം നടക്കില്ല.

The V18.3.66 controller firmware migrates an older random AP password to the documented kit password on reboot after update. Its unique SSID and permanent Device ID are unchanged. Using the previous firmware will still require its old AP password; install the matching profile from this package.

### AP/STA and no browser redirect

V18.3.66 firmware AP is API only. Joining Wi-Fi does not serve a browser page or app-intent link. Open Aerion Flight and connect kit Wi-Fi in the app; Android may show its permission/connection dialog.

Top AP/STA actually changes the disarmed kit network mode. STA releases the AP-specific request and uses router Wi-Fi; phone and kit must join the same router. AP requests the correct kit SSID. Gear -> Wi-Fi selects saved profiles or saves new Wi-Fi entirely inside the app. Expected Device ID is retained; type a current local IP in Connect if saved/discovered addresses fail.

On initial app opening a MOBILE configuration reservation sends no RC. Take control starts transmission manually; STOP ends it. Native UDP publishes at 50 Hz independently of HTTP. Brief packet loss retries latest input while retaining throttle/ARM within the negotiated deadline; telemetry failure alone does not clear identity. Configuration-only release does not inject RC into PPM.

The left stick controls throttle and yaw. The right stick controls pitch and roll. Their side assignments stay fixed; **Floating centre** can be switched off in the small gear beside Take control. Throttle rises/falls gradually and holds on normal stick release; pitch, roll and yaw center. The header displays connection, control/armed state and ANGLE/RATE. Guarded Rate/Angle changes can run while armed when the matching firmware reports the capability. Automatic take-off/landing is not implemented.

## Compatible kit

This app uses the Aerion/ZEBJUS local Wi-Fi API from the V18.3.66 controller project. The controller must already expose:

- `GET /api/status?clientId=...`, including device identity, `flightReady`, `armed`, `flightMode` and `lockMine`.
- `GET /api/telemetry`.
- Form-encoded `POST /api/control/acquire`, `/api/control/ping`, `/api/control/release` and `/api/command`.
- Mutations guarded by `clientId` and `expectedDeviceId`; `type=rc_frame` with ten 1000–2000 channel values.

The APK does not flash firmware or add these APIs to an older controller. The Tello-inspired interface uses the existing Aerion kit protocol.

## What was checked

The APK was compiled to DEX with the official Android SDK 36 tools, aligned, and verified with APK Signature Scheme v2/v3. Bundled UI/transport bytes were compared with source. Native Java tests cover session ownership, lifecycle fencing, late/cancelled grants, old replies, the ACK watchdog and local-address policy. The actual bundled interface and transport adapter were exercised in Chromium with a simulated native bridge and controller API.

**No Android phone, Android emulator or physical drone was used for these checks.** Native Wi-Fi and WebView behavior still need an on-device test. Reports are in `dist/BUILD_REPORT.json`, `dist/APK_MANIFEST.txt` and `dist/APK_SIGNATURE.txt`. The delivered APK is non-debuggable but development-signed; it is a test build, not a published Play Store release.

## Android Studio / Gradle build

Open this folder in Android Studio with JDK 17, Android SDK Platform 36 and Build Tools 36.0.0 installed. The project includes Gradle Wrapper 8.13 and Android Gradle Plugin 8.13.2. The first Gradle build needs internet for tool downloads. This Gradle build path is included for future development; the delivered APK was built with the CLI path below.

```sh
./gradlew assembleRelease
```

Windows: `gradlew.bat assembleRelease`. The generated file is `app/build/outputs/apk/release/app-release.apk`.

The wrapper's distribution checksum is pinned. There are no third-party runtime app libraries. SDK/compiler/Chrome downloads are intentionally excluded from this source archive.

## CLI build used for this APK

With JDK 17, Python 3, official Android SDK tools and `ANDROID_SDK_ROOT` set, supply `AERION_DEVELOPMENT_STORE_PASSWORD` for the existing development certificate in your local build environment. Gradle signing uses the same environment variable:

```sh
python3 tools/build_apk.py
```

Or specify paths directly:

```sh
python3 tools/build_apk.py --build-tools /path/to/sdk/build-tools/36.0.0 --android-jar /path/to/sdk/platforms/android-36/android.jar
```

If the javac executable is absent but the JDK compiler module exists, the script uses java com.sun.tools.javac.Main. Otherwise add `--ecj /path/to/ecj-3.39.0.jar` from Eclipse/Maven Central. GitHub checks use `--verify-only` to recompile the resources, DEX and assets and compare every unsigned entry with the delivered signed APK; no signing credential is required for those checks. The build script compiles resources, stamps the manifest version/SDK fields, compiles Java, runs D8, aligns, signs and verifies the APK. Output is under `dist/`.

## Compact flight settings

The small gear beside **Take control** opens **Controls**, **Safety** and **Wi-Fi**. Controls changes only local stick feel. Safety shows live link/attitude/failsafe information and provides quick gyro/level calibration while disarmed. Full FC setup, ESC/motor tests, PID and PPM calibration live in the desktop web lab, not in the APK.

For the sixteen flight lessons, select Mode → Flight Training in the app and confirm propellers removed. Controls turn ON safely; ARM remains manual. Open the web Training page on the same kit network; it follows app ARM/sticks automatically without a web Enable button. Lower throttle and centre sticks if joining after ARM. Telemetry loss preserves lesson progress; neutral DISARM then ARM in the app resumes it. Ending training invalidates the native grant and requires Take control plus fresh manual ARM for real flight.

## Development signing

The APK uses the project's existing public development signing certificate, so it can update previous development installations. Use a separate private signing certificate for a production release; production builds cannot replace an existing development installation without uninstalling it. The signing configuration is maintained in the Android project.

## Transport and lifecycle

Only the local, bundled interface receives the nonce-protected Android bridge. The WebView serves assets at an HTTPS asset origin with file/content access and browser network fetches disabled. Native HTTP is limited to the expected local-kit API paths and private-network hosts; it is bound to the phone's Wi-Fi network, including Wi-Fi without internet. Redirects are rejected. External page navigation is blocked in this Android flight app.

Grants are scoped to kit address, Device ID, fresh client ID and Wi-Fi network. A private 64-bit token and increasing sequence protect 48-byte UDP frames. Only correctly scoped, fresh 28-byte controller ACKs refresh the watchdog. Latest UI input repeats at 50 Hz for at most 300 ms without fresh input. Genuine ACK loss fences after the negotiated deadline (900 ms maximum; legacy 300 ms). Pings cannot refresh an active RC watchdog.

Pause/focus loss/reload/network changes revoke the native grant. Safe UDP bursts and HTTP cleanup are attempted; delivery is not guaranteed after radio/process loss. Firmware centres directional RC at 300 ms and expires Web RC at 1 second. Foreground retry of previously enabled controls acquires a fresh same-device grant and restores sticks at throttle 0, DISARMED; ARM is manual. STOP/background/reload cancel recovery. Returning from background stays read-only. See [update/test guide](../SUPPORT/V18_3_66_UPDATE_AND_TEST.md).

## Re-run focused tests

Native policy tests, using a JDK:

```sh
mkdir -p build/core-tests
javac -d build/core-tests app/src/main/java/in/zebjus/aerion/LeaseGate.java app/src/main/java/in/zebjus/aerion/LocalPolicy.java app/src/main/java/in/zebjus/aerion/LaunchPolicy.java app/src/main/java/in/zebjus/aerion/NativeRcStream.java tests/LeaseGateTest.java tests/NativeRcStreamTest.java
java -cp build/core-tests in.zebjus.aerion.LeaseGateTest
java -cp build/core-tests in.zebjus.aerion.NativeRcStreamTest
```

Browser adapter tests require Node and Playwright. Set `ZEBJUS_CHROMIUM` to a Chrome/Chromium executable if Playwright's browser is not installed:

```sh
node tests/browser_transport_test.js
```

Official references: [local WebView content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), [Wi-Fi-specific connections](https://developer.android.com/reference/android/net/Network#openConnection(java.net.URL)), [APK signing verification](https://developer.android.com/tools/apksigner).

App home Mode: choose **Real flight**, **Tripod simulator**, or **Flight Training**. Simulation requires propeller removal and blocks real motor outputs. The selected web simulator follows app ARM and joysticks in view-only mode. Switching destination resets throttle and requires manual ARM; both simulators never receive app flight input together. See the update/test guide for matching APK and firmware installation.

Android r3 fixes paused same-session native control renewal after changing training destination. The app/web integration test now runs the production Java grant policy. Old status/telemetry replies cannot stop a newer transmitter or destination. The installed browser Flight UI uses local-address-space requests.

For AP firmware OTA, use the web lab Firmware page: load the matching APP image while internet is available, download it, then join the kit AP. Import accepts files regardless of OS MIME classification and validates their extension, image header and board profile. Auto Load falls back to this browser's cached image when the internet is unavailable. Factory images remain USB-only.
