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
