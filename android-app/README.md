# Aerion Flight Android — 18.3.75-android.1

VersionCode 1837501. Install `dist/ZEBJUS_Aerion_V18_3_75_Android.apk` over the previous development app; the signing certificate is unchanged. Flash matching controller firmware 18.3.75 for A1 or A2.

## Connect and practise

Open Connect drone → Connect kit Wi-Fi. Choose the kit network using its label. In STA mode join the same router and use the kit IP. Native requests are bound to the Wi-Fi network, including Wi-Fi without internet.

App home has **Tripod**, **Flight Training** and **Real Joystick** buttons. Tap a simulator to enable controls at throttle 0%, DISARMED. Open its web page on a computer connected to the same kit, then manually ARM the virtual drone in the app. No web Enable or simulator propeller checkbox is required. Both A1/C3 and A2/C6 support virtual practice without a ready IMU. Physical outputs remain DISARMED and blocked.

Tripod and Flight Training use **native ZRC2 UDP at 50 Hz** with an exact Device ID/run grant and inhibited physical outputs. The web lab uses a separate **NDJSON1 monitor on port 4211 at 25 Hz**. HTTP does not pace either end. Real flight retains native ZRC1, the 300 ms input watchdog and 900 ms ACK deadline. Destination changes reset throttle and require manual ARM.

Kit settings includes Flight recorder: capture received channels, selection/recovery events, native stop reasons and transport diagnostics; mark an issue and export JSON for ChatGPT or numerical CSV after a test. Opening settings and the Android export picker pauses control. Export the web Telemetry report as well to compare both observers by Device ID and UTC time.

Foreground link recovery restores the selected simulator at throttle 0%, DISARMED; manual ARM is required. STOP and background cancel flight recovery. Web setup configuration can continue in another tab; active motor/ESC output stops when its page is hidden.

Real Joystick retains the supported physical A2 profile and native 50 Hz UDP transport. It needs a ready IMU/calibration, explicit Take control and manual ARM. Controls settings adjust stick feel; physical setup and calibration keep their guards.

## Build and verify

With JDK 17 and official Android SDK 36 tools, set `ANDROID_SDK_ROOT` and the existing signing configuration in `AERION_DEVELOPMENT_STORE_PASSWORD`, then run `python3 tools/build_apk.py`. Gradle uses the same version/signing configuration. `--verify-only` recompiles resources, DEX and assets and compares them with the delivered APK without requiring a signing credential.

Java tests cover grant scope, cancellation, old replies, watchdogs, UDP ACK scope/replay/loss and STOP. Browser tests use the actual bundled UI/adapter and web lab against a simulated kit; firmware host tests execute actual simulator/PWM guards. No Android phone/emulator or physical drone was tested.

See [update/test guide](../SUPPORT/STAGED_KIT_RELEASES.md) for installation and exact test boundaries.
