# V18.3.61

## R3 — Uploaded GitHub snapshot audit

- The snapshot contained all 379 R2 project paths except `android-app/.gitignore`, plus ten obsolete packaging/old-APK/thumbnail files. Runtime hashes and compiled images matched. Cleanup now removes those known leftovers and restores a consistent count.
- Validation, cleanup and packaging share one inventory. Python caches, Node dependencies and Android build outputs do not become release files. Hidden ignore files are supplied.
- Uploads use a staging branch and one final merge. Release-integrity hashes reject missing, mixed or unexpected files before toolchain installation. PR validation does not download the ESP32 toolchain.
- Automatic firmware/Android builds watch main; firmware publication is main-only and verifies the latest main before restoring generated outputs. Newer partial uploads cannot receive stale generated binaries.
- Android artifacts list the current APK explicitly, avoiding accidental inclusion of the old V18.3.60 package. Current upload guides now correctly describe the included compiled images.
- Firmware/APK/runtime bytes are unchanged. Physical flight, USB/OTA, loaded timing and actual GitHub Actions execution are not claimed by this source audit.


## R2 — Aerion interface and build reliability

- Main WebApp is named **ZEBJUS Aerion**. The header has separate identity/control and notification rows, with navigation positioned using the actual header height. Desktop, tablet and phone widths are covered.
- Web Joystick and Tripod preserve the thumb's vertical drag position. Fractional throttle changes accumulate before publishing integer channels, so small movements also work at fast display refresh rates. Release holds throttle and recenters the rate stick. Leaving a controller page cancels held-pointer input.
- Native target options are only changed when their content changes. Simulator/Real kit selection stays usable during redraws. A laptop observing a mobile-owned kit can select its display target without publishing flight frames or interrupting the phone.
- Arduino core/index setup has four attempts with 10/20/40-second backoff. CI caches the pinned 3.3.12 core; failed installs preserve completed downloads for the next run. Dependency directories stay outside the repository inventory. Compile errors are reported after one attempt.
- A distinct web cache revision makes browsers load the corrected interface. Verified offline saving accepts web revisions of the same firmware release.
- Firmware/APK bytes, hardware pin mappings and AP password are unchanged. This is a WebApp/build-tools correction; no hardware reflash is required for these WebApp fixes.


- Mobile session reservation makes connected laptop clients view-only. WebApp Joystick/Tripod mirrors received mobile RC. Explicit connection reserves the phone; Take control and ARM remain separate actions. Reload/resume stay read-only.
- APK and full WebApp include in-app AP/STA, saved/new Wi-Fi, joystick feel, controller limits, PID/calibration and device/profile-bound backup/restore. Armed/bench configuration is blocked in firmware and UI. Settings observation does not interrupt an armed flight.
- ZEBJUS/Aerion opening animation; APK header shows identity, ownership and actual firmware mode/ARM. All WebApp gimbals use shared floating centers and gradual throttle.
- PID angle/rate/motor graphs, CSV export, measured loop/RC/request diagnostics and explicit fresh/calibrated/in-use sensor status. Modes require implemented firmware capabilities; barometer detection alone does not enable altitude/position modes.
- Dedicated timer-notified 250 Hz control task, networking task separation, recursive I²C mutex, measured dt, gyro/D-term filters, saturation-aware integral rollback and output watchdog. Physical loaded 250 Hz measurement remains pending.
- Guarded Rate/Angle changes and matched Web↔PPM handover blend outputs rather than unconditionally disarming. Invalid requests retain current source/mode; RC loss, IMU fault or loop stall retain explicit failsafe disarm behavior.
- Persisted mounting orientation, six-face accelerometer calibration, physical motor pulse limits/idle, INA219/INA226 voltage monitoring and configurable visual battery alerts. Monitor hardware is required; voltage is unavailable by default. Critical/missing configured voltage blocks new ARM. Automatic landing is not implemented.
- Compiled A1/A2 APP/FACTORY binaries, same-certificate development APK, deterministic compressed offline AP pages, refreshed offline hashes and minimum-count upload batches (100 files per batch, 25 MiB per file).

Software/build tests and hardware acceptance boundaries: `SUPPORT/V18_3_61_UPDATE_AND_TEST.md`. Real Android phone, USB/OTA flash, calibrated voltage, flight transitions and timing under radio/network load have not been tested on hardware.

## Earlier V18.3.55 changes

- Both Control target choices remain selectable. Real kit readiness comes from the selected verified device status, with a Joystick-page Connect/Take Control action and explicit reasons for disconnected, view-only, RC-disabled or IMU-not-ready states.
- The real Joystick ARM confirmation popup is removed. Intentional ARM, low throttle, verified Device ID, firmware Web RC capability, FlightCore readiness and the controller lock remain required.
- RC telemetry updates receiver health but cannot overwrite active Tripod, Joystick or Python simulator controls. Receiver-loss handling stops only a receiver-owned simulation. Tripod real mirror sends frames only while its own page/input is active.
- Simulator physics uses 4 ms steps independent of render frame timing. STOP/RUN resets PID integral/derivative history and Rate Hold captures the current attitude on start. Hidden Assembly/Tripod render work is reduced.
- Sound no longer restarts because disarmed receiver telemetry interrupted local simulation. Motor sound scheduling is limited to 30 updates per second, and unmuting restores audio for a running simulator without requiring Reset.
- Fixed-size metrics and receiver header keep Tripod gimbals in place as status text changes. Long receiver detail remains scrollable inside its reserved area.
- Discovery checks the AP API at 192.168.4.1 alongside STA kit names. A sole discovered kit connects using its verified Device ID; multiple kits still need an explicit selection.

## Verification

`node tools/test_joystick_runtime.js` passes real-target selection, popup-free ARM, exact RC routing, changing targets safely, lock/IMU/board guards, disarmed/stale telemetry isolation, receiver-mirror loss, equal physics response at 30/60/120 display FPS, restart state, audio restoration and AP discovery/ID rejection checks. Camera and output lifecycle regression tests and `tools/validate_project.py` also pass.

This is a source update. No firmware binary is included. No actual browser rendering/audio playback or hardware/network/flight test was completed in this environment; local Chromium was unavailable.

## Earlier V18.3.54 changes

The AP landing page now serves the Aerion Flight App with touch sticks, manual ARM/DISARM, ANGLE/RATE, keyboard, telemetry and links to Hardware I/O, Wi-Fi Settings and an offline Python guide. Captive network probe paths redirect to the same app at the canonical `192.168.4.1` address. Operating systems may show a Wi-Fi sign-in window; a normal browser at `http://192.168.4.1/` is the reliable control path. The former AP setup page moved to `/setup`, while `/fly` remains a controller alias. STA discovery still uses `/api/status` at `/`.

`python_companion/pair_ap.py` verifies the full Device ID typed from the kit case and stores a local URL/ID pairing file. `zebjus_simple.Drone()` supports regular synchronous Python in PyCharm with no internet or Python packages for basic LED, status, IMU, GPIO and RC calls. The existing client includes the expected Device ID with commands and re-acquires its lock if it expired. Native camera/OpenCV work stays on the laptop and requires the appropriate packages installed before offline use. New examples and setup notes are in `python_companion/README.md` and `SUPPORT/AP_APP_V18_3_54.md`. There is still no onboard video or automated takeoff/landing in this firmware, and no firmware binary in the ZIP.

## Earlier V18.3.53 changes

The Settings page can select AP for a verified, disarmed kit without pressing a case-hidden BOOT button. AP remains the selected mode after reboot or power loss. Wi-Fi loss or unavailable saved Wi-Fi also selects persistent AP. In the kit's AP portal at `http://192.168.4.1/`, choose **Activate saved Wi-Fi mode** to return to STA, or save and successfully test a new profile. Network mode changes are blocked during armed flight or bench outputs.

Each board advertises `ZEBJUS-FC-` plus its complete Device ID suffix and generates a separate random 16-character AP password on first boot. The password is stored in a dedicated NVS namespace, preserved by the web factory reset, and shown in Settings to the browser holding control or on USB Serial at 115200 during AP startup. Record the SSID/password on the matching case before enclosing a fresh board. A full flash erase clears NVS and generates a new password. The same `192.168.4.1` on separate APs is normal; the client connects to only the chosen SSID. The browser also sends the expected Device ID with commands and the new firmware rejects mismatches. Existing LAN control lock is not a user authentication scheme.

The AP uses its AP radio for ordinary operation, temporarily enabling station radio only for a Wi-Fi scan or an explicit Save & Test. AP password and radio behavior still require an actual firmware build, flash and hardware verification; this source ZIP does not include a binary.

## Earlier V18.3.52 changes

The hidden browser video remains active for frame capture, while the sole visible Python output popup opens when a camera run starts. OpenCV/cvzone frames replace the preview in that popup. Stopping or finishing the camera clears its image source, download link, and popup instead of leaving a frozen frame. Plot output uses that same popup and remains available after a non-camera run. The simple Python adapter is included in the offline source cache. Classroom code also uses standard `while True:`, `drone.led(1/0)` and `cv2.waitkey(milliseconds)`; LED writes still require a verified real kit with compatible firmware. Python Stop/finish queues LED OFF after the last outstanding LED write when this browser owns control.

## Earlier V18.3.51 changes

Python autocomplete now inserts `while True:` with an indented body and a short delay. The fallback editor indents after `:` and inserts four spaces with Tab. Simple mode inserts a 20 ms yield at the beginning of unconditional loops, preventing a tight `while True` from monopolizing its Worker. Press Stop to terminate a repeating script.

## Earlier V18.3.50 changes

The Python example menu is hidden by default; Settings controls its visibility per browser. New keyboard, hand tracking and LED lessons use `from zebjus_simple import Drone` with regular function definitions and no explicit `await`. They retain the existing worker, camera lifecycle, RC control lock, and stop handling. Keyboard and hand lessons open in Simulator; real hand flight remains blocked while armed. User-facing board profile is ZEBJUS Aerion F1, with stable board ID ZFC-A2 and silicon target retained internally for build/pin safety. Hiding the board name in UI does not conceal hardware identity from physical inspection, firmware or source.

## Earlier V18.3.49 changes

XIAO ESP32-C6 onboard GPIO15 orange LED supports `led_set` (on/off/blink, 100–5000 ms) and `led_read` without a blocking delay. Python browser and companion methods added. GPIO reads accept pullup, pulldown, or floating; see `SUPPORT/LED_AND_SENSOR_IO_V18_3_49.md`. Firmware binary is not included; compile and test on the real kit.

## Earlier V18.3.48 changes

## FlightCore A2 source

- Physical receiver pin can be selected as D6/GPIO16 (default) or D10/GPIO18 while disarmed. D10 cannot simultaneously serve PPM, servo, GPS or a digital output. WebApp Hardware I/O, kit `/io`, Python and 2D reference wiring show the selection.
- PPM publishes only a validated complete frame containing CH1–CH6, with unused channels reset to safe defaults. Short and malformed frames no longer combine old arm/mode values with new stick values.
- A FreeRTOS output supervisor attempts to drive all ESC PWM outputs to minimum after a flight/bench main-loop stall over 30 ms. A safe low-throttle receiver frame must clear the trip before arming. Status/telemetry report `outputWatchdogTripped` and `outputWatchdogTrips`. This is a software backstop, not a certified hardware failsafe; test on the exact board with propellers removed before flight.
- Bundled NEO-7 GPS measurement counts every completed UBX epoch drained from the serial buffer, avoiding undercount when one poll parses multiple epochs. `gps_read.measuredHz` remains an observed rate; 10 Hz cannot be confirmed without the physical module.
- Battery telemetry reports `battery: null` and `batteryValid: false` because this board profile has no wired voltage/current sensor. There is no implemented battery cutoff.

## Python Lab and Calibration

- Camera and hand detection start for camera/cvzone programs on Run and stop on completion, exception, Stop, or leaving the Python page. A pending permission request is cancelled if the run stops first.
- Browser Python includes a focused `cvzone.HandTrackingModule.HandDetector` subset (`findHands`, `fingersUp`) backed by the page MediaPipe hand model. Its cvzone-style skeleton, points, bounding box and label appear on video and processed OpenCV frames. `cv2.imshow` opens the movable, resizable output window. Full native cvzone and MediaPipe remain available through the laptop companion's requirements install.
- Calibration page adds a six-face *check*: collect +X/-X/+Y/-Y/+Z/-Z raw MPU6050 readings with propellers removed, verify orientation and stillness, compare scale with 1 g, then explicitly save additive offsets through the existing guarded NVS calibration command. It does not pretend to correct sensor scale.
- Larger default terminal and responsive six-face controls. Python editor and terminal remain scrollable.

## Build and hardware status

Source checks exercise PPM complete-frame publication, ESC/servo PWM conversion, Python example syntax, AP embedded scripts, browser camera cancellation and cvzone adapter logic. Firmware binaries are marked unavailable in the catalogs because no Arduino ESP32 toolchain or connected FlightCore was present. The real 250 Hz loop, motor directions, GPS measured Hz, webcam permission and flight behaviour must be checked on the actual kit. AP direct HTTP cannot expose a camera to standard secure-context browser APIs; use HTTPS or localhost for browser vision, or the laptop companion.
