# Laptop Python companion

Use this directory from macOS, Windows or Linux when a project needs native `cv2.VideoCapture`, MediaPipe Python, cvzone, or Matplotlib. These libraries run on the laptop; the ESP32 serves local status, IMU, telemetry, PID and calibration commands. The ZIP includes install instructions and source code, not OS-specific binary wheels.

1. Install a supported desktop Python version and connect the laptop and FlightCore to the same Wi-Fi.
2. Create a virtual environment and install once:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install -r requirements-vision.txt
   ```

   On Windows, activate with `.venv\Scripts\activate` instead.
3. Set the exact kit URL and optionally the full permanent Device ID for read-only examples:

   ```bash
   export ZEBJUS_KIT_URL=http://zebjus_drone_1.local
   export ZEBJUS_DEVICE_ID=THE_FULL_ID_SHOWN_IN_KIT_CONNECT
   python imu_plot.py
   python camera_telemetry.py
   python cvzone_hands.py
   ```

   Windows PowerShell uses `$env:ZEBJUS_KIT_URL='http://zebjus_drone_1.local'` and `$env:ZEBJUS_DEVICE_ID='...'`.

`ZebjusClient` verifies the Device ID before every action. Mutating commands require the full ID, acquire the control lock, and should be used only while disarmed. Call `set_rate_pid`, `set_accel_offsets`, or `command('level_calibrate', samples=400)` inside a `with client_from_environment() as kit:` block. The three examples above are read-only; they never arm motors. Browser Python Lab remains the simplest path for students. Use its Camera / MediaPipe panel for browser camera frames and hand landmarks, and `drone.show_plot()` for inline Matplotlib graphs.

The firmware has no GPS navigation, LiDAR hold, battery failsafe or general-purpose camera processing. Vision runs on the laptop/browser and is intended for observation and learning, not a flight stabilization loop.
