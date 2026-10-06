# V18.3.70 install, reproduce and export

1. Install android-app/dist/ZEBJUS_Aerion_V18_3_70_Android.apk, flash matching A1/A2 firmware for your board, and reload web. Confirm 18.3.70 and identical Device ID on app/web.
2. Select Tripod or Flight Training in the app. Wait for confirmed simulation, ARM at neutral/low throttle, then move throttle/roll/pitch/yaw. Web mirror and selected simulator should respond. Physical outputs remain inhibited. Real Joystick uses the existing native ZRC1 transport.
3. In web Telemetry, Flight recorder starts on received samples. Mark issue now after the failure; Export for ChatGPT JSON. Flight CSV exports numerical samples for plots.
4. App Kit settings also includes Flight recorder. Opening settings centres/disarms inputs; the earlier session and marked failures remain recorded. Export its JSON too. The native Android document picker pauses control, so inspect/export after the test.
5. Attach BOTH JSON files to ChatGPT. Explain the action that triggered the fault and its approximate time. Reports contain UTC timestamps, Device ID, app/web states, control ownership, fresh RC ages, simulator target/run, FC loop/output state, configuration, native stop reason and transport counters. Raw latest data is included once, not repeatedly printed on the screen.
6. A web report alone cannot establish phone-side causes. A reserved MOBILE owner with RC NONE / zero frames means no fresh RC reached the FC; Wi-Fi reachability and RC are different observations. Recorder findings are evidence checks, not guaranteed root-cause diagnoses.

Recording retains 900 samples and 240 events per kit. JSON exports are trimmed to fit native export limits. Secrets such as passwords, control/session tokens and client IDs are excluded. Browser errors are retained separately. A changed Device ID starts a new capture.
