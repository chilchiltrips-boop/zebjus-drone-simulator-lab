# Aerion Flight Android — 18.3.61-android.1

An installable Android development app containing the Aerion Flight joystick screen. The interface is bundled with the APK and opens without internet, including on its first launch. It has no Python editor, camera stream or external JavaScript runtime.

## Install and connect

1. Install `dist/ZEBJUS_Aerion_V18_3_61_Android.apk` on an Android 8.0 or later phone. This development APK uses the same development certificate as the previous APK, so it can update that installation.
2. On **Android 10+**, open **Aerion Flight → Connect drone**. Enter the kit's complete Device ID from the case if it is a new pairing, then tap **Connect kit Wi-Fi**.
3. Allow **Nearby devices** on Android 13+; Android 10–12 needs the platform's Location permission for this Wi-Fi API. Choose the correct unique `ZEBJUS-FC-...` SSID in Android's connection dialog. The app supplies AP password **`12345678`**.
4. On connection, the app verifies the kit identity and shows its flight screen inside the same app. This explicit connection reserves a MOBILE session without RC frames or ARM. A laptop on the same AP becomes view-only. Tap **Take control**, then **ARM** manually when the controller is ready. **STOP** lowers throttle, disarms and releases control.
5. For **STA mode or Android 8–9**, use the separate **Phone Wi-Fi settings** button, join the appropriate network and return to the app. In AP mode, the address is `192.168.4.1`; in STA mode, enter the kit's local IP and tap **Check connection**.

മലയാളം: App തുറക്കുക → **Connect drone → Connect kit Wi-Fi** → Android dialog-ൽ ശരിയായ kit തിരഞ്ഞെടുക്കുക → app-ൽ തന്നെ flight screen. AP password **12345678**. Connection/permission dialog മാത്രം; flight control-നായി മറ്റൊരു browser തുറക്കുന്നില്ല. **Take control**, **ARM** സ്വയം നടക്കില്ല.

The V18.3.61 controller firmware migrates an older random AP password to `12345678` on reboot after update. Its unique SSID and permanent Device ID are unchanged. Using the previous firmware will still require its old AP password; install the matching profile from this package.

### Opening the app from a manually joined AP

On an Android phone, the controller's AP root/captive page displays **Open Aerion Flight app**, using a package-specific Android intent link. Tapping it opens this APK and passes the Device ID and local IP. Some captive Wi-Fi windows block external app links; in that case, open the app from its icon. The link is read-only and cannot replace an existing different paired Device ID or start flight outputs.

**Connecting Wi-Fi in system Settings cannot reliably launch an app automatically.** Android restricts background activity launches and browsers require a user gesture for app intent links. The supported way to avoid a separate flight browser window is to connect kit Wi-Fi from inside the installed app. A system permission or Wi-Fi approval dialog can still appear. No background notification service or automatic launch bypass is included.

Kit Wi-Fi/hardware configuration links are hidden in the Android flight screen so it does not launch an external browser. The top AP/STA button and gear provide Wi-Fi, controller limits, PID, calibration, backup/restore and diagnostics inside the app. Kit configuration changes require ownership and disarmed motors.

The left stick controls throttle and yaw. The right stick controls pitch and roll. Their side assignments stay fixed; **Floating joysticks** can be switched off in Settings. Throttle rises/falls gradually and holds on normal stick release; pitch, roll and yaw center. The header displays connection, control/armed state and ANGLE/RATE. Guarded Rate/Angle changes can run while armed when the matching firmware reports the capability. Automatic take-off/landing is not implemented.

## Compatible kit

This app uses the Aerion/ZEBJUS local Wi-Fi API from the V18.3.61 controller project. The controller must already expose:

- `GET /api/status?clientId=...`, including device identity, `flightReady`, `armed`, `flightMode` and `lockMine`.
- `GET /api/telemetry`.
- Form-encoded `POST /api/control/acquire`, `/api/control/ping`, `/api/control/release` and `/api/command`.
- Mutations guarded by `clientId` and `expectedDeviceId`; `type=rc_frame` with ten 1000–2000 channel values.

The APK does not flash firmware or add these APIs to an older controller. The Tello-inspired interface uses the existing Aerion kit protocol.

## What was checked

The APK was compiled to DEX with the official Android SDK 36 tools, aligned, and verified with APK Signature Scheme v2/v3. Bundled UI/transport bytes were compared with source. Native Java tests cover session ownership, lifecycle fencing, late/cancelled grants, old replies, the ACK watchdog and local-address policy. The actual bundled interface and transport adapter were exercised in Chromium with a simulated native bridge and controller API.

**No Android phone, Android emulator or physical drone was used for these checks.** Native Wi-Fi and WebView behavior still need an on-device test. Reports are in `dist/BUILD_REPORT.json` and `VERIFICATION.json`. The delivered APK is non-debuggable but development-signed; it is a test build, not a published Play Store release.

## Android Studio / Gradle build

Open this folder in Android Studio with JDK 17, Android SDK Platform 36 and Build Tools 36.0.0 installed. The project includes Gradle Wrapper 8.13 and Android Gradle Plugin 8.13.2. The first Gradle build needs internet for tool downloads. This Gradle build path is included for future development; the delivered APK was built with the CLI path below.

```sh
./gradlew assembleRelease
```

Windows: `gradlew.bat assembleRelease`. The generated file is `app/build/outputs/apk/release/app-release.apk`.

The wrapper's distribution checksum is pinned. There are no third-party runtime app libraries. SDK/compiler/Chrome downloads are intentionally excluded from this source archive.

## CLI build used for this APK

With JDK 17, Python 3, official Android SDK tools and `ANDROID_SDK_ROOT` set:

```sh
python3 tools/build_apk.py
```

Or specify paths directly:

```sh
python3 tools/build_apk.py --build-tools /path/to/sdk/build-tools/36.0.0 --android-jar /path/to/sdk/platforms/android-36/android.jar
```

If only a Java runtime is available, add `--ecj /path/to/ecj-3.39.0.jar` from Eclipse/Maven Central. The build script compiles resources, stamps the manifest version/SDK fields, compiles Java, runs D8, aligns, signs and verifies the APK. Output is under `dist/`.

## Development signing

The included `signing/aerion-development.p12` is a **public development key**. Its alias, store password and key password are `aerion-development`. It permits future development builds to update this test app without changing its signing certificate. It is not a private production key. Generate and keep a separate private keystore for a production release, and update the signing configuration before publishing. Production-key builds cannot replace an already installed development-key build under the same package without uninstalling it.

## Transport and lifecycle

Only the local, bundled interface receives the nonce-protected Android bridge. The WebView serves assets at an HTTPS asset origin with file/content access and browser network fetches disabled. Native HTTP is limited to the expected local-kit API paths and private-network hosts; it is bound to the phone's Wi-Fi network, including Wi-Fi without internet. Redirects are rejected. External page navigation is blocked in this Android flight app.

Control grants are scoped to kit address, Device ID, a fresh control client ID and Wi-Fi network. App pause, loss of focus, document reload and Wi-Fi changes revoke the native grant. A separate native watchdog revokes it if successful RC acknowledgements stop for more than 300 ms and attempts a captured safe frame and release. These attempts cannot be guaranteed after radio loss or process termination; the controller's own stale-RC failsafe remains necessary. Returning to the app reads telemetry but requires manual control and ARM again.

## Re-run focused tests

Native policy tests, using a JDK:

```sh
mkdir -p build/core-tests
javac -d build/core-tests app/src/main/java/in/zebjus/aerion/LeaseGate.java app/src/main/java/in/zebjus/aerion/LocalPolicy.java app/src/main/java/in/zebjus/aerion/LaunchPolicy.java tests/LeaseGateTest.java
java -cp build/core-tests in.zebjus.aerion.LeaseGateTest
```

Browser adapter tests require Node and Playwright. Set `ZEBJUS_CHROMIUM` to a Chrome/Chromium executable if Playwright's browser is not installed:

```sh
node tests/browser_transport_test.js
```

Official references: [local WebView content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), [Wi-Fi-specific connections](https://developer.android.com/reference/android/net/Network#openConnection(java.net.URL)), [APK signing verification](https://developer.android.com/tools/apksigner).
