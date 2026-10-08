# Aerion Flight App on direct AP · V18.3.54

The board's own Wi-Fi hosts a lightweight controller app; no hosted website, mobile app store or internet is needed. The AP SSID and unique password remain per kit. After joining, supported operating systems may present a captive network sign-in window because the kit answers HTTP connectivity probes with the Flight App. For the actual controls, open **`http://192.168.4.1/` in a normal browser**: captive mini-windows are OS-managed and can close or suspend in the background. Keep the phone/laptop on this AP even when the OS says it has no internet.

| Local address | Purpose |
| --- | --- |
| `/` | AP Flight App landing page with touch sticks, ARM/DISARM, mode, telemetry and offline Python guide |
| `/fly` | Same direct controller for old links and STA use |
| `/setup` | Wi-Fi setup, saved profiles, mode switch and kit identity |
| `/io` | Expansion GPIO, I²C, PPM, ESC mapping and guarded bench controls |
| `/api/status` | Device ID and mode check for browser/Python clients |

Only the flight controller web pages and Python HTTP API are hosted on the ESP32. A laptop on its AP can open the `python_companion` folder in PyCharm and run `pair_ap.py` once, typing the full Device ID printed on the case. That creates a local `zebjus_pairing.json` file. Scripts using `from zebjus_simple import Drone` then run on the laptop and communicate at `192.168.4.1`, with ID verification and a control lock. The Python source is not uploaded to the ESP32. Basic code needs only installed Python; install optional OpenCV/MediaPipe packages before going offline or bring suitable offline wheels.

There is no onboard video camera or autonomous takeoff/landing command in this firmware. The app exposes deliberate manual ARM, sticks, mode and live telemetry; it does not draw a fake video feed. Propellers must be removed for first motor/RC validation. AP captive auto-display depends on Android/iOS/macOS/Windows behavior and is not guaranteed; the manual address always remains available on the AP.
