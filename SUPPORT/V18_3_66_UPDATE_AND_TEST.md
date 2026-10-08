# Aerion V18.3.66 learning workflow

Install the matching V18.3.66 APK and update the A2 controller to the matching application firmware. Local/cached web labs also need the complete current source bundle. The app reserves the verified kit without starting RC; Take control and ARM remain separate actions.

## Web navigation

Assembly Lab → 2D Wiring → Setup Wizard → Hardware I/O → Python Lab → Tripod Simulator → Joystick → Flight Training → Firmware & Connect → Telemetry → Settings.

Setup Wizard is a dedicated page with ordered Board, Airframe, Mount/limits, Sensors, ESC, Output calibration / Motor idle, Rotation, Receiver, Arm/failsafe, PID and Finish steps. Every mutating step uses the existing exact Device ID and a short setup lease. Next stays disabled until the current result is confirmed. Sample progress comes from the controller; motor-start pulses, rotation and ESC tones require physical observation. Fixed virtual App/Web endpoints can be checked with practice sticks. PPM mapping, centres, ranges and arm method are read back before proceeding.

Hardware I/O starts with 15 tool buttons. Each tool opens its own controls; All hardware tools returns to the menu. Sensor offsets/six-face checks and PID tuning are here. Individual sensor/ESC/idle/rotation/receiver/failsafe tools reuse the guarded setup service without requiring unrelated steps. Setup completion records distinguish individual tools from the full workflow.

Firmware & Connect combines discovery, selection, identity, control and flashing. Upgrade uses the connected USB controller, or Wi-Fi OTA when no USB loader is connected. Upgrade & Erase requires USB and a matching complete factory image. It erases saved configuration; application-only images cannot be used for an erase. Existing image-header, board, digest, identity and disarmed gates remain active.

Telemetry uses an attitude indicator, integrated yaw estimate, altitude and vertical-speed gauges plus live system health. Unavailable sensors never display fabricated readings. A lost link marks data stale. Yaw is a gyro estimate, not a calibrated compass. Flight time is the duration observed by this browser while receiving armed telemetry.

## Sixteen training missions

1. First take-off and soft landing.
2. Altitude-band discipline.
3. Heading changes without position drift.
4. A square circuit.
5. Precision gates.
6. Obstacle corridor.
7. Unexpected wind gusts.
8. Hovering and LED communication.
9. Parcel pickup and delivery.
10. Combined rescue with moving obstacles, gusts, signal and delivery.
11. Altitude rings at 1.5, 3.0 and 2.0 m.
12. Four-ring slalom.
13. Aerial inspection photos with position, height, heading and speed checks.
14. Rescue delivery and beacon deployment.
15. Three-pad soft landing tour with take-off between pads.
16. Timed wind route, return HOME, hover and landing.

Completed lessons unlock the next one. Obstacle collision, hard landing, boundaries and time limits stop the attempt. Ring-frame contact blocks movement and raises an alert; back off or use Recover to return to the entry side without earning a pass; retry starts clean. Progress stays in this browser and can be exported. Missions use simulated LED/payload/photo/beacon equipment and never operate real auxiliary outputs. The teaching model uses stabilised Angle-style response, not a calibrated aerodynamic twin of a particular drone.

Default graphics use a detailed native quadcopter, procedural terrain and instanced scene objects with capped rendering resolution and a 30 FPS limit. High quality renders at 60 FPS; physics uses the same fixed 120 Hz steps. Chase, FPV, Orbit and Overview views, a north-up map, altitude projection and Find drone keep the aircraft visible. A lightweight canvas view uses the same model and camera when WebGL is unavailable. Hidden/inactive pages pause the lesson and end hardware input.

Keyboard: W/S throttle, A/D yaw, arrows pitch/roll, Space ARM and Escape pause. On-screen sticks and a throttle slider also work. Hover throttle is 50%; the first climb needs a little more throttle before reducing it. Soft landing needs less than 0.8 m/s descent and horizontal speed.

Rings have labelled heights and ground entry chevrons. Passing requires a crossing from entry to exit through the opening; hovering in the centre, flying backwards or going above the frame does not count. The navigation arrow and direction text are relative to the aircraft nose, including in Overview. HOME distance always measures the take-off point; FINISH distance is separate. Guide HOME switches guidance without changing mission progress. Contact count affects the score; Retry clears the attempt. Existing browser progress keeps the first ten completions and unlocks the new missions in order.

### ESC and output calibration

The ESC procedure follows the [LibrePilot calibration flow](https://librepilot.atlassian.net/wiki/spaces/LPDOC/pages/12058743/ESC+Calibration) using the controller's existing 1000/2000 µs PWM contract. Confirm props removed, motor battery disconnected and manufacturer instructions read before Start/HIGH. USB must power only the FC. Connect the motor battery after HIGH, then press Stop/LOW at the manufacturer's first calibration prompt. HIGH has a 12 s hardware limit; expiry stops outputs and requires disconnect/reconfirmation before another attempt. LOW lasts 3 s; confirm actual success tones and disconnect the battery before proceeding. The UI does not measure battery connection or calibration beeps.

Output calibration highlights M1 front-left CW, M2 front-right CCW, M3 rear-right CW and M4 rear-left CCW. Select a motor, set its 1000–1300 µs slider and Start a 2 s test. Stop remains reachable while awaiting the reply; delayed replies are followed by a compensating stop. Slider changes stop the old pulse and test the new pulse only for the remaining time. They never renew the browser deadline. The controller independently caps each request and stops on lease/owner loss. After outputs stop, physically confirm reliable slow starting and record the tested pulse. Repeat all four motors; idle is the highest observed start + 20 µs, subject to existing supported limits and verified readback. There is no RPM sensor. Rotation checks remain bounded 800 ms tests.

### App / PPM training input

Android app (18.3.66-android.2) uses the matching V18.3.66 A2 firmware:

1. Connect phone and computer to the same kit AP or router Wi-Fi; open Flight Training on the web lab. The web lab reconnects the saved/sole discovered Device ID as an observer. Multiple kits require choosing the correct kit once. Allow the browser's Local Network Access permission when requested.
2. In the app, select Mode → Flight Training, confirm every propeller is removed and apply. Controls switch ON with throttle at minimum and ARM low. No web Enable training input button or web control lock is needed.
3. ARM in the app at minimum throttle, then use its sticks. If the page opens after app ARM, centre sticks and lower throttle to join the virtual lesson. Physical motor outputs remain blocked by the app's private training lease.
4. Telemetry interruption pauses and disarms the virtual model while retaining its lesson/session. Restore the link, centre sticks, lower throttle, DISARM then ARM in the app to resume. Held ARM alone cannot resume after link loss. If the controller reports training ended, choose the destination again in the app.
5. Selecting Tripod stops Flight Training; selecting Real switches simulation OFF and leaves controls OFF. Real flight still requires Take control and a new manual ARM. STOP/background/Wi-Fi loss clears app training and requires fresh selection.

For PPM, connect the A2 kit in the web lab, select PPM receiver, confirm propellers removed and Enable training input. The browser owns and renews that output-inhibited lease. Start the lesson, then use the configured PPM arm switch or yaw gesture. Restore fresh neutral frames and Resume after stale RC. Leaving its page ends the browser-owned training lease.

Physical motor output is inhibited in the output writer, output supervisor, arming service and bench service. Setup and bench/configuration writes are blocked while training is active. Lease loss never resumes real flight with a held virtual ARM command. A1 remains a sensor bridge and cannot provide the guarded training transport.

## Compact Android flight app

The small gear beside Take control opens Controls, Safety and Wi-Fi. It contains stick feel, quick disarmed gyro/level calibration, live link/failsafe information and essential pairing controls. Full setup, PID, motor/ESC tests, receiver mapping and backups remain in the web lab.

## Verification

Software verification passed in [full build/test run 37190966009](https://github.com/chilchiltrips-boop/zebjus-drone-simulator-lab/actions/runs/37190966009) and [final web-only run 37191716120](https://github.com/chilchiltrips-boop/zebjus-drone-simulator-lab/actions/runs/37191716120). The final web polish leaves compiled firmware and Android inputs unchanged. Downloaded artifacts match the committed packages byte for byte. Exact source commits, package hashes and physical-test limits are recorded in `SOFTWARE_VERIFICATION_V18_3_65.json`.

Run `npm run test:training-core`, `npm run test:fc-setup`, `npm run test:setup-browser`, `npm run test:setup-session`, `npm run test:training-browser`, `npm run test:learning-browser`, `npm run test:wix` and existing control/browser regressions. The release verification workflow compiles both pinned ESP32 board profiles and the matching development-signed APK, seals hashes/inventory, runs native and browser tests, and retains screenshots. Physical ESC operation, radio RF-loss behaviour, phones, motors and free flight still require bench/device verification with propellers removed.

## App-selected simulator destination

Install the new APK and matching A2 firmware. Connect the same Device ID in the app and web lab. On app home, open Mode and choose Real flight, Tripod simulator or Flight Training. Confirm props removed for simulation. Selection stops transmission; tap Take control and ARM at minimum throttle. Only the chosen simulator receives app sticks. Flight Training automatically attaches the web observer and starts the ready lesson after a fresh ARM-low → ARM-high transition; it does not take the mobile control lock. Tripod likewise requires a fresh ARM at minimum throttle. Returning to Real flight or losing the app lease stops both simulation receivers and requires neutral sticks/manual ARM. Existing desktop APP/PPM training remains available.

Verify on hardware with propellers removed that all four physical PWM outputs stay at 1000 µs in each simulator mode, including when app ARM is high. Verify STOP/background, wrong kit, lease expiry and app owner loss stop virtual control. No physical-flight or motor-response verification is claimed by the browser/build tests.
