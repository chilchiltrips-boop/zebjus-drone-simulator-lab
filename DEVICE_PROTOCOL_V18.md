# ZEBJUS V18.2 Device / Browser Protocol

WebSocket endpoint: `/ws`

## Device hello

```json
{"type":"hello","clientType":"device","deviceId":"ZJ-DRONE-936314","deviceName":"F450-Team-3","firmware":"18.2.0","mode":"STA / INTERNET","ssid":"SchoolWiFi","rssi":-58,"token":"..."}
```

## Browser hello

```json
{"type":"hello","clientType":"browser"}
```

## Auto discovery

```json
{"type":"list_devices","query":""}
```

Device list entries include `online`, `locked`, and `lockMine`.

## Single-controller lock

Acquire:

```json
{"type":"acquire_lock","deviceId":"ZJ-DRONE-936314"}
```

Heartbeat:

```json
{"type":"lock_heartbeat","deviceId":"ZJ-DRONE-936314"}
```

Release:

```json
{"type":"release_lock","deviceId":"ZJ-DRONE-936314"}
```

Hardware-changing `device_command` messages are accepted only from the browser holding the lock. `ping` is allowed without the lock.

## Device command

```json
{"type":"device_command","deviceId":"ZJ-DRONE-936314","command":{"type":"pid_set","pid":{}}}
```

The server routes commands by permanent Device ID, never by Kit Name or DHCP IP.
