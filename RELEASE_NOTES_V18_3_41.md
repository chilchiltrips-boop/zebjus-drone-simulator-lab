# ZEBJUS Flight Lab V18.3.42

## Python Flight Lab + guarded PID tuning

- A2 / XIAO ESP32-C6 now supports persistent Rate + Angle PID read/write through the local command API. Real PID writes are accepted only while DISARMED, validated against guarded limits, saved to NVS and returned in acknowledgements/status.
- Separate tuning profiles are kept for RATE mode, ANGLE-mode inner Rate loop, and ANGLE outer Roll/Pitch loop.
- Python `Drone` bridge can read status/I2C/IMU/gyro/accel/attitude/PPM, read/write PID, send RC frames, calibrate gyro, inspect bench state, test individual motors/order, and start guarded ESC calibration.
- Python motor and ESC commands require `confirm="PROPS_REMOVED"` on a real A2 controller and are blocked while armed.
- Python project examples expanded to 27 editable projects covering sensors, diagnostics, receiver monitoring, PID tuning/step response, keyboard RC, scripted RC, motor/ESC bench work and combined custom projects.
- Python PID constants such as `PRateRoll`, `IRateRoll`, `DRateRoll`, `PAngleRoll`, etc. are mirrored into the Tripod Simulator when the Simulator target is run. Python RC frames also update simulator sticks/mode/throttle and motor behavior.
- Student Python Files is now a horizontal project strip. Editor/tools and IMU/terminal boundaries are draggable and saved per browser.
- Terminal default height is larger and resizable; terminal output is bounded, copyable, and stderr/runtime errors render in red.
- Python execution continues to use a fresh terminable Web Worker for every Run/Rerun.

## Flight / safety state

- A2 keeps the 250 Hz MPU6050 Rate/Angle flight loop, PPM → Web STA → Web AP RC priority, CH5 arm/disarm, CH6 mode selection and four ESC outputs on D1/D2/D3/D0.
- A1 / ESP32-C3 remains bridge-only until its final motor-output map is confirmed.
- BMP388 altitude hold, battery monitoring/failsafe, persistent six-face accelerometer calibration, optical-flow/GPS navigation and blackbox logging remain pending.
