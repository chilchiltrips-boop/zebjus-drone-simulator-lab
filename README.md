# ZEBJUS F450 Drone Engineering Lab V18.3.61

## Aerion Flight App

Android APK/source: **`android-app/`**. AP password is **12345678**; older saved passwords migrate after this firmware update. Android 10+ can connect kit Wi-Fi inside the installed app. On a manually joined Android AP, the landing page offers **Open Aerion Flight app**. See [V18.3.61 setup](SUPPORT/V18_3_61_UPDATE_AND_TEST.md).

Open **Start_Flight_App.bat** (Windows), **Start_Flight_App.command** (Mac), or `python3 start_offline.py --flight`; the flight-only browser page is **http://localhost:8787/flight/**. After installing the matching firmware, joining the kit AP and opening **http://192.168.4.1/** gives the same self-contained screen without a laptop server.

This dark, full-screen app has no Python interface/runtime: left floating stick = throttle/yaw, right = pitch/roll, fixed sides, top connection status and ANGLE/RATE mode. A disconnected kit shows Connect instructions. ARM/DISARM is manual; STOP releases control. Refresh and reconnection never automatically resume output. Explicit mobile connection reserves ownership; a connected laptop becomes view-only and mirrors received sticks. Settings include AP/STA, PID/calibration, flight limits and diagnostics. See the [V18.3.61 guide](SUPPORT/V18_3_61_UPDATE_AND_TEST.md).

## Compiled firmware, reconnect and hand control

V18.3.61 includes both controller profiles, strict saved Device ID recovery and real-target camera/hand RC. Hardware tests remain pending; browser/transport checks are recorded in [the update guide](SUPPORT/V18_3_61_UPDATE_AND_TEST.md).

## Full offline Python and hand tracking

Extract the whole ZIP and open **Start_Offline.bat** (Windows) or **Start_Offline.command** (Mac), or run `python3 start_offline.py`. Open **http://localhost:8787/** and connect the laptop to the kit AP. Python, OpenCV/NumPy, Matplotlib/pandas, the smart editor and cvzone hand tracking use bundled local files, including on the first run with internet unavailable. Installed Python 3 or Node.js is needed to launch the local server; browser packages require no pip install. Settings → **Save for offline use** can also retain a complete verified browser copy. See [OFFLINE_START_HERE.md](OFFLINE_START_HERE.md) for phone/camera constraints, package scope and verification.

## Top bar Wi-Fi switch

Use the STA/AP toggle at the top of every page. The selected kit must be connected and disarmed. Switching to AP shows its SSID/password; switching back uses the saved preferred/current Wi-Fi profile. Join that network on the computer after the kit restarts.

## V18.3.55 joystick fix

Joystick now keeps both targets available. Select **REAL KIT + TRIPOD MIRROR**, use **Connect selected kit / Take Control**, then turn the transmitter ON and ARM at low throttle. The ARM popup is removed. Inline status explains any actual firmware, IMU, connection or lock block. RC-enabled A2 FlightCore firmware and a ready MPU6050 are required for real flight output.

Tripod, Joystick and Python own their simulator input while active, so kit telemetry cannot repeatedly stop or overwrite local controls. Simulator restart clears old PID state, physics uses fixed 4 ms steps, sound resumes after unmuting, and changing status text cannot move the gimbals. Existing firmware that already reports Web RC enabled does not need reflashing solely for these WebApp fixes; replace the WebApp files and reload.


## Direct AP Flight App and offline PyCharm

Connect a phone or laptop to this controller's labeled `ZEBJUS-FC-...` AP. Its captive network check serves the **Aerion Flight App**: touch joysticks, intentional ARM/DISARM, ANGLE/RATE choice, keyboard control, live status and links to Hardware I/O/Wi-Fi settings. The separate Python companion is described below; the flight screen contains no Python editor or guide. The reliable manual address is `http://192.168.4.1/` in a normal browser. Some operating systems show a captive Wi-Fi window after joining; they do not guarantee opening a full browser or keeping that small window active. AP settings and saved Wi-Fi are at `http://192.168.4.1/setup`; `/fly` remains an alias for the Flight App. No internet or cloud service is required for these locally served pages.

On a laptop connected to the same AP, copy `python_companion`, run `pair_ap.py` to confirm the complete Device ID, then open `main_ap.py` in PyCharm. `from zebjus_simple import Drone`, `drone = Drone()` and ordinary `while True:` run locally and send commands to `192.168.4.1`. Basic LED, sensor and RC APIs use only the Python standard library; camera/OpenCV packages must be installed ahead of an offline session. Source is not uploaded or executed on the flight controller. Details: `SUPPORT/AP_APP_V18_3_54.md`.

## AP / STA with an enclosed FlightCore

Flash this firmware before closing the case. Every controller uses a unique `ZEBJUS-FC-<12-hex Device ID suffix>` SSID and AP password **`12345678`**. V18.3.61 replaces older saved random AP passwords on the first reboot after firmware update. On first AP startup, copy both from USB Serial at 115200 onto the correct case. If the kit is already on school Wi-Fi, connect its verified Device ID in Drone Lab, take control and use **Settings → Show this kit's AP details**. Record the details before selecting **Switch selected kit to AP**. Disarm and stop bench outputs first.

AP stays active through power cycles. If saved Wi-Fi cannot be reached at startup or drops while disarmed, the kit also enters persistent AP. Join its specific SSID with password `12345678`, then open `http://192.168.4.1/` for the Flight App. In **Settings** (`/setup`), **Activate saved Wi-Fi mode** tries saved profiles, or **Save & test Wi-Fi** verifies a new one. If that network is unavailable, the kit returns to AP and stays there. No physical BOOT access is required. AP password remains `12345678` after a web factory reset or full erase/reflash of this firmware.

`192.168.4.1` is the private address within whichever kit AP your phone/laptop joins, so several nearby kits can use it independently. The browser checks Device ID when connecting and includes it with commands. The shared LAN control lock is not user authentication, and this release has no per-user secure pairing. See `SUPPORT/AP_MODE_V18_3_53.md` for setup, mode rules and limits.

## V18.3.48 receiver, camera and calibration changes

- PPM accepts complete CH1–CH6 frames on selectable A2 D6/GPIO16 or D10/GPIO18. D10 is reserved from servo/GPS/GPIO while used by PPM. Use Hardware I/O or the AP `/io` page to verify the actual wiring and frame Hz.
- A separate FreeRTOS output supervisor attempts minimum ESC PWM if the armed/bench main loop stalls more than 30 ms. Status reports trips. This has not been verified on flight hardware and is not a substitute for an independent ESC/receiver failsafe.
- GPS 10 Hz shows measured complete epochs rather than a configuration claim; verify on the real receiver. Battery reading is `null` until a physical power sensor and failsafe are implemented.
- Python camera and hand processing follow Run/Stop/finish. The included browser `cvzone.HandTrackingModule.HandDetector` subset draws on camera and OpenCV frames; native cvzone and MediaPipe run in `python_companion` after installing `requirements-vision.txt`. Browser camera access needs HTTPS/localhost and permission, so direct AP HTTP cannot run camera projects.
- Calibration has a guarded six-face MPU6050 diagnostic and explicit offset save. Follow [the hardware checklist](SUPPORT/FLIGHT_VALIDATION_V18_3_48.md) before any propeller installation or flight.


Browser-based F450 assembly, 2D wiring, Python learning, simulator, local-kit control and firmware update environment for ZEBJUS FlightCore.

V18.3.48 builds on the Python Flight Lab, multi-kit Device ID and Tripod real-kit mirror. It includes the full assets in one GitHub-ready directory, a page-wise responsive AP interface, STA and flight-mode controls in Settings, safety fixes, browser plots/vision and a native laptop Python companion. See `RELEASE_NOTES.md`.

For a new kit, join its labeled AP and use `http://192.168.4.1/` for direct control; `/setup` hosts Wi-Fi setup and status. On a hosted secure Drone Lab page, students can use the browser Python editor, camera, MediaPipe hand landmarks, OpenCV and Matplotlib. `python_companion/` installs native MediaPipe/cvzone/OpenCV on the laptop for camera projects. The ESP32 does not install Python packages.

## Hardware I/O quick start

1. Flash a board-matched A2 firmware build and connect the exact permanent Device ID in **Kit Connect**. CC3D X layout is M1 front left, M2 front right, M3 rear right and M4 rear left. Defaults are D1/D2/D3/D0, respectively; save a different permutation only while disarmed. Verify each physical motor with all propellers removed.
2. Read PPM channels and measured input Hz; adjust edge and CH1–CH4 reversal only after checking the physical receiver. Physical PPM defaults to yaw right/left held one second for arm/disarm at minimum throttle and centered roll/pitch; CH5 switch mode is optional. Low-throttle stick inactivity disarms after 15 seconds. CH6 low selects cascaded Angle → Rate PID; high selects direct Rate PID.
3. Scan I²C, use a sensor's own register datasheet for generic read/write, then configure free A2 D7–D10 pins for 50 Hz servo, 3.3 V GPIO or GPS. Generic NMEA 9600 needs GPS TX→FC RX; bundled DroneGPS UBX 10 Hz mode additionally needs FC TX→GPS RX. The 2D reference automatically chooses free signal pins for selected accessories and can apply supported assignments. The matrix editor supports HT16K33 at 0x70–0x77. Never power a servo/load from a signal GPIO.
4. The same controls are hosted at **`http://192.168.4.1/io`** in setup AP, or `http://<kit-address>/io` in STA. The FC's `/fly` page supplies direct sticks and keyboard control. Browser Python examples include the pin map, PPM, multi-I²C, servo, GPS, matrix and GPIO; `python_companion/expansion_demo.py` is a read-only desktop/PyCharm starter.

This ZIP includes verified A1/A2 APP and FACTORY `.bin` builds. See [V18.3.61 update and test guide](SUPPORT/V18_3_61_UPDATE_AND_TEST.md) for image selection and physical checks. A2 stabilized flight currently requires MPU6050; A1 remains bridge-only. Review the real-hardware sequence in `SUPPORT/FLIGHT_VALIDATION_V18_3_47.md` before using motors. The GPS 10 Hz request is implemented but only `gps_read.measuredHz` on a connected kit can verify the actual rate.

## Unified control mirror

WebApp Joystick, Tripod sticks, AP direct RC and Python `drone.rc()` can operate the A2 FlightCore without a PPM receiver. Fresh Web/AP/Python frames own the active RC source; PPM is fallback. Tripod REAL KIT MIRROR sends the same sticks/mode/arm frame to Simulator and the selected controlled kit, and PID Apply can synchronize the real FC for bench/tether tuning.

## Python Flight Lab + Rate/Angle FlightCore

ZFC-A2 / XIAO ESP32-C6 now contains the supplied MPU6050 Rate-mode and Angle-mode control loops instead of acting only as a Wi-Fi/sensor bridge. The A2 profile uses D1/D2/D3/D0 for M1/M2/M3/M4 ESC PWM, a 250 Hz control loop, boot gyro calibration, accelerometer roll/pitch, 1D Kalman fusion, the supplied PID/mixer signs, PPM yaw arm/disarm by default, and CH6 Angle/Rate selection. Web/AP/Python frames still use CH5 for explicit arming. See `SUPPORT/FLIGHTCORE_STAGE_GUIDE_V18_3_48.md` for each stage.

Control-source order is: fresh verified WebApp/AP/Python RC first, then physical PPM as automatic fallback. This lets browser, Tripod mirror, AP direct control and Python work even with no receiver attached. Any source change while armed, RC timeout, IMU read failure, mode change while armed, or the active source's disarm command forces motor-safe output. The firmware does **not** auto-run ESC calibration at boot.

A1 / ESP32-C3 intentionally remains bridge-only until its real motor-output pin map is confirmed. BMP388 can coexist on I²C and is discoverable, but altitude hold is not part of this release. A2 now supports guarded persistent PID read/write: changes are blocked while armed, range-checked and saved in NVS.

## Stable firmware filenames

These names should stay unchanged in future releases:

- Source: `FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`
- A1 application binary: `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin`
- A2 application binary: `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A2_APP.bin`
- A1 factory image (when available): `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_FACTORY.bin`
- A2 factory image (when available): `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A2_FACTORY.bin`

The release number belongs in `VERSION.txt`, firmware `FW_VERSION`, catalog metadata and UI metadata — **not in the mutable firmware filename**. Replacing a future `ZEBJUS_FLIGHTCORE.ino` therefore replaces the old source instead of creating another version-named source file.

## Automatic board-aware firmware build

`.github/workflows/build-flightcore-a1.yml` keeps its stable filename for replacement compatibility, but now builds **all supported board profiles**:

1. ZFC-A1 / ESP32-C3,
2. ZFC-A2 / XIAO ESP32-C6,
3. application images for both boards,
4. merged/factory images when the Arduino build actually produces them,
5. SHA-256, byte size, UTC build time and Build ID metadata,
6. full project validation before publishing, and
7. stable binary/catalog files committed back to the repository.

The web updater verifies ESP image structure and board chip ID before an imported `.bin` is accepted.

## Connection / Python / sensor reliability

- Device identity uses the complete 48-bit MAC, with migration matching for older six-hex IDs.
- A discovered kit is shown as **FOUND**, not Connected, until the browser client has verified that exact Device ID.
- Changing kit clears stale client identity so an old kit cannot silently reconnect as the new selection.
- A2 telemetry reports live Rate/Angle flight state, active RC source, channels and motor outputs; A1 continues as receiver + raw-IMU bridge telemetry.
- Python runs in a fresh Web Worker on every Run/Rerun. Stop terminates the Worker, so even a non-cooperative infinite loop can be stopped.
- Python Flight Lab includes 30 editable sensor, receiver, PID, calibration, keyboard/RC, motor/ESC bench, diagnostics and combined custom examples.
- Python PID variables can mirror directly into the Tripod Simulator; Python RC frames update the simulator sticks, mode, throttle and motor behavior.
- Student Python Files is horizontal and the editor/tools plus IMU/terminal splitters are draggable. Terminal output is bounded/copyable and errors are red.
- LSM6DS3 and MPU6050 are auto-detected; Python Lab includes live charts, sample rate/age, CSV recording and browser-side teaching calibration.

## Local development

```bash
npm start
```

Open the local URL printed by `server.js`. Do not rely on double-clicking `index.html`; ES modules, service workers and firmware APIs are designed to run from HTTP/HTTPS.

Run the integrity check before publishing:

```bash
npm run check
```

## Firmware Center behavior

If `catalog.json` says an application image is unavailable, Firmware Center will not pretend an old binary is current. After GitHub Actions builds the new stable binary, the catalog becomes available with its SHA-256 and the updater can auto-load it. Browser-imported `.bin` files remain supported.

V18.3.48 contains a real Rate/Angle flight loop, persistent guarded PID tuning and persistent level accelerometer calibration on the A2/XIAO ESP32-C6 profile. Acc X/Y/Z offsets and Roll/Pitch trim are stored in NVS; Capture Level calculates X=0 g, Y=0 g, Z=+1 g offsets and refreshes gyro bias only when still and near level. A1 remains bridge-only. A2 flight needs MPU6050 even if LSM6DS3 is detected for student projects. Altitude hold and battery failsafe are pending. The firmware and airframe need the prop-off/tethered checks in `SUPPORT/FLIGHT_VALIDATION_V18_3_47.md` before free flight.

See `FILE_REPLACEMENT_POLICY.md` for future drag/drop replacement rules, `RELEASE_NOTES.md` for the replace-in-place current notes, and `RELEASE_NOTES_V18_3_27.md` for this historical release snapshot.

## GitHub web-upload cleanup
GitHub's browser uploader overwrites matching filenames but does not delete files removed from a newer release ZIP. The firmware workflow therefore runs `tools/cleanup_repo.py` after compilation. It removes known obsolete runtime/firmware leftovers, refreshes `FILE_COUNT.txt`, validates the result, and commits those deletions together with the stable firmware binary.

### V18.3.48 classroom controls

Python editor scrolling and line wrap, a 440 px default terminal, editable splitters, Monaco suggestions and traceback line markers are included. Browser Matplotlib forces Agg before pyplot; `plt.show()`/`drone.show_plot(fig)` and `cv2.imshow` display in a draggable/resizable window. Camera examples request permission automatically. Browser MediaPipe uses the Tasks Vision JavaScript model; native `mediapipe`, `cvzone` and serial code run in `python_companion` after installing its requirements on a laptop. Five original supplied scripts are preserved in `python_companion/reference_uploads`.

Python RC projects open the Joystick page and mirror acknowledged channel values. The keyboard transmitter example has editable `KEY_*` constants; Settings key mappings apply to manual Joystick and Simulator. On release, roll, pitch and yaw return to center while throttle remains. AP `/fly` has the same keyboard directions. Firmware records separate PPM input, Web/AP input and FlightCore loop rates. Actual timing and flight readiness require propeller-off hardware validation.
