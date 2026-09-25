# FlightCore implementation state and roadmap

## V18.3.44 implemented
- Same-Wi-Fi local control, AP provisioning/recovery, full-MAC Device ID and verified kit switching.
- Board profiles: A1 / ESP32-C3 and A2 / XIAO ESP32-C6.
- A2 real flight loop with MPU6050: 250 Hz Rate mode + Angle mode, boot gyro calibration, accelerometer roll/pitch, 1D Kalman fusion and four-motor mixer.
- A2 motor mapping: M1/M2/M3/M4 = D1/D2/D3/D0, 250 Hz 12-bit PWM.
- RC source arbitration: fresh locked WebApp/Python/direct AP RC first, then PPM fallback; stale source, source change, mode change, IMU failure, CH5 low, expired lock and long scheduler stalls drive safe motor output.
- CH5 arm/disarm, CH6 ANGLE/RATE selection.
- Built-in responsive `/fly` direct AP transmitter and page-wise AP Wi-Fi/status portal.
- IMU auto-detect APIs: LSM6DS3 (0x6A/0x6B) and MPU6050 (0x68/0x69); A2 flight output currently requires MPU6050.
- I2C scan, raw IMU API, OTA update, browser control lock and board-aware APP builds.
- Guarded persistent PID read/write for RATE, ANGLE inner-rate and ANGLE outer loops; DISARMED-only real-FC writes stored in NVS.
- Python command bridge for receiver/attitude/PID/RC/gyro-calibration and props-removed motor/ESC bench operations.
- Python code-to-Tripod reflection for PID variables, flight mode, throttle and RC/stick movement.
- Persistent X/Y/Z accelerometer offsets and level trim with still/level capture checks; guarded flight-loop diagnostics, responsive Settings Wi-Fi/flight-mode controls, browser OpenCV/Matplotlib/MediaPipe and native Python companion.

## Still pending
- A1 real ESC/motor-output pin map and flight-loop enablement.
- Persistent gyro-bias storage and validated LSM6DS3 flight-driver integration (level offsets/trim are already persistent on A2).
- Battery voltage/current monitoring and battery failsafe.
- BMP388 pressure/altitude integration and altitude-hold mode.
- LiDAR/optical-flow/GPS navigation modes.
- Extended fault logging / blackbox.
- Secure device pairing and a unique AP password; the current default AP password is shared and should be changed before a classroom fleet is flown.

Initial motor order, direction, arming and mode-switch checks should be completed with propellers removed before any prop-on flight test.
