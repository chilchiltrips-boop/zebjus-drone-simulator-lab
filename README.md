
### V18.3.14 additions
- Larger, higher-contrast Kit Connect controls and visible select options.
- Automatic default-kit scan fills Kit Name and cached IP.
- Top toolbar now shows KIT CONNECTED / KIT OFFLINE.
- TX10 ARM always requires throttle <=1050, including Altitude mode.
- Altitude throttle no longer springs to center; X forces DISARM + throttle 1000.

## V18.3.14 update

- TX10 transmitter ON/OFF, keyboard control and visual LED status indicators.
- Arm interlocks: Angle/Rate require low throttle; Altitude requires centered throttle.
- Altitude mode automatically centers CH3 and CH7 follows altitude mode.
- Joystick CH8 audio/beeper control removed; CH8 remains at safe reserve value.
- Kit Connection page refreshed for clearer same-Wi-Fi discovery and verified connection status.
- Service-worker/cache strategy fixed so normal refresh no longer falls back to an older build after the new worker is installed.

## V18.3.3 update

Automatic local kit naming/discovery now follows the Python Lab pattern using `zebjus_drone_N`. See `V18_3_3_AUTO_DISCOVERY.md`.

# ZEBJUS F450 Drone Engineering Lab V18.3

## What changed
V18.3 removes the cloud/WebSocket requirement for normal school-lab kit access and uses the same proven local connection model as ZEBJUS Python Lab.

- ESP32 joins the school Wi-Fi directly.
- Kit advertises its chosen Kit Name with mDNS (`kit-name.local`).
- Browser connects directly to the ESP32 HTTP API on the same LAN.
- Browser tries the last verified DHCP IP first, then mDNS fallback.
- Every connection verifies permanent `Device ID` before accepting cached IP.
- One browser has the real-hardware control lock; other browsers are view-only.
- Lock heartbeat auto-releases after 10 s if the controlling tab disappears.
- 1–4 transient health misses keep the UI connected; the 5th miss marks the kit offline and background reconnect starts.
- Simulator remains independent and available to everyone.
- Python Lab commands use the same selected local kit bridge.

## First-time student flow
1. Power the kit.
2. If it has no working saved Wi-Fi, connect to `ZEBJUS-SETUP-xxxxxx` (or the Kit Name based setup AP).
3. Captive setup should open automatically. Fallback: `http://192.168.4.1`.
4. Enter a unique Kit Name, select school Wi-Fi, enter password, then press **SAVE & TEST WI-FI**.
5. The firmware connects before saving. Wrong passwords are not saved. Duplicate Kit Names on the same Wi-Fi are rejected.
6. Reconnect the computer/phone to the same school Wi-Fi.
7. Open Drone Lab -> **KIT CONNECT** -> enter the exact same Kit Name -> **CONNECT KIT**.
8. After one successful connection, this browser remembers the verified IP + Device ID and reconnects automatically.

## Example
AP setup Kit Name: `F450-Team-3`

Normal local hostname: `http://f450-team-3.local`

Permanent identity example: `ZJ-DRONE-936314`

The display name may be changed, but the permanent Device ID never changes.

## Local webapp test
No npm package install is required:

```bash
npm start
```

Then open `http://localhost:8787`.

A hosted static copy (GitHub Pages/Wix/custom host) can also connect to the kit directly. Chrome/Edge may request Local Network Access permission; allow it. The connection helper uses the browser local-address-space request mode used by the Python Lab project.

## Firmware
Upload:

`ZEBJUS_F450_V18_3_LOCAL_WIFI.ino`

Board tested target: ESP32-C3 Dev Module / Arduino-ESP32 3.3.x.

## Recovery
- BOOT hold ~5 s, then release: force setup AP once.
- BOOT hold ~10 s: factory reset Kit Name and Wi-Fi.


## V18.3.6 Assembly layout
CURRENT STEP and BUILD CHECK now span the full width below the Assembly workspace for better readability and a shorter right-side panel.

### V18.3.14
Adds physical PPM transmitter mirroring, separate command-stream freshness, sensor health indicators, configurable joystick inactivity watchdog, and PID UNSAVED/SENDING/SAVED state tracking. The included local bridge reports the real PPM receiver on GPIO18; IMU/barometer/LiDAR health remains NOT FOUND until actual sensor-driver telemetry is integrated.
