# ZEBJUS F450 Drone Engineering Lab V18.2 Easy Access

V18.2 is designed for school labs where students should not type IP addresses, WebSocket paths, instructor PINs, school IDs, or session codes.

## Student flow

1. Power the kit.
2. Connect to its `ZEBJUS_...` Wi-Fi AP.
3. Captive setup opens automatically on most devices. Fallback: `http://192.168.4.1`.
4. Choose a Kit Name, school Wi-Fi and password.
5. Tap **SAVE & TEST WI-FI**. Credentials are saved only after a successful connection test.
6. The kit switches to STA mode and the browser redirects to the web app with the permanent Device ID in the URL.
7. The web app auto-discovers same-network kits, auto-selects the exact configured kit, and attempts to take the single-controller lock.

## V18.2 updates

- Single-user real-kit control lock.
- Other browsers remain View Only for hardware but can view telemetry and use their own simulator.
- Automatic lock release on browser disconnect or heartbeat timeout.
- Auto kit discovery every few seconds.
- Wi-Fi Save & Test before writing credentials.
- Improved captive portal detection endpoints.
- Exact AP-configured Kit Name is sent to the web app together with the permanent Device ID.
- Simulator and Real Hardware are visually separated.
- Factory reset from captive portal.
- BOOT recovery: ~5 s forces AP setup; ~10 s factory resets.
- Simple Webapp / Kit / Control / Network status indicators.
- Offline kits remain visible briefly with last-seen state.

## Permanent identity

The displayed Kit Name can change, but the permanent Device ID does not:

`ZJ-DRONE-936314`

Server routing and exact auto-selection use Device ID. The Kit Name is the student-friendly label.

## Server

All webapp and server files are in this same folder.

```bash
npm install
DEVICE_SHARED_TOKEN=zebjus-lab-device npm start
```

Default port: `8787`.

For local testing the ESP32 should use the Mac/server LAN IP and TLS disabled, for example:

```cpp
const char* CLOUD_HOST = "192.168.1.5";
const uint16_t CLOUD_PORT = 8787;
const bool CLOUD_TLS = false;
```

Production example:

```cpp
const char* CLOUD_HOST = "lab.zebjus.com";
const uint16_t CLOUD_PORT = 443;
const bool CLOUD_TLS = true;
```

`DEVICE_TOKEN` in the ESP32 code must match `DEVICE_SHARED_TOKEN` on the server.

## Single-controller rule

The first browser that selects an available online kit receives the hardware control lock. A second browser sees the same kit as **VIEW ONLY**. The lock is released when the controller presses Release Kit, disconnects, or stops sending lock heartbeat for the configured timeout.

This is server-side enforcement; changing browser buttons with Developer Tools does not bypass it.

## Real flight safety

The Internet/STA joystick defaults to the simulator. Real hardware joystick remains disabled unless the server is explicitly started with supervised bench RC enabled. Actual free-flight control should use the direct AP/mobile flight-control path.
