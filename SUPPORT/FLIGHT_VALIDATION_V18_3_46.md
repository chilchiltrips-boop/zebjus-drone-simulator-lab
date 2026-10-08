# V18.3.46 real-kit verification and extension notes

This release has passed source, JavaScript, Python template and ESC duty checks. It has **not** been flashed or flight-tested on hardware. Do not treat the software's `flightReady` flag as proof that motor direction, propeller rotation, IMU axes, PID signs or ESC calibration suit your assembled aircraft.

## Board and pin contract

| Function | ZFC-A2 / XIAO ESP32-C6 | ZFC-A1 / ESP32-C3 |
| --- | --- | --- |
| M1 front right CW | default D1 / GPIO1 | no verified motor output |
| M2 front left CCW | default D2 / GPIO2 | no verified motor output |
| M3 rear left CW | default D3 / GPIO21 | no verified motor output |
| M4 rear right CCW | default D0 / GPIO0 | no verified motor output |
| PPM input | D6 / GPIO16, configurable rising/falling edge | GPIO18 bridge input |
| I²C | D4 SDA / GPIO22; D5 SCL / GPIO23 | board SDA/SCL |
| Assignable spare signal | D7 / GPIO17; D8 / GPIO19; D9 / GPIO20; D10 / GPIO18 | unsupported for expansion outputs |
| Recovery BOOT | GPIO9 reserved | GPIO9 reserved |

The software mapping is a permutation of the four existing ESC output connectors. It does not turn any arbitrary pin into an ESC output. Servo and GPS may use distinct spare signal pins; GPIO can use each remaining unreserved pin independently; release an output before reassigning that pin. All are **3.3 V logic**. Drive a servo, LED load or other high-current device with a suitable external power source/driver and common ground. Never connect a 5 V signal directly to a 3.3 V GPIO. The LED matrix requires an HT16K33 controller; other modules need their own driver. GPS is RX-only at 9600 baud and displays a recent raw NMEA sentence.

## Before applying power to motors

1. Confirm this is the physical ZFC-A2 wiring; power off and remove all four propellers. Inspect common ground and polarity of each ESC control lead, PPM signal and each I²C accessory.
2. Build the A1 and A2 firmware in the included GitHub workflow or with `tools/build_firmware.py` and the documented Arduino ESP32 core. Flash the binary matching the board ID. Check that `status.firmware` and `status.deviceId` match the intended real kit. The archive itself does not include a built `.bin`.
3. In Kit Connect or the FC's `/io` page, read the motor map, then save any connector permutation. The FC reboots. Reconnect and verify all four saved routes, including the 2D reference wires.
4. With propellers removed, use the guarded 500 ms individual tests M1, M2, M3, M4. Confirm each **physical** motor position against the table. The software cannot infer which three phase wires were joined; verify actual CW/CCW rotation and swap two phase leads while power is disconnected if necessary.
5. Check 1000, 1500 and 2000 µs PWM outputs with a scope or pulse analyzer if available: at 250 Hz the expected 12-bit duties are 1024, 1536 and 2048 ticks. Bench tests command a low pulse and then return to 1000 µs. Confirm every motor stays stopped after Stop, a lost control lock or RC timeout.
6. Check the sensor model in status. A2's rate/angle flight loop currently requires MPU6050 at a working I²C address. If the actual kit has only LSM6DS3, keep it disarmed until a flight estimator for that sensor has been implemented and bench-verified.
7. Observe receiver `channels`, `ppmFrameHz`, `webRcFrameHz`, `flightLoopHz`, `loopOverruns` and active `rcSource`; do not assume PPM is 50 Hz or the FC is 250 Hz without a measurement. Flip PPM edge only when the actual pulse electrical polarity calls for it. Use independent channel reversals to confirm transmitter direction at CH1–CH4. CH5 remains arm and CH6 is mode.
8. With motors safe and the frame restrained, confirm correct corrective action under a deliberate roll/pitch disturbance and that yaw response has the required sign. Check disarm, Wi-Fi loss, RC loss, IMU error, watchdog and low-throttle arming gates before a first low hover. Tune Rate and Angle cascaded PID separately. There is no claimed battery telemetry or autonomous GPS failsafe here.

## AP, STA and Python

The same FC serves `/io` and `/fly` while its setup AP is active and while STA is connected. The WebApp's Hardware I/O Studio uses Kit Connect's verified Device ID and lock; the direct FC page acquires its own exclusive browser lock. Do not try to control a kit from both pages simultaneously. Read-only scans/reporting work without the lock; modifications require it and require a disarmed FC.

Browser Python: choose **Real ZEBJUS kit**, connect the selected ID, then use `await drone.pinmap_get()`, `motor_map_set`, `ppm_config`, `i2c_scan`, `i2c_read`, `i2c_write`, `servo_config`, `servo_write`, `gps_config`, `gps_read`, `matrix_config`, `matrix_write`, `gpio_read`, `gpio_write`, `gpio_release`. Select the included examples for syntax. Desktop/PyCharm: create a virtual environment, install `python_companion/requirements-vision.txt`, set `ZEBJUS_KIT_URL` and the full `ZEBJUS_DEVICE_ID`, then use `with client_from_environment() as kit:` and its corresponding synchronous methods. Camera/OpenCV/MediaPipe run in the browser or on the laptop, not inside the ESP32.

## Future extensions, after hardware identification

- Add an A2 LSM6DS3 flight estimator only after verifying orientation, scaling, calibration, sign and failsafe behavior on the real board.
- Add a device-specific GPS parser with fix validity and stale-data handling if location is needed; raw NMEA alone must never drive the motors.
- Add drivers for the exact LED matrix/servo/sensor models connected, using a safe register allowlist and timing budget.
- Add a real battery-voltage/current sensor and calibrated failsafe. The existing `battery: 0` telemetry is a placeholder.
- Record scope traces of ESC pulse width, jitter and loop rates under Wi-Fi, camera and I²C load; adjust scheduling before claiming stable flight.
