# Aerion V18.3.65 learning workflow

Install the matching V18.3.65 APK and update the A2 controller to the matching application firmware. Local/cached web labs also need the complete current source bundle. The app reserves the verified kit without starting RC; Take control and ARM remain separate actions.

## Web navigation

Assembly Lab → 2D Wiring → Setup Wizard → Hardware I/O → Tripod Simulator → Joystick → Flight Training → Firmware & Connect → Telemetry → Python Lab → Settings.

Setup Wizard is a dedicated page with ordered Board, Airframe, Mount/limits, Sensors, ESC, Motor idle, Rotation, Receiver, Arm/failsafe, PID and Finish steps. Every mutating step uses the existing exact Device ID and a short setup lease. Next stays disabled until the current result is confirmed. Sample progress comes from the controller; motor-start pulses, rotation and ESC tones require physical observation. Fixed virtual App/Web endpoints can be checked with practice sticks. PPM mapping, centres, ranges and arm method are read back before proceeding.

Hardware I/O starts with 15 tool buttons. Each tool opens its own controls; All hardware tools returns to the menu. Sensor offsets/six-face checks and PID tuning are here. Individual sensor/ESC/idle/rotation/receiver/failsafe tools reuse the guarded setup service without requiring unrelated steps. Setup completion records distinguish individual tools from the full workflow.

Firmware & Connect combines discovery, selection, identity, control and flashing. Upgrade uses the connected USB controller, or Wi-Fi OTA when no USB loader is connected. Upgrade & Erase requires USB and a matching complete factory image. It erases saved configuration; application-only images cannot be used for an erase. Existing image-header, board, digest, identity and disarmed gates remain active.

Telemetry uses an attitude indicator, integrated yaw estimate, altitude and vertical-speed gauges plus live system health. Unavailable sensors never display fabricated readings. A lost link marks data stale. Yaw is a gyro estimate, not a calibrated compass. Flight time is the duration observed by this browser while receiving armed telemetry.

## Ten training lessons

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

Completed lessons unlock the next one. Collision, hard landing, boundaries and time limits stop the attempt; retry starts clean. Progress stays in this browser and can be exported. Missions use simulated LED/payload equipment and never operate real auxiliary outputs. The teaching model uses stabilised Angle-style response, not a calibrated aerodynamic twin of a particular drone.

Default graphics use simple geometry, no model downloads/shadows/postprocessing, capped rendering resolution and a 30 FPS limit. Software 3D view works when WebGL is unavailable. Hidden/inactive pages pause the lesson and end hardware input.

Keyboard: W/S throttle, A/D yaw, arrows pitch/roll, Space ARM and Escape pause. On-screen sticks and a throttle slider also work. Hover throttle is 50%; the first climb needs a little more throttle before reducing it. Soft landing needs less than 0.8 m/s descent and horizontal speed.

### App / PPM training input

1. Connect the A2 kit from Firmware & Connect, disarm it and remove all propellers.
2. Open Flight Training. Select Android app or PPM receiver, confirm propellers removed, then Enable training input.
3. Wait for **TRAINING ACTIVE · REAL OUTPUTS BLOCKED**. The computer maintains a separate short inhibition lease; the app can own RC while the computer observes it.
4. Connect the V18.3.65 app to the same kit and Take control, or switch on PPM. Start the lesson, then use app ARM or the configured PPM switch/yaw gesture.
5. Stale RC pauses the virtual lesson. To resume, restore fresh frames, lower throttle, centre sticks, set app ARM low and press Resume.
6. End hardware training before real flight. The FC invalidates the native RC grant, disarms and requires neutral sticks plus a fresh manual ARM. Training is not persisted across reboot.

Physical motor output is inhibited in the output writer, output supervisor, arming service and bench service. Setup and bench/configuration writes are blocked while training is active. Lease loss never resumes real flight with a held virtual ARM command. A1 remains a sensor bridge and cannot provide the guarded training transport.

## Compact Android flight app

The small gear beside Take control opens Controls, Safety and Wi-Fi. It contains stick feel, quick disarmed gyro/level calibration, live link/failsafe information and essential pairing controls. Full setup, PID, motor/ESC tests, receiver mapping and backups remain in the web lab.

## Verification

Run `npm run test:training-core`, `npm run test:fc-setup`, `npm run test:setup-browser`, `npm run test:learning-browser` and existing control/browser regressions. The release verification workflow compiles both pinned ESP32 board profiles and the matching development-signed APK, seals hashes/inventory, runs native and browser tests, and retains screenshots. Physical ESC operation, radio RF-loss behaviour, phones, motors and free flight still require bench/device verification with propellers removed.
