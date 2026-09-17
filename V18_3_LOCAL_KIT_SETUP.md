# V18.3 Local Kit Setup

## Connection path

`Browser -> same school Wi-Fi -> ESP32 kit HTTP API`

There is no device cloud registry in the normal lab path.

## Browser lookup order
1. Cached verified IP for that physical Device ID.
2. `<kit-name>.local` mDNS fallback.
3. Known/default kit scan for previously seen or standard names.

The browser accepts a device only when `/api/status` reports `kit=ZEBJUS_F450` and the expected permanent Device ID (when known) matches.

## Multi-user
The ESP32 itself owns the control lock. This is important because a frontend-only lock can be bypassed.

- `/api/control/acquire`
- `/api/control/ping`
- `/api/control/release`
- 10-second automatic expiry

Read-only status/telemetry stays available to other users while locked.

## Captive setup
Wildcard DNS + common Android/iOS/macOS/Windows captive probe endpoints redirect to the setup page. If the OS does not open it, use `192.168.4.1`.
