# ZEBJUS Aerion V18.3.68

- Setup PID tuning follows the supplied stabilization-page layout: Basic/Advanced/Expert tabs, three browser parameter banks, linked Roll/Pitch, Rate inner and Attitude outer loops, defaults, live Tripod response and explicit controller save/readback. Current/default PID permits Next; drafts survive Back/Next.
- Wizard PID loads and edits preview in Tripod. Tripod PID and RC edits stay virtual; they never forward to physical hardware. Only explicit Save to controller writes PID.
- Setup configuration heartbeats continue when another browser tab is open. Motor/ESC output stops on hiding the page; setup progress and control are retained. Real ownership, device or session loss still stops setup.
- Android 18.3.68-android.1 and matching A1/A2 firmware negotiate ZRC2 simulator UDP at 50 Hz, independently of HTTP replies. Phone roll/pitch/yaw/throttle update Tripod and Flight Training in real time. Simulator grants use distinct packet versions and fresh tokens; expired or changed simulator packets cannot control real outputs.
- Genuine input/ACK loss still pauses/disarms virtual flight and requires neutral, minimum throttle and manual DISARM/ARM. Simulation keeps physical motors disarmed and blocked. Older browser/app clients retain acknowledged HTTP simulation compatibility.

Install APK 18.3.68-android.1 and matching 18.3.68 firmware. Web, native loopback and compiled firmware checks are automated; physical phone/radio/motor testing remains outstanding. See SUPPORT/V18_3_68_UPDATE_AND_TEST.md.

## Previous V18.3.67


- Setup startup waits for its verified begin grant, preventing the false “session expired or changed” race. Polls renew the existing five-second lease. Completed checks and values retain Next when navigating Back.
- ESC calibration uses the three pre-Start checks, HIGH → Stop/LOW and pilot-confirmed tones. After success the battery may stay connected; **Calibrate ESC again** resets the next attempt's battery check. Physical motor tests use real PWM with bounded two-second Start/Stop.
- Pending checks can use **Skip / Next** and remain red in Telemetry alongside errors and missing calibration. App/Web receiver needs no RX calibration. PPM uses a live transmitter guide with modes 1–4, default mode 2, automatic throttle/roll/pitch/yaw detection, optional channels up to eight roles, centre capture and measured travel. Four stick axes are mandatory. Ordinary setup retains current/default PID; tuning is a separate tool.
- Python servo/GPS examples expose pin variables. LED matrix supports fixed-bus HT16K33 or MAX7219 on three selected free A2 pins, with conflicts rejected.
- Android 18.3.67-android.2 keeps one-tap Tripod, Flight Training and Real Joystick buttons and permits slower HTTP ACKs only in controller-verified output-blocked simulator sessions. Physical control ACK and native input timeouts retain their limits. Simulator selection does not ask for propeller removal; physical motor/ESC setup retains its safety checks.
- Simulator control works on both ESP32-C3 A1 and XIAO ESP32-C6 A2 without requiring a flight-ready IMU. A1 telemetry now returns the selected APP/PPM channels. Simulation always inhibits physical outputs and reports physical ARM separately from virtual ARM.
- Simulator grants explicitly negotiate acknowledged HTTP RC. The real-flight native 50 Hz UDP transport remains available on its supported profile. Accepted simulator RC renews the output-block lease without redundant HTTP pings, and old-run frames cannot cross into another simulator or real flight.
- Foreground link/ACK recovery restores the selected simulator at minimum throttle and DISARM, with fresh manual ARM. Late status replies cannot cancel recovery. STOP and app background cancel recovery.
- Both web simulators follow app ARM and sticks automatically, including a page opened after ARM at neutral throttle. Stale input pauses/disarms the virtual aircraft; Flight Training retains mission progress until the session changes.

Install the new APK and flash the matching 18.3.67 APP.bin for your board. See SUPPORT/V18_3_67_UPDATE_AND_TEST.md. Phone/radio/physical-drone testing remains outstanding.

## Previous V18.3.66


Web r2 / Android r2: selecting an app simulator enables its transmitter at safe values; ARM remains manual. Flight Training joins from verified telemetry without a separate browser enable or status poll. A late-opened page can join an already armed app at neutral, minimum-throttle input. Stale RC pauses and disarms the virtual model without discarding progress; neutral DISARM then ARM in the app resumes the same lesson. Changing destinations, leaving the page, or loss of the app lease still stops the simulation.

The Android home now chooses one destination: Real flight (simulation OFF), Tripod simulator, or Flight Training. The app holds the simulator output-block lease; a connected web lab observes app ARM and joysticks without acquiring configuration ownership. Switching modes drains RC, resets throttle and refreshes the native grant. Lease/ownership/lifecycle loss stops simulation and requires fresh selection and manual ARM. An expired training STOP nonce cannot interrupt a later Real flight grant. Install APK 18.3.66-android.2 (1836602) and matching A2 firmware.

Setup adds an ESC safety checklist with bounded HIGH → Stop/LOW calibration and per-motor output sliders, CW/CCW diagrams, bounded Start/Stop and observed-start recording. Flight Training includes sixteen missions, ring direction/distance/height guidance, HOME/FINISH markers, physical ring contact alerts, blocking and recovery, photos, beacon placement and multi-pad landings. Keyboard throttle and flight/camera animations are smoothed.

## Previous V18.3.65 changes

## Web update 4 — Flight Training

- Corrected aircraft-relative forward/backward and lateral motion at all headings, nose/roll animation and grounded movement. Fixed-step 120 Hz simulation is independent of the 30/60 FPS graphics setting.
- Added smooth keyboard, slider and circular dual-touch controls. Throttle changes gradually and holds on release; touching a joystick centre does not jump to 50%. Movement axes ease back to neutral.
- Replaced the basic grid/cross model with a detailed carbon-frame quadcopter, battery, camera, motors, landing skids, curved propellers and throttle-driven rotor blur. Ground shadow, altitude projection and flight-phase cues clarify take-off, hover, descent and touchdown.
- Added textured grassland, rolling hills, daylight sky/clouds, trees, rocks, access road, cars, hangar, wind turbines, racing arch, landing mats, route markings and lesson objects. Company advertisements use ZEBJUS branding on 3D objects and ground pads. Shared/instanced geometry and resource cleanup keep the scene compact and reusable offline.
- Chase, FPV, Orbit and Overview views plus Find drone, heading and a north-up course map show where the aircraft is. Both transparent joystick controls remain usable in 320px/390px Wix views; drag the arena to orbit.
- Added browser coverage for actual keyboard/touch movement, take-off/hover/soft landing, all camera modes, course geometry, repeated scene rebuilds, Wix sizes and canvas fallback. Existing guarded app/PPM input, setup recovery, Python page order and firmware behavior are preserved.

## Web update 3 — 5 October 2026 (India)

- Anonymous background and manual kit scans no longer overwrite the connected browser's verified control ownership. Client-specific status and telemetry still revoke ownership when it actually changes.
- After a stopped session, Airframe **Back** remains usable and **Restart setup** returns to Board. Each new setup requires a fresh propeller-removal confirmation and a new session nonce; outputs remain inhibited until the explicit setup gates pass.
- Setup cleanup waits for cancellation/release before restart and never acquires control just to end an expired session. Late begin replies remain scoped to their original nonce.
- Added an actual Lab/browser/controller-API regression for discovery, Airframe navigation, ownership loss and restart, alongside the full existing calibration/ESC/receiver wizard suite. Updated script URLs and offline cache for the fix. Android's separate Controls/Safety/Wi-Fi UI and firmware version remain unchanged.

## Web update 2 / Android update 2 — 4 October 2026

Python Lab is the fifth navigation page. Compact Wix embedding adapts the
header, tabs, 3D benches and Python editor to the iframe viewport. A direct
Open full lab link preserves the selected page for features restricted by
parent permissions. WIX_EMBED.html and WIX_EMBED.txt provide the HTTPS
embed code and Wix sizing/permission instructions. Active brand links use
www.zebjus.in. APK 18.3.65-android.2 uses versionCode 1836502 and the same
development certificate; controller firmware remains 18.3.65.

- Added a dedicated **Setup Wizard** after Assembly Lab and 2D Wiring: verified board selection, Quad X/H, mounting/limits, live gyro/level progress, ESC, measured motor idle, rotation, App/PPM receiver calibration, arm/failsafe and PID readback, followed by a saved completion record.
- Hardware I/O now starts with 15 tool buttons. Each opens its own controls; the former Calibration/PID pages and advanced kit settings are available here. Individual guided tools share the setup lease and STOP guards.
- Firmware & Connect combines kit discovery/connection and flashing. Upgrade supports USB or Wi-Fi OTA; Upgrade & Erase requires USB and the matching complete factory image.
- Replaced telemetry tiles with attitude, integrated-yaw, altitude and vertical-speed instruments plus live system health. Missing/stale sensor readings stay unavailable.
- Added ten lightweight 3D student flight lessons covering take-off/landing, heading, circuits, gates, obstacles, wind, LED communication, payload delivery and rescue. Simple geometry, capped 30 FPS and a software renderer support modest computers.
- App and PPM training use a separate five-second output-inhibition lease. Real motor output, bench tests and physical arming are blocked. Loss/page exit ends the session and requires neutral inputs and a fresh manual ARM before real flight.
- Simplified Android to Controls, Safety and Wi-Fi: stick feel, disarmed gyro/level calibration, failsafe information and essential pairing. Advanced setup/tuning stays in the web lab. APK version is 18.3.65-android.1 (1836501).
- Software verification includes actual RC-driven simulated take-off/hover/landing, mission/collision/gust checks, firmware output/lease guards, native RC transport and browser workflows. Physical drone, ESC/radio and Android device qualification remain unperformed.

## Previous release: V18.3.64

- Floating sticks now place their neutral centre exactly at the first touch, including blank space and edges. Pitch / roll / yaw use subsequent movement relative to that touch. Throttle holds on release. Fixed-centre mode remains available.
- Removed duplicate web crosshairs and centred the shared crosshair behind the knob. Installed / Android direction arrows and yaw marks share the stick centre and radius. Bright travel indicators remain visible.
- Added **Kit settings → FC Setup Wizard**: exact board / Device ID detection, Quad X/H, measured gyro / level sample progress, PWM ESC HIGH → LOW status, pilot-observed motor starting pulse, idle readback, selected / all motor rotation checks, Web or PPM input, six-channel mapping / min-max-centre / reverse calibration, yaw-left / yaw-right or mapped ARM switch, and receiver loss / restore observation. Advanced PID opens the existing guarded PID editor.
- The wizard requires the verified A2 Aerion F1 flight profile. A1 remains bridge-only; unsupported aircraft are disabled. X/H use the existing front-left / front-right / rear-right / rear-left mixer. Physical motor wiring / direction must be checked.
- Firmware scopes setup mutations to the current Device ID, control owner and unique setup session. Setup inhibits ARM and RC. Calibration runs outside the networking task. Motor tests stop at 800 ms in the wizard; ESC HIGH stops after at most 12 s, LOW after 3 s. A five-second setup lease, output supervisor and STOP / page / tab / ownership cleanup keep outputs at minimum after cancellation or loss.
- After setup, directional sticks and throttle must return to neutral / minimum with ARM low. The app releases configuration control and takes a fresh RC grant for a subsequent manual ARM. Receiver endpoints, input preference, airframe and yaw direction persist without changing the existing FlightSettings schema.
- Preserved V18.3.63 native 50 Hz UDP, bounded gap handling, safe foreground retry and manual re-arm behavior. No automatic re-arm follows a prolonged connection loss.
- Rebuilt development-signed Android APK (1836401), A1/A2 APP and FACTORY firmware. Tests use host clocks, Java UDP loopback and simulated controller browser APIs. No physical drone, ESC, radio or Android phone flight qualification is claimed. Motor starts and ESC tones are pilot observations; no RPM feedback is available.
