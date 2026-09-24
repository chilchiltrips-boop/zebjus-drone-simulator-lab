# FlightCore implementation state and roadmap

## V18.3.35 implemented
- Same-Wi-Fi bridge, AP provisioning/recovery, unique full-MAC Device ID and verified kit switching.
- Board profiles: A1 / ESP32-C3 and A2 / XIAO ESP32-C6.
- IMU auto-detect: LSM6DS3 (0x6A/0x6B) and MPU6050 (0x68/0x69).
- PPM receiver bridge telemetry, I2C scan, raw IMU API, OTA update and browser control lock.
- Board-aware APP builds. FACTORY package is published only when Arduino produces a verified merged image.

## Intentionally NOT implemented yet
The firmware role is `WIFI_SENSOR_BRIDGE` and reports `flightCoreIntegrated=false`.
- Onboard attitude/sensor-fusion loop
- Real ESC PWM outputs / motor mixer
- Rate and Angle PID loops
- Persistent real-flight gyro/accelerometer/level calibration
- Receiver failsafe integrated with motor outputs
- Battery monitoring
- Barometer/LiDAR altitude control
- Optical-flow/GPS navigation

These features should be integrated and bench-tested in stages before any prop-on flight test.
