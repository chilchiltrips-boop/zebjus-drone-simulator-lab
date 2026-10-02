# ZEBJUS Aerion V18.3.62

Aerion combines drone assembly, Python Lab, simulation and local-kit control. The Android Flight App is a separate flight interface with floating sticks and no Python editor.

## Start and connect

Laptop: extract the complete project and open `Start_Offline.bat` (Windows), `Start_Offline.command` (Mac), or run `python3 start_offline.py`. Open **http://localhost:8787/**. Python 3 or Node.js must already be installed to launch the local server. Join the kit Wi-Fi; the open WebApp automatically discovers the AP API for observation.

Android: install **android-app/dist/ZEBJUS_Aerion_V18_3_62_Android.apk**, open Aerion Flight → Connect drone → Connect kit Wi-Fi. Select the unique `ZEBJUS-FC-...` SSID for this Device ID. Password: **12345678**.

**AP is API only.** The controller no longer serves a browser Flight App, Wi-Fi setup or Hardware I/O page and has no captive redirect. `192.168.4.1` is the local API address. Open the APK or local/cached WebApp. Joining Wi-Fi alone does not launch desktop software or a closed phone app.

Top AP/STA changes the disarmed kit's persistent mode. Settings select saved Wi-Fi or save a new network. For STA, phone/laptop and kit must use the same router Wi-Fi; internet is not needed for local control. Android can show its Wi-Fi permission/approval dialog, and the laptop selects Wi-Fi through its OS.

## Ownership and transmitter display

An opened, connected APK reserves a MOBILE session without RC/ARM. Laptop becomes view-only, displays TRANSMITTER ON and mirrors received sticks. Fresh physical PPM does the same for the display. External display ON does not start laptop RC transmission.

WebApp top **Take Control ON/OFF** acquires/releases ownership; local transmitter ON and ARM remain separate actions. APK **Take control/STOP** enables/stops flight transmission. Refresh, resume, network change and reconnect do not restart flight output or Python.

A single telemetry failure no longer clears APK identity/control. Actual missed flight ACKs still stop transmission under the 300 ms watchdog. Settings-only release does not override PPM with an RC frame.

## Install and use the update

**Install the new APK and flash matching V18.3.62 firmware.** Updating GitHub files alone does not update a phone or running kit. A1 is bridge-only. A2/Aerion F1 supports MPU6050 Rate/Angle; altitude hold/automatic landing are not implemented. Choose the matching controller profile before USB/OTA. APP and FACTORY images with stable names and verified hashes are in `FlightCore_Firmware/`.

Offline Python, OpenCV/NumPy, Matplotlib/pandas, editor and hand model/WASM remain bundled. Ordinary `while True:` and simple Drone calls work. Examples are hidden by default; settings enable them. Camera needs localhost/HTTPS and permission. Hardware I/O remains in the WebApp and Python companion.

See [offline instructions](OFFLINE_START_HERE.md), [update/tests](SUPPORT/V18_3_62_UPDATE_AND_TEST.md) and [GitHub upload](GITHUB_UPLOAD_README.md).

```sh
npm start
npm run check
npm run release:check
```

After intentional changes, regenerate shared app copies, rebuild changed firmware/APK, and run `npm run release:seal`. Upload all batches to one staging branch and merge the completed, checked release once. Keep the final-batch integrity scripts and manifest.

Builds and automated checks are local. No real phone/emulator, physical kit, USB/OTA flash or loaded 250 Hz measurement was performed.
