# Classroom Python (Aerion F1)

Start with an empty main.py or type `from zebjus_simple import Drone`. This opt-in adapter inserts awaits for `drone` hardware methods, time.sleep and calls to student-defined helper functions. Keep the variable name `drone`. Advanced examples can still use `from zebjus import Drone` and explicit `await`. Simple mode currently supports ordinary `def`; avoid decorators, nested function calls through aliases, background threads and mixing in explicit `async/await`. Stop terminates the worker and releases the camera; the RC bridge sends a low-throttle disarm frame for active real RC sessions.

Settings > Python Classroom has a browser-local example visibility toggle, default OFF. It is not a teacher authentication mechanism or protection of example source. The example gallery can be enabled by anyone with access to the browser. No proprietary hardware security is provided by the Aerion F1 display name.

Keyboard lesson: W/S throttle, arrows for roll and pitch, A/D yaw, R arm only at low throttle, X disarm. It starts in simulator. Hand lesson uses browser camera and cvzone-compatible drawing; it commands neutral or gentle forward pitch in simulator with throttle held low and disarmed. Camera needs HTTPS/localhost and browser permission. Real flight from hand tracking is intentionally blocked while armed; video frame timing and gesture loss are not reliable flight control inputs.

LED lesson requires V18.3.49+ firmware compiled and flashed; without it, the device returns unknown command. The archive does not include a newly built firmware binary.
