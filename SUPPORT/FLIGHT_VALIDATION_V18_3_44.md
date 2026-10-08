# FlightCore A2 validation and next steps

## What the release verifies in code

- A2/XIAO ESP32-C6 drives M1–M4 at D1/D2/D3/D0 only when LEDC attachment succeeds and an MPU6050 is detected/configured. A1 remains a sensor/Wi-Fi bridge.
- At startup and on recalibration the frame must be still. Level capture also rejects large tilt/vibration. The loop samples MPU6050 when disarmed, exposes its counter/longest gap/overrun counter, and disarms if an armed scheduler gap exceeds 30 ms.
- A fresh, locked Web/AP/Python RC source has priority over PPM; source changes, signal loss, CH5 low, mode changes, IMU faults, lock loss and the long-loop guard force safe motor output. Recovery/Wi-Fi scanning and OTA are blocked during armed flight.
- PID and accelerometer offsets are persistent and range-checked. A factory reset clears both. ANGLE and RATE modes are selected through CH6; there is no real altitude mode.

## Hardware checks required before propeller flight

1. Compile and flash the correct **A2** application image. Confirm firmware `18.3.44`, board `ZFC-A2`, detected `MPU6050`, and `flightReady=true` in Kit Status. LSM6DS3 at `0x6B` can be read for student projects; it is **not** an A2 flight-control IMU in this release.
2. Remove propellers, secure the frame, inspect ESC signal/GND and supply. Confirm M1/M2/M3/M4 pins and ESC output pulse width with a scope or logic analyzer. Check motor order and direction using the guarded short motor tests.
3. Capture level on a stationary Z-up frame and record X/Y/Z offsets and gyro biases. Tilt/rotate by hand and check that displayed Roll/Pitch/Yaw rate signs and motor correction directions match the frame. Verify arm at throttle 1000 only, disarm, and that mode change requires a new arm cycle.
4. Test RC timeout, switching Web/PPM, phone screen lock, browser backgrounding, control lock expiry, low Wi-Fi signal and a long web request with propellers removed. Inspect `loopOverruns`/`maxLoopGapUs`; repeated disarms show that the synchronous HTTP/250 Hz design needs scheduling work before free flight.
5. Conduct restrained/tethered thrust tests under a qualified pilot. Record step responses and motor saturation to tune PID for the actual F450/prop/ESC/battery combination. Simulator and prior quad PID values cannot prove stability on this airframe.

## Next engineering work

| Priority | Change | Acceptance evidence |
| --- | --- | --- |
| 1 | Move the 250 Hz control loop to deterministic scheduling and measure worst-case jitter under Wi-Fi, AP and telemetry traffic | Timing log with no missed flight deadlines at intended load |
| 2 | Add real battery voltage/current sensing, low-voltage actions and hardware watchdog; validate failsafe behavior | Measured thresholds and power interruption tests |
| 3 | Add a separately calibrated LSM6DS3 flight driver if this is the installed IMU | WHO_AM_I, axis/sign, ODR/filter, stationary and dynamic bench records |
| 4 | Bench-identify airframe/motor order, rotation and PID values, then restrained tests | Recorded roll/pitch/yaw response and repeatable safe disarm |
| 5 | Integrate BMP388, rangefinder, optical flow and GPS one mode at a time | Sensor validity gates, estimator logs and controlled mode transitions |
| 6 | Add timestamped blackbox, flash-safe diagnostics, command authentication/pairing and AP credential provisioning | Reproducible faults, authorized control, no default shared AP password |

Browser camera/MediaPipe and laptop cvzone projects remain outside the flight stabilization loop. Real navigation must never infer GPS/altitude capability from visualization alone.
