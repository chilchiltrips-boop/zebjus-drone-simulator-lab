# ZEBJUS F450 V18.3 Local Device Protocol

All endpoints are local HTTP on the ESP32 (port 80).

## Identity/status
`GET /api/status?clientId=<browser-session>`

Important fields: `kit`, `name`, `deviceId`, `hostname`, `ssid`, `ip`, `rssi`, `mode`, `locked`, `lockMine`, `benchRc`, `firmware`.

## Telemetry
`GET /api/telemetry`

Returns roll/pitch/yaw, gyro and battery placeholder fields until the real FC telemetry source is connected.

## Control lock
- `POST /api/control/acquire` (`clientId`)
- `POST /api/control/ping` (`clientId`)
- `POST /api/control/release` (`clientId`)

Lock expires after 10 seconds without heartbeat.

## Commands
`POST /api/command`

Form fields: `clientId`, `type`, plus command-specific values.

Non-read-only hardware commands require the local control lock. PID/calibration changes are rejected while armed. On the A2 flight profile, a fresh verified Web/AP/Python RC frame takes priority; PPM is fallback after the web frame expires. A source change while armed disarms. A1 remains bridge-only.

## V18.3.46 expansion commands

The FC serves responsive direct pages `/io` (AP and STA) and `/fly`. `GET /api/status` and `/api/telemetry` include `expansion`: logical motor connector/GPIO routes, PPM input pin/edge/reversal, configured servo/GPS pins, matrix address and active GPIO outputs. `receiver_read` reports the latest measured PPM/Web/loop rates.

| `type` | Form fields | Response / effect |
| --- | --- | --- |
| `pinmap_get` | none | read-only current expansion map |
| `motor_map_set` | `m1slot`…`m4slot` each 0–3 exactly once | A2 only; save map and reboot |
| `ppm_config` | `edge=RISING` or `FALLING`; `reverse0`…`reverse3` as 0/1 | saved roll/pitch/throttle/yaw input reversal |
| `i2c_read` | decimal `address`, `reg`, `length` (1–16) | raw bytes |
| `i2c_write` | decimal `address`, `reg`, `bytes` comma-separated (1–8) | disarmed register write, except the detected IMU |
| `servo_config` / `servo_write` | `pin=-1` or GPIO17/19/20/18; `pulseUs` 1000–2000 | A2 50 Hz PWM on one free D7–D10 pin |
| `gps_config` / `gps_read` | `pin=-1` or a free GPIO17/19/20/18; none to read | A2 RX-only NMEA at 9600 baud |
| `matrix_config` / `matrix_write` / `matrix_read` | address 112–119; eight comma-separated decimal `rows`; none | HT16K33 8×8 |
| `gpio_read` / `gpio_write` / `gpio_release` | free GPIO17/19/20/18; `value=0/1` on write | A2 3.3 V digital I/O; release drives LOW then returns pin to input |

`GET /api/i2c/scan` scans every address 1–126 and reports ACK devices. Read-only commands work without the control lock; mutations require `/api/control/acquire`. Bus operations and pin changes are blocked while armed or a bench motor test is active. The firmware implements only the listed drivers, not arbitrary I²C device-specific protocols.

## Rename
`POST /api/name` with `clientId`, `name`.

Requires control lock. Duplicate mDNS/kit names on the same Wi-Fi are rejected.

## V18.3.13 live health / physical receiver telemetry

`GET /api/telemetry` may now include:

- `rc`: 10 receiver channel pulse values (1000–2000 µs)
- `rcSource`: currently `PPM`
- `rcAgeMs`: age of the latest valid receiver frame
- `receiverHealth`: `OK`, `STALE`, or `NOT_FOUND`
- `sensorHealth`: object with `imu`, `barometer`, `lidar`, and `receiver`

The webapp mirrors a fresh physical receiver into the Tripod Simulator. Receiver loss centers Roll/Pitch/Yaw and stops the simulator. Throttle is not rewritten by the web input watchdog.

## V18.3.24 board identity / updater fields

`GET /api/status` additionally returns:
- `boardId` — stable ZEBJUS board profile ID, e.g. `ZFC-A1`.
- `boardName` — product-facing board name, e.g. `ZEBJUS FlightCore A1`.

`GET /api/firmware/info` returns the same `boardId` / `boardName` plus firmware version, flash capacity, OTA space, arm state and OTA capability. Firmware Center matches this ID against `FlightCore_Firmware/catalog.json` before it allows a board-specific image to be flashed.

The browser USB recovery path maps the low-level bootloader signature internally to the same board profile. Low-level silicon names are not shown as the product identity in the UI or API.

## V18.3.24 I2C scan

### `GET /api/i2c/scan`
Performs an on-demand scan of I2C addresses 1..126. The operation is blocked while the controller reports ARMED.

Example response:

```json
{
  "ok": true,
  "bus": 0,
  "sda": 8,
  "scl": 9,
  "clockHz": 100000,
  "count": 1,
  "errorCount": 0,
  "durationMs": 150,
  "devices": [
    {
      "address": 107,
      "addressHex": "0x6B",
      "hint": "possible LSM6DS3 / ISM330DHCX IMU"
    }
  ],
  "errors": []
}
```

`hint` is informational only. Multiple I2C devices can share the same default address across product families, so model identity must be verified separately when required.

`/api/status` and `/api/firmware/info` also expose `i2cScan`, `i2cSda`, and `i2cScl` capability fields.


## V18.3.24 Python / IMU endpoints

- `GET /api/i2c/scan` → raw JSON data; Python decides what to print.
- `GET /api/imu` → real LSM6DS3 scaled accelerometer (g), gyroscope (dps), raw counts and WHO_AM_I.
- IMU bench I²C operations are blocked while armed.

## V18.3.27 packaging / update note

The wire/API protocol remains compatible with V18.3.24. Packaging changed to stable replace-in-place firmware names: `ZEBJUS_FLIGHTCORE.ino` and board-specific `ZEBJUS_FLIGHTCORE_<board>_APP.bin`. Firmware semantic version remains available through the existing `FW_VERSION` / firmware-info fields.

## V18.3.43 Python Flight Lab / PID / bench commands

A2 / XIAO ESP32-C6 exposes the following `POST /api/command` types. Read-only commands (`pid_get`, `receiver_read`/`ppm_read`, `attitude_read`, `calibration_get`, `bench_status`) work in View Only mode. Commands that change PID, calibration, RC or motor/ESC state require the verified control-lock owner:

- `pid_get` — returns the complete persistent PID object.
- `pid_set` — accepts flattened fields such as `rateRollP`, `rateRollI`, `rateRollD`, `angleRatePitchP`, `angleRollP`, etc. Real writes are rejected while ARMED or while bench output is active. Accepted values are saved to NVS.
- `pid_defaults` — restores and persists the default Rate + Angle PID profile while disarmed.
- `receiver_read` / `ppm_read` — returns active RC source and CH1..CH10 values.
- `attitude_read` — returns filtered roll/pitch/yaw and rate-roll/pitch/yaw.
- `calibration_get` — returns persistent accelerometer X/Y/Z additive offsets, current gyro bias, Roll/Pitch trim, corrected acceleration and attitude.
- `calibration_set` — stores guarded X/Y/Z accelerometer offsets (±0.5 g) plus Roll/Pitch trim (±10°) in NVS while disarmed.
- `level_calibrate` / `calibrate_level` — while level/still, averages 100–1000 MPU6050 samples, calculates X=0 g / Y=0 g / Z=+1 g offsets, refreshes gyro bias and saves the offsets to NVS.
- `calibration_defaults` — restores factory offsets `-0.10`, `+0.03`, `+0.12` g and zero Roll/Pitch trim.
- `calibrate_gyro` — reruns the real A2 gyro-zero routine while disarmed and still.
- `rc_frame` — accepts 6–10 decimal channel values, each 1000–2000 µs, in `channels`. Fresh verified Web/AP/Python RC takes priority; PPM is fallback.
- `motor_test` — guarded single-motor low-pulse bench test. Requires `confirm=PROPS_REMOVED`.
- `motor_order_test` — M1→M4 bench sequence. Requires `confirm=PROPS_REMOVED`.
- `esc_calibrate` — guarded 3 s high + 3 s low calibration sequence. Requires `confirm=PROPS_REMOVED`.
- `motor_stop` — immediately ends a bench output operation and writes safe motor values.
- `bench_status` — reports the current bench state.

A1 / ESP32-C3 continues to expose bridge/read capabilities but rejects real motor/PID flight-output operations that require the A2 flight profile.

The Python `Drone` class maps these commands to `pid_get()`, `set_rate_pid()`, `set_angle_pid()`, `receiver()/ppm()`, `attitude()`, `get_calibration()`, `set_accel_offsets()`, `level_calibrate()`, `restore_calibration_defaults()`, `rc()`, `motor_test()`, `motor_order_test()`, `esc_calibrate()`, `motor_stop()`, `bench_status()`, and `calibrate_gyro()`.

## V18.3.46 status and control safeguards

- `/api/status` and `/api/telemetry` include `loopCount`, `maxLoopGapUs` and `loopOverruns` for timing diagnosis. `maxLoopGapUs` is the longest time since a scheduled 250 Hz tick, including startup/other disarmed work; inspect it together with overrun growth under load.
- On A2, an armed loop gap over 30 ms, expiring/releasing the owner lock during Web RC, or invalid IMU/RC fails safe. Changing Wi-Fi/reset/recovery, scan, and setup test are blocked while armed or bench output is active.
- `level_calibrate` rejects motion/large tilt. Factory reset clears PID and accelerometer offsets/trim. No attitude or motor output from an LSM6DS3 is used for A2 flight control in this version.
- AP setup `/` has Wi-Fi, kit status and controller navigation; `/fly` works directly on the local FlightCore. Browser camera/MediaPipe processing is separate from flight stabilization.


## V18.3.43 unified RC arbitration

- `WEB_STA` / `WEB_AP` frames are authoritative while fresh (`<300 ms`) and require the control lock.
- Physical `PPM` is automatic fallback when no fresh Web/AP/Python frame exists.
- A source transition while armed forces DISARM before the new source can arm.
- `/api/telemetry` exposes active `rcSource`, `rcAgeMs` and all ten `rc` channels so the browser can mirror PPM/AP/Python control into Tripod Simulator.
- Tripod real mirror and Python real target use the same guarded `rc_frame` endpoint.
