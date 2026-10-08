# ZEBJUS F450 Drone Lab V18.3.35

Reliability architecture update:
- Full 48-bit MAC Device IDs with legacy-ID migration matching.
- Truthful FOUND vs VERIFIED CONNECTED kit state and safer kit switching.
- Bridge telemetry polling remains live even while the real flight-control loop is pending.
- Python executes in a fresh isolated Worker; Stop terminates non-cooperative infinite loops; project import/export and bounded terminal retained.
- IMU tools: auto-detected LSM6DS3 / MPU6050, live accel/gyro charts, age/rate, CSV recording, browser teaching calibration.
- Firmware profiles for C3/A1 and XIAO ESP32-C6/A2, APP builds for both and FACTORY publication when Arduino produces a merged image.
- Imported ESP firmware receives magic/segment/empty-data/chip-ID validation before flashing.
- 3D U/V/W wiring remains visible in Object view; bullet endpoints and direct PDB rail-short validation added.
- Bottom/top frame separation increased with taller riser geometry.
- Tripod dust motion reduced and de-swirled for visual comfort.

Important: this release is still Wi-Fi + receiver + sensor bridge firmware. Onboard attitude fusion, ESC output loop, PID/mixer, real calibration and battery/altitude flight integration remain pending.
