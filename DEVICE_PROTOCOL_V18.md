# ZEBJUS V18 Device / School Cloud Protocol

## Why Device ID instead of IP
Every flight-controller module uses a permanent ID derived from the ESP32 eFuse MAC, for example `ZJ-DRONE-C5C641`. DHCP may change the local school IP, but the Device ID stays the same.

## Device -> cloud hello
The ESP32 opens an outbound WebSocket to `/ws` after STA connects and sends:

```json
{
  "type": "hello",
  "clientType": "device",
  "deviceId": "ZJ-DRONE-C5C641",
  "deviceName": "F450 - Team 3",
  "schoolId": "STMARYS-HSS",
  "labId": "ROBOTICS-LAB",
  "firmware": "18.0.0",
  "mode": "STA / INTERNET",
  "ssid": "School_WiFi",
  "rssi": -61,
  "ip": "192.168.1.24",
  "token": "<device token>"
}
```

## Status heartbeat
Recommended every 3-5 seconds:

```json
{
  "type": "status",
  "deviceId": "ZJ-DRONE-C5C641",
  "mode": "STA / INTERNET",
  "ssid": "School_WiFi",
  "rssi": -61,
  "ip": "192.168.1.24",
  "armed": false
}
```

## Telemetry
The device can send existing telemetry fields. The cloud adds the Device ID before forwarding to browsers.

```json
{
  "type": "telemetry",
  "roll": 1.2,
  "pitch": -0.4,
  "yaw": 92.1,
  "gyroX": 0.2,
  "gyroY": -0.1,
  "gyroZ": 0.4,
  "battery": 11.8
}
```

## Cloud -> device command
Only the instructor who owns the server-side device lock can send commands.

```json
{
  "type": "device_command",
  "deviceId": "ZJ-DRONE-C5C641",
  "from": {
    "clientId": "...",
    "userName": "Instructor",
    "sessionId": "CLASS-A"
  },
  "command": {
    "type": "pid_set",
    "pid": {"rateRoll":{"P":0.9,"I":15,"D":0.035}}
  }
}
```

Supported application commands include `ping`, `pid_set`, calibration commands, coding/device commands and `set_identity`.

`rc_frame` exists only for supervised prop-off bench testing. It is blocked by the included server unless `ALLOW_REMOTE_BENCH_RC=true`. Free flight must use the direct AP control path.

## Classroom sharing
Instructor browser -> cloud:
- `presentation_state` - selected tab, selected module and PID
- `sim_state` - simulator state at about 10 Hz
- `joystick_state` - CH1-CH10 state
- `activity` - classroom action feed

Student browsers in the same School + Lab + Session receive these messages view-only.
