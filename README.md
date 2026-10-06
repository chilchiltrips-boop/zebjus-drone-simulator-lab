> **18.3.68 update:** Install the matching APK and A1/A2 firmware. App home has **Tripod / Flight Training / Real Joystick** buttons. Simulation does not require a ready IMU or a propeller-removal checkbox; physical outputs stay DISARMED. Open the corresponding web simulator on the same kit Wi-Fi, then ARM the virtual drone in the app. See [update guide](SUPPORT/V18_3_68_UPDATE_AND_TEST.md).

# ZEBJUS Aerion V18.3.68

This release keeps **Python Lab fifth**: Assembly → Wiring → Setup Wizard →
Hardware I/O → Python Lab. Embed the lab in Wix using `?embed=wix`; the compact
layout follows the iframe viewport and provides **Open full lab** for camera,
USB or local-kit features blocked by parent permissions. See [Wix setup and
permissions](WIX_EMBED.txt) and the ready-to-paste [HTML embed](WIX_EMBED.html).
APK **18.3.68-android.1** is rebuilt with the same development certificate.
Firmware **18.3.68** adds ZRC2 simulator streaming at 50 Hz. PID tuning previews in Tripod; Tripod edits stay virtual. Setup configuration continues when another browser tab is open; hiding a running motor/ESC test stops its output.

Kit discovery preserves the connected browser's verified control ownership.
If setup stops, **Back** still reaches Board and **Restart setup** opens a fresh
setup with a new propeller-removal confirmation. Genuine ownership, connection
or page loss still ends the setup and blocks further output commands.

Aerion combines drone assembly, Python Lab, simulation and local-kit control. The Android Flight App is a separate flight interface with floating sticks and no Python editor.

## Guided FC configuration

Open the web lab's **Setup Wizard** page after Assembly Lab and 2D Wiring. Hardware I/O provides individual calibration, PID and connector tools. Firmware & Connect combines kit discovery and Upgrade / Upgrade & Erase. The Telemetry cockpit shows live instruments and leaves unsupported sensor readings unavailable. The compact APK gear contains Controls, Safety and Wi-Fi; full FC setup lives in the web lab.

**Flight Training** has sixteen progressively unlocked missions in a grass airfield with a detailed quadcopter, rolling terrain, racing arches, route markers, wind turbines, buildings and ZEBJUS advertisements. Smoothed keyboard/rate joystick throttle holds on release. Forward/backward and lateral movement follow the aircraft’s heading; its tilt and rotors match the flight. Chase, FPV, Orbit and Overview views, **Find drone**, a north-up course map and a ground projection keep position clear. Ring guidance shows distance, height, entry direction and movement relative to the drone nose; HOME always marks the take-off point, with a separate FINISH pad when needed. Physical ring contact blocks the virtual drone and alerts the pilot to back off or recover without skipping a gate. New missions add height-changing rings, slalom, survey photos, rescue beacons, a three-pad landing tour and a timed wind return. Balanced 30 FPS, High 60 FPS and a lightweight canvas fallback support compact Wix views. Use local controls or the guarded app/PPM training bridge with propellers removed. Training inhibits real motor outputs and lease loss requires neutral sticks and manual re-arm. Read the [update and test steps](SUPPORT/V18_3_66_UPDATE_AND_TEST.md). ESC setup now includes the pilot-confirmed battery/props checklist, HIGH → Stop/LOW sequence and timeout recovery. Output calibration highlights each motor with rotation direction, a µs slider, bounded 2 s Start/Stop tests and observed-start recording for all four motors. A1 remains bridge-only; physical motor response and flight still require hardware verification.

## Start and connect

Laptop: extract the complete project and open `Start_Offline.bat` (Windows), `Start_Offline.command` (Mac), or run `python3 start_offline.py`. Open **http://localhost:8787/**. Python 3 or Node.js must already be installed to launch the local server. Join the kit Wi-Fi; the open WebApp automatically discovers the AP API for observation.

Android: install **android-app/dist/ZEBJUS_Aerion_V18_3_68_Android.apk**, open Aerion Flight → Connect drone → Connect kit Wi-Fi. Select the unique `ZEBJUS-FC-...` SSID for this Device ID. Password: **12345678**.

**AP is API only.** The controller no longer serves a browser Flight App, Wi-Fi setup or Hardware I/O page and has no captive redirect. `192.168.4.1` is the local API address. Open the APK or local/cached WebApp. Joining Wi-Fi alone does not launch desktop software or a closed phone app.

Top AP/STA changes the disarmed kit's persistent mode. Settings select saved Wi-Fi or save a new network. For STA, phone/laptop and kit must use the same router Wi-Fi; internet is not needed for local control. Android can show its Wi-Fi permission/approval dialog, and the laptop selects Wi-Fi through its OS.

## Ownership and transmitter display

An opened, connected APK reserves a MOBILE session without RC/ARM. Laptop becomes view-only, displays TRANSMITTER ON and mirrors received sticks. Fresh physical PPM does the same for the display. External display ON does not start laptop RC transmission.

WebApp top **Take Control ON/OFF** acquires/releases ownership; local transmitter ON and ARM remain separate actions. APK **Take control/STOP** enables/stops flight transmission. Refresh, app resume and intentional network-mode changes require manual control again. Python never restarts automatically.

Android publishes latest stick input at **50 Hz over native UDP**, independently of HTTP telemetry/settings. Brief missing ACKs retry while retaining throttle/ARM. Firmware centres roll/pitch/yaw after 300 ms without RC and expires Web RC at 1 second; the 250 Hz PID task remains separate. Native input older than 300 ms is fenced, and genuine ACKs must remain within the negotiated deadline (900 ms maximum). Legacy firmware keeps its shorter deadline/HTTP fallback.

After hard loss, an explicitly enabled foreground APK/standalone Flight App can restore controls on the same verified kit with a fresh session, **throttle 0 and DISARMED**. ARM stays manual. STOP, background, reload and pairing/network-mode changes cancel recovery. Controller disarm clears unsafe values while retaining connected sticks. Telemetry errors do not stop healthy RC; settings-only release preserves PPM. Shared sticks now have brighter bases, white knobs and clear cyan movement highlights.

## Install and use the update

**Install the new APK and flash matching V18.3.68 firmware.** Updating GitHub files alone does not update a phone or running kit. A1 is bridge-only. A2/Aerion F1 supports MPU6050 Rate/Angle; altitude hold/automatic landing are not implemented. Choose the matching controller profile before USB/OTA. APP and FACTORY images with stable names and verified hashes are in `FlightCore_Firmware/`.

Offline Python, OpenCV/NumPy, Matplotlib/pandas, editor and hand model/WASM remain bundled. Ordinary `while True:` and simple Drone calls work. Examples are hidden by default; settings enable them. Camera needs localhost/HTTPS and permission. Hardware I/O remains in the WebApp and Python companion.

See [offline instructions](OFFLINE_START_HERE.md), [update/tests](SUPPORT/V18_3_66_UPDATE_AND_TEST.md) and [GitHub upload](GITHUB_UPLOAD_README.md).

```sh
npm start
npm run check
npm run release:check
```

After intentional changes, regenerate shared app copies, rebuild changed firmware/APK, and run `npm run release:seal`. Upload all batches to one staging branch and merge the completed, checked release once. Keep the final-batch integrity scripts and manifest.

Builds and automated checks run in GitHub Actions and host test environments. No real phone/emulator, physical kit, USB/OTA flash or loaded 250 Hz measurement was performed.

App home Mode: choose **Real flight**, **Tripod simulator**, or **Flight Training**. Simulation requires propeller removal and blocks real motor outputs. The selected web simulator follows app ARM and joysticks in view-only mode. Switching destination resets throttle and requires manual ARM; both simulators never receive app flight input together. See the update/test guide for matching APK and firmware installation.
