# ZEBJUS V18.3.44 — AP, Python vision and flight safety

- The ZIP now contains one complete GitHub-ready project directory. Upload its contents to the repository root; 3D models, thumbnails, app code and firmware source remain together.
- AP setup has Wi-Fi, kit-status and controller pages with responsive layouts and manual hidden SSID entry. `/fly` displays live state and serializes RC requests.
- Settings shows verified STA SSID, IP, RSSI, hostname, Device ID, saved Wi-Fi profiles and an ANGLE/RATE joystick selector. Phone, tablet and narrow laptop layouts received compact overrides.
- Firmware resets stored level calibration during factory reset, checks ESC PWM attachment, rejects moving gyro/level calibration, and records control-loop overruns. A long stall, expired/released control lock, or source loss disarms the A2 controller. Wi-Fi scans, setup tests and resets cannot interrupt armed flight or active bench output.
- The WebApp joystick serializes real RC frames and sends a safe frame on exit or power-off. Python Stop, completion and error queue a safe RC frame after any outstanding command if Python had requested ARM.
- Browser Python Lab captures camera frames, processes them with Pyodide OpenCV, displays Matplotlib plots and receives browser MediaPipe Hand Landmarker data. `python_companion/` supports native OpenCV, MediaPipe and cvzone on a laptop.
- A1 remains bridge-only. A2 flight output still requires MPU6050; detecting LSM6DS3 at 0x6B does not enable its flight driver. Battery sensing, navigation modes and free-flight validation remain outstanding.
- No new compiled firmware `.bin` is included. After source upload, the board-aware workflow must build both binaries. Verify catalog availability and board identity before flashing.

See `SUPPORT/FLIGHT_VALIDATION_V18_3_44.md` for prop-off checks, remaining risks and next steps.
