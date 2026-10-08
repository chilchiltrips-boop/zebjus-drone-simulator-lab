# Aerion V18.3.62 — update and test guide

## Installation

Back up PID/calibration, stop outputs and confirm the controller profile. Install the matching V18.3.62 APP via the supported application/OTA route, or matching FACTORY image via full USB. Verify version, profile, permanent Device ID and settings after restart. A1 remains bridge-only; A2/Aerion F1 supports MPU6050 Rate/Angle. APP/FACTORY hashes, chip IDs and partition verification are in the firmware catalogs/build report.

Install android-app/dist/ZEBJUS_Aerion_V18_3_62_Android.apk. It uses the previous development certificate and a higher version code. Extract the complete updated WebApp and launch it locally, or load it and save a new verified browser offline copy.

GitHub upload alone does not flash/install software already running on the kit/phone. Old firmware will continue serving old AP pages until updated.

## AP, STA and ownership

AP unique SSID identifies the kit; password **12345678**. AP is API only, with no web page, catch-all DNS or captive redirect. Open the APK or laptop local/cached WebApp. The open laptop WebApp auto-discovers AP as an observer; joining Wi-Fi cannot launch closed software.

Top AP/STA changes the persistent mode while disarmed and bench outputs stopped. STA uses the preferred/current saved profile; choose/save Wi-Fi in settings if no profile is selected. Phone and kit must join the same router Wi-Fi. The APK releases the AP-specific network request when switching to router Wi-Fi and requests kit Wi-Fi when switching back. Android can require approval/settings actions. Laptop joins Wi-Fi through its OS. Reconnect preserves Device ID and rejects another kit at the same address.

An opened connected APK reserves MOBILE ownership without sending RC/ARM. Laptop is view-only; its transmitter indicator turns ON and mirrors received phone sticks. Fresh PPM also turns the display ON and follows the physical channels. Configuration-only release, including native lifecycle cleanup, does not inject Web RC into PPM.

WebApp top Take Control ON/OFF controls ownership. Local transmitter ON and ARM are separate. APK Take control starts flight transmission; STOP stops/releases. Display ON for an external transmitter never grants laptop motor control. Refresh/resume/reconnect/network changes never auto-start Python or flight transmission.

An isolated telemetry failure retains verified identity/session when flight ACKs continue. Repeated stale status, identity mismatch, lost ownership or RC ACK timeout remain stop/block conditions. The RC deadline remains 300 ms. Native Wi-Fi callback pinning prevents an unrelated network callback from silently replacing the active kit route.

## Automated verification

Both A1/A2 APP/FACTORY profiles are compiled with Arduino CLI 1.5.1 and pinned Espressif core 3.3.12 using official verified archives. Image magic, chip, version, dual OTA size, factory bootloader offset, application equality and SHA-256 are checked.

The APK uses JDK 17 javac, Android SDK Platform 36 and Build Tools 36.0.0. DEX, manifest/resources, ZIP alignment, v2/v3 signature and exact bundled assets are checked; development signing is retained.

Native Java tests exercise lifecycle/session fencing, late grants/replies, configuration reservation, local API policy and ACK watchdog. Real Chromium with simulated kit/native APIs exercises AP/STA toggles, same-ID reconnect, mobile/PPM live display, no automatic RC, top ownership control, transient telemetry failure while throttling and configuration release preserving PPM.

UI checks cover target selection, small throttle moves/hold, keyboard, multi-touch and header alignment at 1374/1024/760/390 px. Flight UI checks cover touch, STOP, refresh, late grants, wrong IDs, transport/lease loss and offline cache. Full Python/camera/hand/offline regressions use real browser runtimes, synthetic camera/hands/kit transport where stated. Upload checks exercise missing/changed files and the actual workflow missing-helper guard.

Re-run npm run check, release:check, test:control, test:setup, test:upload, test:flight-math. Browser suites test:ui, test:flight, test:network, test:mobile-view, test:real-browser, test:offline need Playwright/Chromium; run sequentially.

## Physical tests pending

No real phone/emulator, kit/receiver, USB/OTA flash or flight test was performed. On the actual kit verify AP/STA/unique-ID reconnect, screen lock/calls/Wi-Fi loss/resume, throttle/ownership stability, physical PPM display and handover, saved settings and loaded 250 Hz timing. Follow the existing propeller-off/tethered validation guide. Synthetic API/camera success does not establish radio reliability, real hand recognition or flight stability.
