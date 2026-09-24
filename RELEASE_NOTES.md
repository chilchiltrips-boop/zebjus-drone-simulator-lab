# ZEBJUS F450 Drone Lab V18.3.37

- Integrates the supplied MPU6050 Rate-mode and Angle-mode control logic into the ZFC-A2 / XIAO ESP32-C6 firmware.
- A2 motor outputs: M1/M2/M3/M4 = D1/D2/D3/D0, 250 Hz, 12-bit PWM, 1000 safe minimum, 1180 armed idle.
- MPU6050 flight configuration follows the proven sketches: DLPF 0x05, ±8 g, ±500 dps, 250 Hz loop, 2000-sample gyro calibration.
- ANGLE mode: accelerometer angle + 1D Kalman roll/pitch -> angle P controller -> rate PID.
- RATE mode: stick directly commands roll/pitch/yaw rates.
- CH5 = arm/disarm; CH6 <1500 = ANGLE, >=1500 = RATE. Mode/source changes while armed force a disarm.
- RC arbitration: fresh PPM has priority; otherwise verified WebApp RC or the built-in direct AP transmitter is used. RC timeout disarms motors.
- Adds `/fly` direct-control page so the XIAO can be flown/bench-tested over its own AP without the hosted WebApp.
- WebApp real-kit joystick now recognizes flight-capable firmware instead of labelling it bench-only.
- A1 / generic ESP32-C3 remains bridge-only until its motor-output pin map is explicitly confirmed.
- Browser PID write and altitude/BMP388 hold remain intentionally disabled; the onboard fixed Rate/Angle profiles are active on A2.
