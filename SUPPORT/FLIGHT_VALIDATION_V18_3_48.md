# V18.3.48 kit verification before propellers or flight

Use the real A2/XIAO ESP32-C6 and the MPU6050 flight profile. Keep propellers removed and power constrained during every motor/ESC test.

1. Read `/api/status` and confirm exact Device ID, firmware version, `flightReady`, IMU model, `receiverPin`, and output watchdog state. A1 is not a flight profile.
2. Physically trace ESC connectors: M1 front-left → D1, M2 front-right → D2, M3 rear-right → D3, M4 rear-left → D0 by default. Test each motor alone at a guarded low pulse, then check spin and prop orientation on the hardware. Saved mapping can override defaults.
3. Confirm the actual PPM signal wire goes to D6/GPIO16 or D10/GPIO18 before selecting that pin. Read CH1–CH6, arm switch/gesture, edge, reversals and `ppmFrameHz`. Drop frames, disconnect receiver, and verify timeout/minimum output without propellers.
4. In AP and STA modes, measure `webRcFrameHz`, `flightLoopHz`, maximum loop gap and watchdog trip counts under UI/telemetry traffic. Exercise software stall recovery only with ESCs and motors safely isolated; a software task does not replace ESC/receiver hardware failsafes.
5. Perform still gyro/level capture and the six-face check; re-read persistent offsets. Check roll, pitch, yaw corrections and motor mix directions on a restrained test frame before any flight.
6. For UBX GPS, reconnect after configuration and observe `gps_read.measuredHz` and `rateOk` on the actual NEO-7. Navigation is not implemented.
7. Browser webcam scripts need HTTPS/localhost permission. Run/Stop and finish should extinguish the camera indicator. Laptop companion installs native vision requirements separately.
8. Add and calibrate a compatible battery monitor and battery failsafe in a hardware-specific release before relying on battery data. The present firmware reports `batteryValid:false`.

No firmware image is bundled; the Arduino-ESP32 core/build and physical flight validation remain pending.
