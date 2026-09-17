# ZEBJUS F450 Drone Engineering Lab — V18 School Cloud

V18 upgrades the V17.5.1 adaptive F450 engineering lab into a school-ready multi-module classroom system while retaining the existing 3D assembly, 2D wiring, tripod simulator, PID lesson, calibration, Python Lab, telemetry, PWA/offline assets and responsive layouts.

## V18 requested features

- Unique Module ID
- Device Name
- School / Lab association
- Multiple module selector
- Online / Offline status
- Individual Connect
- Server-enforced Device lock
- STA / Internet indicator
- AP / Flight indicator
- PID commands routed by Device ID
- Calibration commands routed by Device ID
- Telemetry routed by Device ID
- Coding / device command route
- Instructor / student classroom sessions
- Student view-only mode
- Instructor live tab sharing
- Shared PID values
- Shared simulator state
- Shared 10-channel joystick state
- Existing simulator retained
- Legacy direct local WebSocket retained under Advanced

## School architecture

### Flight / AP
Actual free flight remains a direct phone-to-drone path:

`Phone -> ZEBJUS_DRONE_xxxxxx AP -> flight controller`

Internet/STA is not the primary free-flight control path.

### School / STA / Cloud
For classroom work:

`ESP32 -> School Wi-Fi (STA) -> Internet -> ZEBJUS School Cloud`

and

`Instructor / Students -> Webapp -> ZEBJUS School Cloud`

Every module registers with a permanent Device ID such as `ZJ-DRONE-C5C641`. The local DHCP IP can change without changing module identity.

## Instructor / student behavior

An instructor joins a School + Lab + Session and may **Lock & Connect** one online module. The lock is enforced on the server. A second instructor cannot issue commands to that module until the first releases it or disconnects.

Students joining the same session are automatically **VIEW ONLY**. They may navigate/read the lab, select modules for viewing, see telemetry, and—when **Follow instructor** is enabled—follow the instructor's current tab, selected module, PID values, shared simulator state and 10-channel joystick state.

The simulator continues running locally in the browser, but student browsers can enter a remote-follower mode where the instructor's attitude, motor mix, targets and joystick inputs are mirrored.

## Web joystick

V18 adds a dedicated **JOYSTICK** tab:

- Left gimbal: CH3 Throttle + CH4 Yaw
- Right gimbal: CH1 Roll + CH2 Pitch
- CH5 Arm
- CH6 Flight Mode
- CH7 Alt Hold
- CH8 Beeper
- CH9 Camera / AUX
- CH10 LED / AUX
- Live CH1-CH10 monitor
- Simulator target
- Selected-module bench target
- Student mirror / view-only behavior

Remote Internet RC is disabled by default in the included cloud server. The joystick therefore works immediately with the simulator. To permit a supervised prop-off hardware bench test, the server operator must explicitly set `ALLOW_REMOTE_BENCH_RC=true`, and the device firmware must also deliberately accept `rc_frame` commands.

## Cloud server

The `cloud-server/` directory contains a small Node.js + WebSocket server that also serves the V18 webapp files.

### Local test

```bash
cd cloud-server
npm install
INSTRUCTOR_PIN=2468 DEVICE_SHARED_TOKEN=my-device-token npm start
```

Then open:

`http://localhost:8787`

The WebSocket endpoint is:

`ws://localhost:8787/ws`

For production, deploy behind HTTPS and use:

`wss://YOUR-DOMAIN/ws`

Environment variables:

- `PORT`
- `INSTRUCTOR_PIN`
- `DEVICE_SHARED_TOKEN`
- `ALLOW_REMOTE_BENCH_RC=false` recommended

The built-in default instructor PIN (`1234`) and device token are only for local/demo use. Change them before deployment. For a real commercial/school rollout, replace this simple gate with ZEBJUS account authentication and per-device credentials.

## ESP32 companion example

`esp32/ZEBJUS_F450_V18_STA_Cloud_Client.ino` demonstrates:

- eFuse-MAC based permanent Device ID
- unique AP SSID
- AP provisioning
- temporary AP+STA only for Wi-Fi scanning
- NVS Wi-Fi + identity storage
- no AP client + disarmed -> saved STA connection
- STA -> School Cloud device registration
- online status / RSSI / IP / firmware metadata
- cloud PID/calibration/device commands
- cloud telemetry scaffold
- AP fallback if STA fails
- no network-mode switching while armed

Libraries required by the example:

- Arduino-ESP32
- WebSockets by Markus Sattler
- ArduinoJson 7.x

The telemetry/PID/calibration hooks in that example are integration points for your actual flight-controller code.

## Files added / changed in V18

- `index.html` — School/Modules UI + Joystick tab
- `styles.css` — classroom, module, joystick and view-only layouts
- `app.js` — V18 bridge, cloud command routing and remote simulator follower
- `school-lab.js` — classroom sessions, roles, locks, module discovery, sharing and joystick
- `cloud-server/server.js` — WebSocket router, lock enforcement and static hosting
- `cloud-server/package.json`
- `DEVICE_PROTOCOL_V18.md`
- `V18_SCHOOL_CLOUD_SETUP.md`
- `esp32/ZEBJUS_F450_V18_STA_Cloud_Client.ino`
- `service-worker.js` — V18 cache

## Existing V17 lab retained

The following remain from V17.5.1:

- full F450 3D assembly workstation
- interactive 2D wiring and electrical validation
- F450 tripod physics simulator
- Rate Hold teaching mode
- calibrated Angle mode
- Rate and Angle PID learning tools
- PID P/I/D contribution lesson and presets
- motor mix visualization and audio
- calibration wizard
- Python/Pyodide lab
- live telemetry page
- responsive phone/tablet/laptop/desktop/TV layout
- PWA icons/offline cache
- ZEBJUS component branding and references

## Important safety separation

The School Cloud is suitable for configuration, teaching, simulation, telemetry, PID/calibration and supervised bench actions. Actual flight control should remain the direct low-latency AP/mobile path with flight-controller-owned failsafe logic.
