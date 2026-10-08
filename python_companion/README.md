# Laptop Python companion

## Offline PyCharm over the kit AP

The basic `zebjus_simple.py` client uses only the Python standard library. Set up Python and PyCharm on the laptop ahead of time; then no internet connection or `pip install` is needed for the LED, IMU, GPIO, I²C and direct RC APIs.

1. Copy this whole `python_companion` folder to the laptop and open it as a PyCharm project. Choose a working Python 3 interpreter. For OpenCV, cvzone or MediaPipe lessons, install the optional `requirements-vision.txt` while internet is available, or bring compatible local wheels; the basic examples do not need them.
2. Join the kit's unique `ZEBJUS-FC-...` Wi-Fi using the password labeled on its case. On the laptop open `http://192.168.4.1/` and compare the Device ID on the app with the case. Accept **Stay connected / use without internet** if the OS prompts.
3. Run `pair_ap.py` in PyCharm and type the complete Device ID from the case. This saves only the URL and ID to `zebjus_pairing.json` beside `zebjus_simple.py`. It never records the AP password or automatically trusts an arbitrary kit. Re-run it to switch to another kit.
4. Run `main_ap.py` or write `from zebjus_simple import Drone; drone = Drone()` in a new script. `while True:` and `time.sleep()` are regular desktop Python. Press Stop / Ctrl+C to end repeating code. Use `with Drone() as drone:` or `drone.close()` to release control.

The kit serves a local HTTP API at `192.168.4.1`; source code, OpenCV windows and camera frames remain on the laptop. The same client can target school Wi-Fi STA by explicitly setting `ZEBJUS_KIT_URL` and the verified `ZEBJUS_DEVICE_ID`. `Drone.rc()` sends one channel frame, not a complete flight loop; a flight controller's failsafe and real hardware timing must be checked before using live RC projects. Only one browser or Python client can hold control at a time. A captive Wi-Fi mini-window may close or hide; use a normal browser for the Flight App.

Use this directory from macOS, Windows or Linux when a project needs native `cv2.VideoCapture`, MediaPipe Python, cvzone, or Matplotlib. These libraries run on the laptop; the ESP32 serves local status, IMU, telemetry, PID and calibration commands. The ZIP includes install instructions and source code, not OS-specific binary wheels.

1. Install a supported desktop Python version and connect the laptop and FlightCore to the same Wi-Fi. The kit's direct AP works too with its `192.168.4.1` address.
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
   python face_detection.py
   ```

   Windows PowerShell uses `$env:ZEBJUS_KIT_URL='http://zebjus_drone_1.local'` and `$env:ZEBJUS_DEVICE_ID='...'`.

For pin, I²C and motor routing projects, open `expansion_demo.py` in PyCharm. It reads the exact kit identity, all discovered I²C addresses, the four motor connectors and measured RC/loop rates without changing outputs. The commented examples show how to configure a servo, GPS, HT16K33 display and multiple spare GPIOs. After installing requirements, run `python expansion_demo.py`. A2 hardware outputs require the complete permanent Device ID; release a GPIO before assigning that pin to a servo or GPS.

`ZebjusClient` verifies the Device ID before every action. Mutating commands require the full ID, acquire the control lock, and should be used only while disarmed. Call `set_rate_pid`, `set_accel_offsets`, or `command('level_calibrate', samples=400)` inside a `with client_from_environment() as kit:` block. The three examples above are read-only; they never arm motors. Browser Python Lab remains the simplest path for students. Use its Camera / MediaPipe panel for browser camera frames and hand landmarks, and `drone.show_plot()` for inline Matplotlib graphs.

The firmware has no GPS navigation, LiDAR hold, battery failsafe or general-purpose camera processing. Vision runs on the laptop/browser and is intended for observation and learning, not a flight stabilization loop.

The five supplied Python files are included unchanged in `reference_uploads/`. See its README for their protocols and dependency differences. Browser OpenCV uses `browser_cv2.py` and a focused `browser_cvzone.py` HandDetector adapter inside Pyodide; `cv2.VideoCapture(0)`, `cv2.imshow()`, and `await drone.wait_key(30)` work there with browser camera permission. Desktop requirements are installed into a virtual environment using pip; native wheels cannot be bundled as universal Windows/macOS/Linux binaries.

Camera/hand scripts in the browser request permission on Run and stop video tracks on completion, Stop, or error. `from cvzone.HandTrackingModule import HandDetector` supports `findHands` and `fingersUp` for the included browser example; full cvzone and native MediaPipe remain laptop dependencies. Camera needs HTTPS/localhost (AP direct HTTP is not a secure context). A six-face MPU6050 check on the Calibration page captures six steady orientations, validates them and offers guarded persistent additive offsets; it does not automatically correct sensor scale.
