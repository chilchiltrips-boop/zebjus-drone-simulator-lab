# ZEBJUS V18.3.50 — classroom Python and Aerion F1

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
