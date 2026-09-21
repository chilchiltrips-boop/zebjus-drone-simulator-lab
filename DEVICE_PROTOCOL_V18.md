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

Non-read-only hardware commands require the local control lock. PID/calibration changes are rejected while armed. Real web joystick is disabled by default in firmware.

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

## V18.3.23 board identity / updater fields

`GET /api/status` additionally returns:
- `boardId` — stable ZEBJUS board profile ID, e.g. `ZFC-A1`.
- `boardName` — product-facing board name, e.g. `ZEBJUS FlightCore A1`.

`GET /api/firmware/info` returns the same `boardId` / `boardName` plus firmware version, flash capacity, OTA space, arm state and OTA capability. Firmware Center matches this ID against `FlightCore_Firmware/catalog.json` before it allows a board-specific image to be flashed.

The browser USB recovery path maps the low-level bootloader signature internally to the same board profile. Low-level silicon names are not shown as the product identity in the UI or API.

## V18.3.23 I2C scan

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
