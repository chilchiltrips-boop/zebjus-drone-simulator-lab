# V18.3.47 real-kit verification

The source and contract checks pass, but this revision has **not** been compiled or tested with a connected A2 flight kit or GPS here. Keep all propellers off for wiring, output, rate and failsafe checks. A software flag, diagram or 10 Hz configuration ACK is not proof of safe flight.

## CC3D X layout, facing front

| Logical motor | Physical position | Default FC ESC connector | ESP32-C6 GPIO | Mixer term | Planned spin |
| --- | --- | --- | --- | --- | --- |
| M1 | front left | D1 | 1 | `+roll −pitch +yaw` | CW |
| M2 | front right | D2 | 2 | `−roll −pitch −yaw` | CCW |
| M3 | rear right | D3 | 21 | `−roll +pitch +yaw` | CW |
| M4 | rear left | D0 | 0 | `+roll +pitch −yaw` | CCW |

The view assumes the FC arrow and nose point upward. Check motor numbering and actual rotation on the aircraft; if a motor spins the wrong way, disconnect power and swap two ESC-to-motor phase connections. Props must match measured spin. The route editor can permute the four ESC connectors; it cannot make a different GPIO a motor output. The 2D layout migrates older saved positions to these logical M numbers.

## Bench sequence

1. Install an A2/XIAO ESP32-C6 binary built from this source and `src/DroneGPS.cpp`; this archive itself has no prebuilt binary. Check `/api/status` for `ZFC-A2`, version `18.3.47`, exact Device ID and the `expansion.motors` mapping.
2. With props removed and the frame restrained, read PPM CH1–CH6 and their measured `ppmFrameHz`. Verify directions before changing edge/reversal. Read `flightLoopHz` and `loopOverruns`; target is 250 Hz, but trust the measured value under AP/STA traffic. CH6 low is Angle → Rate; high is direct Rate.
3. Run guarded individual motor tests M1 through M4, then Stop. Match each physical position and spin. Use a scope/pulse analyzer if available: safe 1000 µs gives approximately 1024 LEDC ticks at 250 Hz/12-bit; 1500 µs gives 1536 and 2000 µs gives 2048. The armed mixer intentionally uses the supplied **duty tick** formula with 1180 tick minimum, which is approximately 1152 µs. Never infer this behavior from a diagram alone.
4. Verify yaw-right PPM arm and yaw-left disarm with throttle ≤1050, centered roll/pitch and a one-second hold. Move yaw to center between gestures. Test the optional CH5 PPM switch mode separately. When armed at minimum throttle, leave all four primary sticks still and verify the 15-second auto-disarm. Web/AP/Python intentionally continue using CH5.
5. Verify positive roll/pitch disturbances result in the correct **corrective** motor action, plus yaw direction, disarm on RC loss, source switch, mode switch, IMU faults and loop overrun. Check motor-safe output after timeout and reboot. Do not assume the supplied gains suit a different prop/ESC/airframe.
6. Only after output, sensor, direction and failsafe checks, do a restrained low-power test with a suitable safety area. This project has no battery failsafe or GPS navigation control.

## Optional GPS 10 Hz check

The supplied `DroneGPS` library has a UBX `CFG-RATE` payload `64 00 01 00 01 00`, requesting one navigation cycle every 100 ms (10 Hz). It targets a compatible u-blox 7/NEO-7, probes 9600/38400, switches to 38400, requires configuration ACKs, enables POSLLH, VELNED and SOL, and counts complete synchronized iTOW epochs. This was verified by source inspection; **no live 10 Hz output was measured here**.

1. Power the module to its actual breakout specification with common ground. Connect GPS TX → FC RX on a free D7–D10 signal (D9/GPIO20 suggested), and FC TX on a different free signal → GPS RX (D8/GPIO19 suggested). These signal pins must not already be used by servo or GPIO output. The 2D reference draws signal and ground, not a verified module-specific power supply.
2. In Hardware I/O Studio or AP/STA `/io`, select `UBX_10HZ`, choose RX and TX, save and wait for FC reboot. It configures at boot, so acquire the control lock again after reconnect. In Python, the equivalent is `await drone.gps_config(pin=20, tx_pin=19, protocol="UBX_10HZ")`, then `await drone.gps_read()` after reconnect. Desktop `ZebjusClient` has synchronous equivalents.
3. Wait outdoors for a fix and read `gps_read` repeatedly. Check `configured`, `configError`, `fresh`, `fixValid`, `satellites`, `measuredHz` and `rateOk`. `measuredHz` counts complete UBX epochs over the preceding one-second window; startup, no receiver, or missing messages can produce 0 or a lower rate. `rateOk` requires a fresh measured rate between 9 and 11. Use a serial analyzer if a receiver reports the wrong baud or loses epochs.
4. To use a generic GPS with only TX, select `NMEA_9600`, assign FC RX and leave TX disabled. This returns recent raw NMEA sentences, not a verified 10 Hz epoch rate.

The source uses stock ESP32 `WiFi.h`/`WebServer.h` for AP/STA and RC transport; no custom `WiFiReceiver.h` is required. The GPS library is bundled in firmware `src`, not installed as a global Arduino IDE library when using the included build script. A1 remains bridge-only; A2 flight requires the supported MPU6050 flight configuration.
