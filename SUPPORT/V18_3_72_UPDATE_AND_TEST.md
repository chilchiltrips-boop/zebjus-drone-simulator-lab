# V18.3.72 boot recovery

V18.3.71 monitor direct task frame measured 6672 bytes out of an 8192-byte stack on ESP32-C6. This left limited space for ROM formatting/socket calls. V18.3.72 moves bounded buffers to static storage, formats only with an active subscriber, and requires a compiler-measured direct monitor frame <=1024 bytes for both board builds. The exact cause on the reported physical kit is still unconfirmed without its boot log.

If kit Wi-Fi is absent after USB flashing, release BOOT and press RESET once. If normal startup still fails, USB recovery must use the A2 FACTORY image at 0x0 for XIAO ESP32-C6; APP is for an existing matching OTA layout at 0x10000 or AP OTA. FACTORY rewrites the full 4 MB image including saved configuration. Do not mix A1/C3 and A2/C6 files. USB bootloader mode is entered by holding BOOT while tapping RESET, then releasing BOOT; after upload, release BOOT and tap RESET to boot the firmware.

A running firmware selects AP mode after holding BOOT for 5 seconds and releasing; a 10-second hold resets settings. Boot log at 115200 and telemetry JSON now include reset/heap/monitor stack diagnostics. USB recovery is a user action; this release has not been flashed on a physical kit in this session.

# V18.3.72 install, reproduce and export

1. Install android-app/dist/ZEBJUS_Aerion_V18_3_72_Android.apk, flash matching A1/A2 firmware for your board, and reload web. Confirm 18.3.72 and identical Device ID on app/web.
2. Select Tripod or Flight Training in the app. Wait for confirmed simulation, ARM at neutral/low throttle, then move throttle/roll/pitch/yaw. Confirm app transport ZRC2 and web monitor NDJSON1; web mirror and selected simulator should respond. Physical outputs remain inhibited. Real Joystick uses the existing native ZRC1 transport.
3. In web Telemetry, Flight recorder starts on received samples. Mark issue now after the failure; Export for ChatGPT JSON. Flight CSV exports numerical samples for plots.
4. App Kit settings also includes Flight recorder. Opening settings centres/disarms inputs; the earlier session and marked failures remain recorded. Export its JSON too. The native Android document picker pauses control, so inspect/export after the test.
5. Attach BOTH JSON files to ChatGPT. Explain the action that triggered the fault and its approximate time. Reports contain UTC timestamps, Device ID, app/web states, control ownership, fresh RC ages, simulator target/run, FC loop/output state, configuration, native stop reason, offered/accepted channels, virtual ARM, monitor ages/counters and simulator position/pause state. Raw latest data is included once, not repeatedly printed on the screen.
6. A web report alone cannot establish phone-side causes. A reserved MOBILE owner with RC NONE / zero frames means no fresh RC reached the FC; Wi-Fi reachability and RC are different observations. Recorder findings are evidence checks, not guaranteed root-cause diagnoses.

Recording retains 900 telemetry samples, 1200 app control samples and 240 events per kit. JSON exports are trimmed to fit native export limits. Secrets such as passwords, control/session tokens and client IDs are excluded. Browser errors are retained separately. A changed Device ID starts a new capture.
