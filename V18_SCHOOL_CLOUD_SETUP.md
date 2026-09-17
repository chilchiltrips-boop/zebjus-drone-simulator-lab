# V18 School Cloud Setup

## 1. Run locally for testing

```bash
cd cloud-server
npm install
INSTRUCTOR_PIN=2468 DEVICE_SHARED_TOKEN=my-device-token npm start
```

Open `http://localhost:8787` on the instructor and student computers.

Instructor:
- Role: Instructor
- same School ID / Lab ID / Session code
- enter the configured Instructor PIN

Students:
- Role: Student - View only
- same School ID / Lab ID / Session code
- no instructor PIN

## 2. Production hosting
Deploy the `cloud-server` Node application behind HTTPS so the WebSocket endpoint becomes `wss://YOUR-DOMAIN/ws`. The same Node server can serve the V18 webapp files.

Set environment variables:

- `PORT` - supplied by the host, or 8787 locally
- `INSTRUCTOR_PIN` - change from the demo default
- `DEVICE_SHARED_TOKEN` - change from the demo default
- `ALLOW_REMOTE_BENCH_RC=false` - recommended

For a production school rollout, replace the simple shared instructor PIN / device token with your real ZEBJUS user-account and per-device authentication service.

## 3. Multiple modules on one school Wi-Fi
All boards may use the same SSID. Each board connects outward to the cloud and registers its unique Device ID. Local DHCP addresses are informational only.

Example:

- `ZJ-DRONE-A10001` / F450 Team 1 / 192.168.1.21
- `ZJ-DRONE-A10002` / F450 Team 2 / 192.168.1.42
- `ZJ-DRONE-A10003` / F450 Team 3 / 192.168.1.87

The webapp selects and locks by Device ID, not IP.

## 4. One drone, one instructor, many student computers
The instructor clicks **Lock & Connect**. The server grants a single control lock. Students in the same class session are view-only and receive:

- instructor tab changes when Follow Instructor is enabled
- PID values
- selected module
- live telemetry
- simulator attitude / motor response
- web joystick CH1-CH10 state
- instructor activity feed

A second instructor cannot control the same module until the first instructor releases it or disconnects.

## 5. Flight network behavior
Recommended firmware behavior remains:

- phone connected to drone AP -> AP-only flight mode; STA off
- AP settings page may temporarily enable STA only to scan/save school Wi-Fi
- no AP client + drone disarmed -> try saved STA school Wi-Fi
- STA connected -> register to cloud by Device ID
- STA unavailable -> return to AP fallback
- never change AP/STA mode while armed

The Internet joystick in V18 is for simulator / supervised prop-off bench use, not the primary free-flight transmitter.
