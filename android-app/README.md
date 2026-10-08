# Aerion Flight Android — 18.3.81-android.1

VersionCode 1838101. Install `dist/ZEBJUS_Aerion_V18_3_81_Android.apk` over the previous development app; the signing certificate is unchanged. Install matching controller firmware 18.3.81 to enable automatic AP authentication and password 12345678.

Read the [18.3.81 update and connection guide](../SUPPORT/V18_3_81_UPDATE.md) first. Old APKs cannot control secure firmware. The AP uses the Kit Name and password 12345678; AP authentication is automatic. Router/STA mode keeps the owner code from the physical label/USB serial output. Training requires STA and a live paired kit; app invitations pair permitted laptop companions.

The launcher and startup use the new geometric Z/quad-rotor Aerion Drone Lab mark. A five-second intro appears on app launch; reduced-motion uses a static intro. It does not transmit RC or replay on ordinary resume.

## Connect and practise

Open Connect drone → **Real flight · Kit AP** for the kit network, or **Router Wi-Fi · STA** to release an old native AP binding and use the same router as the STA kit and computer. If no router is connected, open Phone Wi-Fi settings and return. Enter the Kit Name and kit router IP from the WebApp, then Check connection. Browser routing is automatic; there is no Device ID or WebApp ID entry. Updating the signed APK retains pairing and saved settings. Native requests are bound to the Wi-Fi network, including Wi-Fi without internet.

App home has joystick controls. Start Tripod or Flight Training from the connected WebApp; firmware confirms the paired browser request and the foreground Android app automatically enables the simulator stream at throttle 0%, DISARMED. Manually ARM the virtual drone in the app. Both A1/C3 and A2/C6 support virtual practice without a ready IMU. Physical outputs remain DISARMED and blocked. Web STOP ends the simulator stream and returns the app to a safe, connected reservation.

Tripod and Flight Training use **ZFC3-wrapped native simulator UDP at 50 Hz** with an exact Device ID/run grant and inhibited physical outputs. The web lab uses a separate **encrypted ZFC3 NDJSON monitor on port 4211 at 10 Hz**. HTTP does not pace either end. Real flight also uses encrypted native UDP, the existing 300 ms soft-stale / 900 ms hard input watchdog and 900 ms ACK deadline. Simulation input is neutral after 300 ms and fenced after 900 ms; ACK gaps retain the inhibited session for 8 seconds and require a fresh manual ARM after recovery. Destination changes reset throttle and require manual ARM.

Kit settings includes Flight recorder: capture received channels, selection/recovery events, native stop reasons and transport diagnostics; mark an issue and export JSON for ChatGPT or numerical CSV after a test. Opening settings and the Android export picker pauses control. Export the web Telemetry report as well to compare both observers by Device ID and UTC time.

An input gap neutralizes simulator controls; recovery requires manual ARM. A stopped or expired run must be started again from the WebApp. STOP and background cancel flight recovery. Web setup configuration can continue in another tab; active motor/ESC output stops when its page is hidden.

Real Joystick retains the supported physical A2 profile and native 50 Hz UDP transport. It needs a ready IMU/calibration, explicit Take control and manual ARM. Controls settings adjust stick feel; physical setup and calibration keep their guards.

## Build and verify

With JDK 17 and official Android SDK 36 tools, set `ANDROID_SDK_ROOT` and the existing signing configuration in `AERION_DEVELOPMENT_STORE_PASSWORD`, then run `python3 tools/build_apk.py`. Gradle uses the same version/signing configuration. `--verify-only` recompiles resources, DEX and assets and compares them with the delivered APK without requiring a signing credential.

Java tests cover grant scope, cancellation, old replies, watchdogs, UDP ACK scope/replay/loss and STOP. Browser tests use the actual bundled UI/adapter and web lab against a simulated kit; firmware host tests execute actual simulator/PWM guards. No Android phone/emulator or physical drone was tested.

See [update/test guide](../SUPPORT/STAGED_KIT_RELEASES.md) for installation and exact test boundaries.
