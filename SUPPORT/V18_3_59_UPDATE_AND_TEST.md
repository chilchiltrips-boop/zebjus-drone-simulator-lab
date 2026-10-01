# V18.3.59 — Aerion Flight App

The kit-hosted AP flight page and standalone `flight/index.html` now share one self-contained, dark flight interface inspired by the supplied Tello screenshots. No DJI branding, Python editor, camera window or Python runtime is loaded on this screen. The existing engineering lab and its Python/hand tools remain available separately.

## Open the app

- Kit AP: install the matching V18.3.59 firmware, join the exact kit's unique Wi-Fi network, then open **http://192.168.4.1/** in a normal browser. `/fly` opens the same page. No laptop server or internet is needed.
- Laptop: extract the whole project; open `Start_Flight_App.bat` on Windows or `Start_Flight_App.command` on Mac. Or run `python3 start_offline.py --flight` and open **http://localhost:8787/flight/**. Node.js users can run `node server.js` and use the same address. No student Python program is needed; the launcher only serves static files.
- Existing engineering lab: Joystick → **Open Aerion Flight App**. Leaving the lab stops its existing output session; the flight page requires a fresh Take control action.
- A supported browser can add the standalone page to the home screen. Its small dedicated service worker caches the interface on localhost/HTTPS. AP firmware serves its own copy each time, even without internet. Clearing browser data removes an installed browser copy. If your browser requests local-network permission when using a hosted copy, allow it for your kit connection; browser/platform restrictions still apply. See [Chrome’s local-network guidance](https://developer.chrome.com/blog/local-network-access).

This release is a web app, not an Android APK or native iOS application. Wi-Fi joining remains a phone/laptop settings action. The browser cannot silently join a Wi-Fi network. Captive portals may open the connection page after joining, but operating-system auto-opening cannot be guaranteed; use the normal-browser address above.

## Flight controls

| Position | Controls | On release |
| --- | --- | --- |
| Left joystick | Up/down: throttle; left/right: yaw | Throttle holds; yaw centers |
| Right joystick | Up/down: pitch; left/right: roll | Pitch and roll center |
| Top bar | Kit connection, AP/STA state, actual ARM state, ANGLE/RATE mode, ARM/DISARM and STOP | Mode changes require disarm |

Floating centers stay inside their assigned left/right zones. Touching a new center starts at zero deflection, including near a zone edge. Left vertical movement ramps throttle at up to 400 PWM units/second rather than jumping to a middle throttle. Throttle range is 1000–2000; the display reports percentage. Settings can switch to fixed centers. Each side accepts one independent pointer, so both hands work together; pointer cancellation centers directional axes. Long names, status updates and notices do not move joystick locations.

Connect checks the physical Device ID, then requests a control lock only after an explicit Check connection/Take control action. A1 remains a sensor bridge and cannot be armed as a flight controller. ARM requires a flight-ready A2 and throttle ≤1050; the initial ARM frame holds throttle at 1000. There is no repeated safety confirmation popup. The kit's authoritative status supplies ARMED; an HTTP acknowledgement alone does not prove motors armed. Battery appears only when firmware supplies a valid measurement.

W/S adjusts throttle; A/D controls yaw; arrows control pitch/roll. X or Escape stops; M changes mode while disarmed. STOP lowers throttle, disarms, centers directional channels and releases control. Automatic take-off, landing, altitude hold and a drone video feed are not implemented for this controller.

## Refresh and link recovery

Every Take control and page refresh creates a fresh client session. Previously queued RC requests cannot control a newly acquired session. Refresh restores telemetry only. It never restarts a program, transmitter or ARM. Reconnect verifies the exact saved physical ID at the cached IP, normalized kit-name mDNS and AP address. Use Settings → Pair another kit to deliberately discard the flight page's saved pairing; another board at the same address/name is rejected until then. Manual Disconnect pauses retries until a connection action.

Control uses one RC request at a time, with a 25 Hz target. Expired acknowledgements, failed heartbeat, lock loss, a wrong Device ID or loss of flight readiness latch control off. Late connection/grant replies cannot restart a cancelled session. Cleanup sends a captured safe frame and releases the captured controller identity after pending commands finish. Opening connection/settings, hiding the page, losing browser focus or changing the viewport orientation stops control. Recovered telemetry requires another manual Take control and ARM action.

Page exit attempts a safe-frame and release beacon. Browsers may discard these during navigation. If the kit cannot receive them, firmware Web RC times out after 300 ms; its lock expires after 10 s. A temporarily retained old lock can require waiting and pressing Take control again. The firmware's low-throttle/low-ARM gate remains active. These stop actions do not perform an autonomous landing.

## Matching firmware

All four compiled images are in `FlightCore_Firmware`. Select the exact detected board profile; A2 / ZEBJUS Aerion F1 is the flight controller. A1 is the bridge profile. **APP** is the OTA image, or USB at **0x10000** with a matching existing partition table. **FACTORY** is the merged fresh USB image at **0x0**. Do not use FACTORY for OTA. The updater loads and verifies the selected image type, board profile and SHA-256.

Both profiles use Arduino-ESP32 3.3.12 and two 1,310,720-byte OTA slots. Exact final image sizes, build IDs and SHA-256 are recorded in the catalogs and `build-report.json`. A2 has little remaining flash space; additions must be compiled and checked against both slots. `tools/embed_ap_pages.py` synchronizes the standalone flight page and the embedded firmware from `tools/ap_fly_source.html`.

## Verification and hardware acceptance

Automated verification uses an actual browser with real multitouch events and a simulated kit HTTP transport. It covers axis mapping, simultaneous sticks, throttle ramp/hold, keyboard, fixed/floating settings, STOP, refresh, AP/STA reconnect, wrong physical ID, lock/transport loss, cancellation of a pending grant, rejection of old delayed ARM frames after a new grant, screen layouts and an independently cached offline reload. It checks that no Python/engineering runtime is requested by this flight page. Existing Python/vision, offline bundle and firmware-updater checks remain part of release validation.

Compiled-image checks cover release string, chip ID, dual OTA slots, APP size, merged bootloader offset and byte equality of the factory's application with the OTA APP. **No physical kit is connected in this build environment. Physical USB/OTA flashing, radio timing, touch devices, motor response and actual flight remain pending.** Browser transport tests do not establish flight safety or Wi-Fi range.

On the actual A2 with propellers removed, verify the reported version after USB/OTA, Device ID, AP refresh, STA refresh, AP↔STA software switch, kit restart and wrong-kit rejection. Check both sticks together, low-throttle ARM, mode lock, STOP, lost Wi-Fi, page closure and reconnect with no automatic outputs. Record motor/IMU direction and timing before evaluating flight on the intended hardware.
