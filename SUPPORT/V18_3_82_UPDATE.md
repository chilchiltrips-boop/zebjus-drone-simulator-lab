# Aerion 18.3.82 AP/STA connection update

Install the new signed Android APK and matching 18.3.82 firmware together. This retains the full 18.3.80 lab and the web-started simulator behavior introduced in 18.3.81.

## Findings from the October 8 reports

The controller saved the router profile and attempted the saved router, then returned to its `zebjus_drone_1` AP. The WebApp received valid A2 telemetry on `192.168.4.1`; Android recorded no controller telemetry and no native control reservation. The second boot reported a ready, calibrated MPU6050. These observations do not establish a wrong password, an IMU-caused Android failure, or the router's exact rejection reason.

The previous fallback path persisted AP preference; subsequent boots could therefore skip saved STA Wi-Fi. A timed-out STA association was not stopped before scanning, and the preferred profile was excluded from a second attempt. The web live monitor attempted a STA-only endpoint while on AP and mislabeled the denial as another training observer. Native router selection excluded some local networks without Internet, and reconnects left idle mobile pairing sessions allocated.

## Changes

- Cancel a failed STA association before scanning. Retry a visible preferred profile, or retry it explicitly after an empty scan for hidden networks. Allow a bounded 20-second association attempt and report its status and disconnect reason without recording the password.
- Recovery AP no longer becomes persistent AP preference. If the recovery AP has no connected stations or control/setup/output activity for 60 seconds, reboot to retry the saved router. Explicit AP selection remains persistent, and connected AP clients are never interrupted by this retry. Old 18.3.81 AP preference cannot be distinguished from an explicit choice; use **Activate saved STA** once after upgrading to clear it.
- Keep the idle, unassociated STA scan interface after an AP Wi-Fi scan instead of toggling the AP radio again. It does not associate with the router while AP control is active.
- Reuse an already joined, matching Kit Name AP in Android instead of requesting the same SSID again. Clear stale AP selection on loss. A saved old generated SSID opens the current kit AP picker; exact paired identity is still checked before control. A stale typed/cached IP falls back to the entered Kit Name instead of blocking discovery. Accept the explicitly chosen system router LAN even if its SSID is redacted or Internet is unavailable; exclude departing kit APs and cellular data.
- Opening the Connection form fences previous discovery and mobile reservation replies, including delayed pairing/authenticated status replies, so an old auto-connect cannot close the newly opened form.
- Record connection errors and the native network selection in Android exports, and router attempt diagnostics in WebApp status. Reclaim released idle mobile authentication sessions after their activity deadline, while preserving active control and training sessions.
- AP uses HTTP telemetry; the WebApp does not open the STA-only live RC monitor or label AP rejection as a training conflict.

## Install and reconnect this A2 kit

1. Keep the frame level and still for gyro calibration, with propellers removed during setup. The uploaded controller is **ZFC-A2 / ESP32-C6 Aerion F1**.
2. Install `android-app/dist/ZEBJUS_Aerion_V18_3_82_Android.apk`. Its development signing certificate matches the previous APK; saved settings and pairing are retained.
3. For the existing secure 18.3.81 controller, update using the matching **A2 APP** image through the firmware updater. The full **FACTORY** image is for USB recovery/migration and can erase saved settings; do not use the A1/C3 image on this A2 board.
4. In Phone Wi-Fi settings join `zebjus_drone_1`, password `12345678`. In Android choose **Real flight · Kit AP**, Kit Name `zebjus_drone_1`, address `192.168.4.1`, then **Check connection**. AP authentication is automatic. A MOBILE reservation alone keeps RC and motors off; **Take control** explicitly enables the joystick.
5. Read saved Wi-Fi and choose **Activate saved STA**, or save the router profile again. After the kit restarts, put phone and computer on that same router. In Android choose **Router Wi-Fi · STA** and the kit's router IP/Kit Name. STA owner pairing uses the current physical label code once; an app invitation can pair the permitted laptop.
6. Start Tripod or Flight Training in the connected WebApp, then manually ARM the virtual drone in Android at minimum throttle. Joystick values drive that web simulator; physical outputs remain blocked.

If STA still fails, the new serial output reports `STA failed: status ..., disconnect reason ...`, and exports retain the same reason. Capture that line and fresh Android/WebApp JSONs after one attempt. A saved profile confirms persistence, not router acceptance.

## Test boundary

Production firmware host tests cover association cancellation and retry, hidden profiles, AP preference, idle-only recovery, scan stability and armed/output guards. Native policy and browser tests cover network choices, exact kit identity, manual control/ARM, lifecycle loss, and web-started Tripod/Flight input. APK and both board images are built and checked from this source. A physical phone/router/USB/OTA flight controller has not been exercised in this environment.
