# V18.3.58 firmware, reconnect and hand control

## Included firmware

Both profiles were compiled with Arduino CLI 1.5.1 and Arduino-ESP32 3.3.12. The image header, target chip, release string, dual OTA partition size, bootloader offset and equality of the factory application's bytes to the APP image were checked before publishing their catalog metadata. SHA-256 values and exact sizes are in `firmware-catalog.json`; `FlightCore_Firmware/build-report.json` records the build checks.

| Profile | Role | Wi-Fi OTA / USB application | USB factory image |
| --- | --- | --- | --- |
| ZFC-A2 / ZEBJUS Aerion F1 | Flight controller; MPU6050 required for stabilized RC | `ZEBJUS_FLIGHTCORE_A2_APP.bin` | `ZEBJUS_FLIGHTCORE_A2_FACTORY.bin` |
| ZFC-A1 / FlightCore A1 | Wi-Fi/sensor bridge; no flight motor output profile | `ZEBJUS_FLIGHTCORE_A1_APP.bin` | `ZEBJUS_FLIGHTCORE_A1_FACTORY.bin` |

All four images are inside `FlightCore_Firmware`. **APP** is for OTA, or USB at **0x10000** when the matching bootloader/partition table already exists. **FACTORY** contains bootloader, partitions and application; use it for a fresh USB installation at **0x0**. Firmware Center loads the matching package and checks the profile, descriptor and hash. Changing image type loads the matching file instead of relabelling the old bytes. FACTORY is blocked for OTA; APP cannot erase the complete flash. The firmware OTA handler rejects an armed/bench-active kit, wrong Device ID, wrong board profile or wrong chip image.

A2's application is 1,287,952 bytes in a 1,310,720-byte OTA slot (22,768 bytes remain). Future firmware additions need another size check. Compiler warnings about incrementing volatile counters remain; compilation succeeded for both profiles.

## Refresh, Wi-Fi changes and restart

The browser saves the physical Device ID separately from the display name. Automatic recovery tries cached IP, kit-name mDNS and `192.168.4.1`, verifying the ID at every address. A different board using the same name/IP is rejected. To choose a replacement board, explicitly select its discovered Device ID or use Connect with its name. Manual Disconnect pauses automatic retries until another connection action.

STA→AP and AP→STA software switches retain the selected ID while the kit restarts. After reconnect, telemetry returns; Python, joystick TX and ARM do not restart. Refresh closes the Python worker and releases the control lock when the browser can send the request. If the page/link disappears before that request arrives, firmware Web RC expires after 300 ms and its control-lock timeout is 10 s. The controller's existing low-ARM/low-throttle gate remains required before a new ARM. Automatic reconnect does not acquire a new control lock.

The full app runs on `http://localhost:8787/` from the extracted bundle, or from a prepared browser copy. Joining an AP does not move that app origin. `http://192.168.4.1/` serves the controller's smaller embedded Flight App. Cameras require localhost or HTTPS, including when the laptop is on AP Wi-Fi.

## Browser hand RC

Camera and hand processing now continue while the real target is armed. Local MediaPipe inference runs in `hand-worker.js`; only one camera frame is in flight, so work cannot queue indefinitely. The main UI/RC thread receives timestamped landmarks. Real Python runs are pinned to the selected Device ID, and RC commands require the run's control lock. Kit loss, control-lock loss, selection change or page exit stops the run. Old in-flight commands and cleanup are finished before another run starts.

For hand RC, ARM requires a detected hand captured within the last 900 ms. Missing hands, expired data or a worker/camera failure stops the program and sends DISARM with throttle 1000 when the link is available. The firmware RC timeout covers a lost link. No reconnect automatically restarts the program. The current controller has no autonomous landing or altitude-hold integration; a disarm/RC timeout does not perform a landing manoeuvre.

Settings → **Show Python examples** stays **off by default**. For instructor access, enable it and select **Hand + Keyboard RC (Simple Python)**. It uses `from zebjus_simple import Drone`, `while True:` and ordinary calls without student-written `await`. Start in Simulator. Space toggles ARM at low throttle, hand position controls roll/pitch, Up/Down changes throttle, a fist/no hand disarms, and Esc stops. After connecting a ready A2 kit, change Python target to Real kit and press Run. The example's throttle ceiling is 1400; this is a teaching starting point, not a calibrated hover value.

## Verification status

| Check | Status |
| --- | --- |
| A1/A2 compilation and four binary image/partition/hash checks | Passed |
| USB APP/FACTORY offsets, OTA APP upload, profile/armed guards | Passed using simulated USB/XHR transport |
| Refresh, stale DHCP IP, AP↔STA, kit restart, same-name wrong kit, cancelled requests | Passed using simulated kit HTTP transport |
| Real-target armed camera/hand RPC, cvzone, RC, stale-hand stop and no auto restart | Passed in an actual browser with synthetic hands/camera and simulated kit HTTP |
| Actual local MediaPipe model inference, Python packages, plots and complete browser offline copy | Passed with synthetic camera frames; external network blocked |
| Physical USB flash, physical OTA flash, radio reconnect and real hand recognition | Pending: no connected hardware/webcam available in the build environment |
| Motor response / timing under load / real flight | Pending physical validation |

For physical acceptance, use the exact case Device ID and matching A2 image. With propellers removed, first verify USB FACTORY flash and boot status, then an APP OTA update and reported version 18.3.58. Check AP refresh, STA refresh, software AP↔STA switches, power restart and a second same-name kit: the app must reconnect only to the saved ID with TX/Python stopped. Then verify camera/hand results while armed on a secured test rig, stop/lost-hand/closed-page behaviour and RC timing. Record results before proceeding to flight validation in `SUPPORT/FLIGHT_VALIDATION_V18_3_48.md`.
