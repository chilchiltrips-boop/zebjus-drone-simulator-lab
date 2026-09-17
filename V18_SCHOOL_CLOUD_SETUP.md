# V18.2 Easy Access Server Setup

The webapp and Node.js WebSocket server are in the same folder.

## Install / run

```bash
npm install
DEVICE_SHARED_TOKEN=zebjus-lab-device npm start
```

The browser automatically connects to `/ws` on the same webapp host. There is no Instructor PIN, role, School ID, Lab ID or classroom code.

## Local school-lab test

If the server computer LAN IP is `192.168.1.5`, use this in the ESP32 firmware:

```cpp
const char* CLOUD_HOST = "192.168.1.5";
const uint16_t CLOUD_PORT = 8787;
const bool CLOUD_TLS = false;
```

Students on the same Wi-Fi open:

`http://192.168.1.5:8787`

The kit and browser are grouped by their observed network, so same-network kits appear automatically.

## Production

Deploy the folder on a Node.js-capable host, then configure the ESP32 for the production host. The web page and WebSocket endpoint should share the same host when possible.

## Hardware control lock

Only one browser may send hardware-changing commands to a kit at a time. Other browsers are View Only for real hardware. Lock ownership is server-side and automatically expires if browser heartbeat stops.

## Optional supervised bench RC

Real-hardware Internet joystick is disabled by default. To enable it only for supervised prop-off bench testing:

```bash
ALLOW_REMOTE_BENCH_RC=true DEVICE_SHARED_TOKEN=zebjus-lab-device npm start
```

This setting does not change the recommendation that actual free flight use the direct AP control path.
