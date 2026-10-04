# ZEBJUS Aerion V18.3.65

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
