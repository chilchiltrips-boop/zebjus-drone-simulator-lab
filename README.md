> **Current release: 18.3.82, based on 18.3.80.** Install the matching [Android APK](android-app/dist/ZEBJUS_Aerion_V18_3_82_Android.apk) and A1/A2 firmware. Wi-Fi saves are acknowledged before the kit restarts. Connect by Kit Name; start Tripod or Flight Training in the WebApp and the connected Android joystick follows automatically. [Setup and update instructions](SUPPORT/V18_3_82_UPDATE.md).

> **Retained release fixes:** Take Control/ownership ordering, stale handling, flash probe diagnostics and Tripod direction fixes. App and web verify Kit Name and the paired kit identity internally. Fresh valid PPM retains first priority for real outputs. [Remaining stages and migration requirements](SUPPORT/STAGED_KIT_RELEASES.md).

# ZEBJUS Aerion V18.3.82

This release keeps **Python Lab fifth**: Assembly → Wiring → Setup Wizard →
Hardware I/O → Python Lab. Embed the lab in Wix using `?embed=wix`; the compact
layout follows the iframe viewport and provides **Open full lab** for camera,
USB or local-kit features blocked by parent permissions. See [Wix setup and
permissions](WIX_EMBED.txt) and the ready-to-paste [HTML embed](WIX_EMBED.html).
A five-second company-Z/quad-rotor startup and new Aerion launcher mark are included. APK **18.3.82-android.1** is rebuilt with the same development certificate.
Tripod and Flight Training use native ZRC2 input at 50 Hz and a dedicated NDJSON1 web monitor at 10 Hz on port 4211; real flight retains native ZRC1 UDP. Telemetry and app Kit settings include a live Flight recorder with marked events and ChatGPT JSON / numerical CSV export. PID Basic/Advanced/Expert and parameter banks have been removed. PID tuning previews in Tripod; Tripod edits stay virtual. Setup configuration continues when another browser tab is open; hiding a running motor/ESC test stops its output.

Kit discovery preserves the connected browser's verified control ownership.
If setup stops, **Back** still reaches Board and **Restart setup** opens a fresh
setup with a new propeller-removal confirmation. Genuine ownership, connection
or page loss still ends the setup and blocks further output commands.

Aerion combines drone assembly, Python Lab, simulation and local-kit control. The Android Flight App is a separate flight interface with floating sticks and no Python editor.

## Guided FC configuration

Open the web lab's **Setup Wizard** page after Assembly Lab and 2D Wiring. Hardware I/O provides individual calibration, PID and connector tools. Firmware & Connect combines kit discovery and Upgrade / Upgrade & Erase. The Telemetry cockpit shows live instruments and leaves unsupported sensor readings unavailable. The compact APK gear contains Controls, Safety and Wi-Fi; full FC setup lives in the web lab.

**Flight Training** has sixteen progressively unlocked missions in a grass airfield with a detailed quadcopter, rolling terrain, racing arches, route markers, wind turbines, buildings and ZEBJUS advertisements. Smoothed keyboard/rate joystick throttle holds on release. Forward/backward and lateral movement follow the aircraft’s heading; its tilt and rotors match the flight. Chase, FPV, Orbit and Overview views, **Find drone**, a north-up course map and a ground projection keep position clear. Ring guidance shows distance, height, entry direction and movement relative to the drone nose; HOME always marks the take-off point, with a separate FINISH pad when needed. Physical ring contact blocks the virtual drone and alerts the pilot to back off or recover without skipping a gate. New missions add height-changing rings, slalom, survey photos, rescue beacons, a three-pad landing tour and a timed wind return. Balanced 30 FPS, High 60 FPS and a lightweight canvas fallback support compact Wix views. Local controls and app/PPM training require a live paired STA kit and a matching output-inhibited run. Training inhibits real motor outputs and lease loss requires neutral sticks and manual re-arm. Read the [update and test steps](SUPPORT/V18_3_66_UPDATE_AND_TEST.md). ESC setup now includes the pilot-confirmed battery/props checklist, HIGH → Stop/LOW sequence and timeout recovery. Output calibration highlights each motor with rotation direction, a µs slider, bounded 2 s Start/Stop tests and observed-start recording for all four motors. A1 remains bridge-only; physical motor response and flight still require hardware verification.

## Start and connect

Laptop: extract the complete project and open `Start_Offline.bat` (Windows), `Start_Offline.command` (Mac), or run `python3 start_offline.py`. Open **http://localhost:8787/**. Python 3 or Node.js must already be installed to launch the local server. Join the kit Wi-Fi; the open WebApp automatically discovers the AP API for observation.

Android: install **android-app/dist/ZEBJUS_Aerion_V18_3_82_Android.apk**, open Aerion Flight → Connect drone → **Real flight · Kit AP** for real flight. Select the AP matching the Kit Name; the password is 12345678 and AP pairing is automatic. For web simulation choose **Router Wi-Fi · STA**, enter the Kit Name and router IP, then pair. Connect the WebApp to the same kit and press **Start simulator** on Tripod or **Start** in Flight Training. The Android app automatically supplies joystick input; manually ARM the virtual drone in the app. Kit, phone and computer must share the same router. Router mode keeps per-kit owner-code pairing.

**AP Wi-Fi setup:** open `http://192.168.4.1/` or `/setup` while joined to the kit AP. Flight controls and Hardware I/O use the APK or local/cached WebApp. Captive probes still return 204, so open the address manually; joining Wi-Fi does not launch a closed app.

Top AP/STA changes the disarmed kit's persistent mode. Settings select saved Wi-Fi or save a new network. For STA, phone/laptop and kit must use the same router Wi-Fi; internet is not needed for local control. Android can show its Wi-Fi permission/approval dialog, and the laptop selects Wi-Fi through its OS.

## Ownership and transmitter display

An opened, connected APK reserves a MOBILE session without RC/ARM. Laptop becomes view-only, displays TRANSMITTER ON and mirrors received sticks. Fresh physical PPM does the same for the display. External display ON does not start laptop RC transmission.

WebApp top **Take Control ON/OFF** acquires/releases ownership; local transmitter ON and ARM remain separate actions. APK **Take control/STOP** enables/stops flight transmission. Refresh, app resume and intentional network-mode changes require manual control again. Python never restarts automatically.

Android publishes latest stick input at **50 Hz over native UDP**, independently of HTTP telemetry/settings. Real-flight ACK retry remains bounded at 900 ms. In inhibited simulation, a gap neutralises RC after 300 ms and retains the same lease/run up to 8 seconds, with manual ARM after recovery. Firmware centres roll/pitch/yaw after 300 ms without RC and expires Web RC at 1 second; the 250 Hz PID task remains separate. Native input uses the existing 300 ms soft-stale and 900 ms hard deadline (simulation also neutralizes throttle/ARM), and genuine ACKs must remain within the negotiated deadline (900 ms maximum). Matching secure firmware is required for control; older firmware can only be discovered for USB migration.

After hard loss, an explicitly enabled foreground APK/standalone Flight App can restore controls on the same verified kit with a fresh session, **throttle 0 and DISARMED**. ARM stays manual. STOP, background, reload and pairing/network-mode changes cancel recovery. Controller disarm clears unsafe values while retaining connected sticks. Telemetry errors do not stop healthy RC; settings-only release preserves PPM. Shared sticks now have brighter bases, white knobs and clear cyan movement highlights.

## Install and use the update

Read the [18.3.82 installation and test guide](SUPPORT/V18_3_82_UPDATE.md). When migrating from firmware before the secure dual-slot layout, use USB FACTORY and restore reviewed settings while disarmed. Existing 18.3.80 kits can use the matching APP image through the updater. App, web and firmware use authenticated ZFC3 encryption. AP is joystick-only with separate Wi-Fi maintenance; training/PID use STA.

**Install the new APK and flash matching V18.3.82 firmware.** Updating GitHub files alone does not update a phone or running kit. A1 is bridge-only. A2/Aerion F1 supports MPU6050 Rate/Angle; altitude hold/automatic landing are not implemented. Choose the matching controller profile before USB/OTA. APP and FACTORY images with stable names and verified hashes are in `FlightCore_Firmware/`.

Offline Python, OpenCV/NumPy, Matplotlib/pandas, editor and hand model/WASM remain bundled. Ordinary `while True:` and simple Drone calls work. Examples are hidden by default; settings enable them. Camera needs localhost/HTTPS and permission. Hardware I/O remains in the WebApp and Python companion.

See [offline instructions](OFFLINE_START_HERE.md), [update/tests](SUPPORT/V18_3_66_UPDATE_AND_TEST.md) and [GitHub upload](GITHUB_UPLOAD_README.md).

```sh
npm start
npm run check
npm run release:check
```

After intentional changes, regenerate shared app copies, rebuild changed firmware/APK, and run `npm run release:seal`. Upload all batches to one staging branch and merge the completed, checked release once. Keep the final-batch integrity scripts and manifest.

Builds and automated checks run in GitHub Actions and host test environments. No real phone/emulator, physical kit, USB/OTA flash or loaded 250 Hz measurement was performed.

Android home contains joystick controls. The WebApp selects and starts the simulator. A confirmed simulation blocks real motor outputs and binds input to that browser. Web STOP ends the run, resets throttle and disarms; a new run needs manual ARM.
