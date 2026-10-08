# Aerion 18.4.0-simple.1

Version code: 1840001. The app contains the same small Controls / Setup / Firmware UI as the webapp. Connect kit AP Wi-Fi inside the app or select the phone's router Wi-Fi, enter the controller IP, and Connect. Device ID is verified automatically; there is no pairing-code form or simulator/training destination selector.

Take control enables sticks, then ARM manually at minimum throttle. IMU readiness is shown separately from the Wi-Fi connection. Native HTTP is pinned to Wi-Fi; RC uses the independent 50 Hz UDP stream and native ACK/input watchdog. Configuration pauses RC. Lifecycle, wrong-controller and stale-grant checks remain.

The file picker accepts `.bin` files, and Wi-Fi firmware upload uses the native local-only binary API. APP descriptor, board chip ID, length, control ownership and firmware-side disarm checks are required. Open the webapp on a laptop for USB flashing.

Build with `python3 tools/build_apk.py` and official Android SDK Platform 36/Build Tools 36.0.0. Supply `AERION_DEVELOPMENT_STORE_PASSWORD` through the build environment or the same named repository Actions secret. Existing `signing/aerion-development.p12` is preserved. `--unsigned-only` compiles a reviewable APK without publishing it as an installable release. No physical phone/controller test is claimed.
