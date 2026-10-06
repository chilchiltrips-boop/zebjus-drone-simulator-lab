# Aerion Flight Android — 18.3.69-android.1

VersionCode 1836901. Install `dist/ZEBJUS_Aerion_V18_3_69_Android.apk` over the previous development app; the signing certificate is unchanged. Flash matching controller firmware 18.3.69 for A1 or A2.

## Connect and practise

Open Connect drone → Connect kit Wi-Fi. Choose the kit network using its label. In STA mode join the same router and use the kit IP. Native requests are bound to the Wi-Fi network, including Wi-Fi without internet.

App home has **Tripod**, **Flight Training** and **Real Joystick** buttons. Tap a simulator to enable controls at throttle 0%, DISARMED. Open its web page on a computer connected to the same kit, then manually ARM the virtual drone in the app. No web Enable or simulator propeller checkbox is required. Both A1/C3 and A2/C6 support virtual practice without a ready IMU. Physical outputs remain DISARMED and blocked.

The matching APK and firmware negotiate **ZRC2 simulator UDP at 50 Hz**. Native publication and ACKs continue independently of HTTP status/settings. Version 2 / kind 2 frames and simulation ACKs are bound to the verified Device ID and a fresh private token. Switching destinations or ending training invalidates that token. Simulation never arms physical outputs. The normal 300 ms input and 900 ms UDP ACK watchdogs remain active. Older firmware/browser clients retain the verified HTTP fallback.

Foreground link recovery restores the selected simulator at throttle 0%, DISARMED; manual ARM is required. STOP and background cancel flight recovery. Web setup configuration can continue in another tab; active motor/ESC output stops when its page is hidden.

Real Joystick retains the supported physical A2 profile and native 50 Hz UDP transport. It needs a ready IMU/calibration, explicit Take control and manual ARM. Controls settings adjust stick feel; physical setup and calibration keep their guards.

## Build and verify

With JDK 17 and official Android SDK 36 tools, set `ANDROID_SDK_ROOT` and the existing signing configuration in `AERION_DEVELOPMENT_STORE_PASSWORD`, then run `python3 tools/build_apk.py`. Gradle uses the same version/signing configuration. `--verify-only` recompiles resources, DEX and assets and compares them with the delivered APK without requiring a signing credential.

Java tests cover grant scope, cancellation, old replies, watchdogs, UDP ACK scope/replay/loss and STOP. Browser tests use the actual bundled UI/adapter and web lab against a simulated kit; firmware host tests execute actual simulator/PWM guards. No Android phone/emulator or physical drone was tested.

See [update/test guide](../SUPPORT/V18_3_69_UPDATE_AND_TEST.md) for installation and exact test boundaries.
