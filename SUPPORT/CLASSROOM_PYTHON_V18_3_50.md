# Classroom Python (Aerion F1)

Start with an empty main.py or type `from zebjus_simple import Drone`. This opt-in adapter inserts awaits for `drone` hardware methods, time.sleep and calls to student-defined helper functions. Keep the variable name `drone`. Advanced examples can still use `from zebjus import Drone` and explicit `await`. Simple mode currently supports ordinary `def`; avoid decorators, nested function calls through aliases, background threads and mixing in explicit `async/await`. Stop terminates the worker and releases the camera; the RC bridge sends a low-throttle disarm frame for active real RC sessions.

Settings > Python Classroom has a browser-local example visibility toggle, default OFF. It is not a teacher authentication mechanism or protection of example source. The example gallery can be enabled by anyone with access to the browser. No proprietary hardware security is provided by the Aerion F1 display name.

Keyboard lesson: W/S throttle, arrows for roll and pitch, A/D yaw, R arm only at low throttle, X disarm. It starts in simulator. Hand lesson uses browser camera and cvzone-compatible drawing; it commands neutral or gentle forward pitch in simulator with throttle held low and disarmed. Camera needs HTTPS/localhost and browser permission. Real flight from hand tracking is intentionally blocked while armed; video frame timing and gesture loss are not reliable flight control inputs.

LED lesson requires V18.3.49+ firmware compiled and flashed; without it, the device returns unknown command. The archive does not include a newly built firmware binary.

V18.3.51: type `while True:` exactly (capital T) and press Enter; indent the next line with four spaces. A bare `while True:` without an indented body is incomplete Python. Use the Stop button to end the loop.

V18.3.52 accepts standard Python `while True:`, `drone.led(1)` / `drone.led(0)`, and `cv2.waitkey(1000)` in simple mode. Use capital T in `True`; the wait is milliseconds and yields to the browser. Select Real kit, connect the exact Device ID, and flash firmware with onboard LED support before running. The built-in LED is active-low internally but the Python API uses 1=ON, 0=OFF.

V18.3.52 camera: the single Python output popup opens for camera runs. Its live frame is cleared when the camera stops; Matplotlib plots can remain in the same popup. The hidden video element is retained only for capture/MediaPipe.
