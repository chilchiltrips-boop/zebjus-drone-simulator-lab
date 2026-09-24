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

Non-read-only hardware commands require the local control lock. PID/calibration changes are rejected while armed. On the A2 flight profile, verified Web/AP RC is enabled with PPM-first source priority and a short stale-frame failsafe. A1 remains bridge-only.

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

## V18.3.41 Python Flight Lab / PID / bench commands

A2 / XIAO ESP32-C6 exposes the following `POST /api/command` types to the verified control-lock owner:

- `pid_get` — returns the complete persistent PID object.
- `pid_set` — accepts flattened fields such as `rateRollP`, `rateRollI`, `rateRollD`, `angleRatePitchP`, `angleRollP`, etc. Real writes are rejected while ARMED or while bench output is active. Accepted values are saved to NVS.
- `pid_defaults` — restores and persists the default Rate + Angle PID profile while disarmed.
- `receiver_read` / `ppm_read` — returns active RC source and CH1..CH10 values.
- `attitude_read` — returns filtered roll/pitch/yaw and rate-roll/pitch/yaw.
- `calibrate_gyro` — reruns the real A2 gyro-zero routine while disarmed and still.
- `rc_frame` — accepts `channels` with at least CH1..CH6. Fresh physical PPM retains priority over Web/AP RC.
- `motor_test` — guarded single-motor low-pulse bench test. Requires `confirm=PROPS_REMOVED`.
- `motor_order_test` — M1→M4 bench sequence. Requires `confirm=PROPS_REMOVED`.
- `esc_calibrate` — guarded 3 s high + 3 s low calibration sequence. Requires `confirm=PROPS_REMOVED`.
- `motor_stop` — immediately ends a bench output operation and writes safe motor values.
- `bench_status` — reports the current bench state.

A1 / ESP32-C3 continues to expose bridge/read capabilities but rejects real motor/PID flight-output operations that require the A2 flight profile.

The Python `Drone` class maps these commands to `pid_get()`, `set_rate_pid()`, `set_angle_pid()`, `receiver()/ppm()`, `attitude()`, `rc()`, `motor_test()`, `motor_order_test()`, `esc_calibrate()`, `motor_stop()`, `bench_status()`, and `calibrate_gyro()`.
