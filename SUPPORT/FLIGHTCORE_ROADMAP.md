# FlightCore implementation state and roadmap

## V18.3.38 implemented
- Same-Wi-Fi local control, AP provisioning/recovery, full-MAC Device ID and verified kit switching.
- Board profiles: A1 / ESP32-C3 and A2 / XIAO ESP32-C6.
- A2 real flight loop with MPU6050: 250 Hz Rate mode + Angle mode, boot gyro calibration, accelerometer roll/pitch, 1D Kalman fusion, fixed PID profiles and four-motor mixer.
- A2 motor mapping: M1/M2/M3/M4 = D1/D2/D3/D0, 250 Hz 12-bit PWM.
- RC source arbitration: PPM first, then WebApp RC / direct AP RC; stale source, source change, mode change, IMU failure and CH5 low drive the safe motor output.
- CH5 arm/disarm, CH6 ANGLE/RATE selection.
- Built-in `/fly` direct AP transmitter page.
- IMU auto-detect APIs: LSM6DS3 (0x6A/0x6B) and MPU6050 (0x68/0x69); A2 flight output currently requires MPU6050.
- I2C scan, raw IMU API, OTA update, browser control lock and board-aware APP builds.

## Still pending
- A1 real ESC/motor-output pin map and flight-loop enablement.
- Persistent gyro/accelerometer/level calibration storage and guarded recalibration workflow.
- Browser-side persistent live PID write/tuning.
- Battery voltage/current monitoring and battery failsafe.
- BMP388 pressure/altitude integration and altitude-hold mode.
- LiDAR/optical-flow/GPS navigation modes.
- Extended fault logging / blackbox.

Initial motor order, direction, arming and mode-switch checks should be completed with propellers removed before any prop-on flight test.
