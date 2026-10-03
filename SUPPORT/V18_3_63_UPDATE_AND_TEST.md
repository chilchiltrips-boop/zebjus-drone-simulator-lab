# Aerion V18.3.63 — control recovery update

Install `android-app/dist/ZEBJUS_Aerion_V18_3_63_Android.apk` and flash the matching profile's V18.3.63 APP/FACTORY image. Updating GitHub alone does not install software on the phone or kit. Back up settings, verify version and permanent Device ID after restart, and use the matching catalog chip/profile. A1 is ESP32-C3 bridge only; A2/Aerion F1 is XIAO ESP32-C6 with MPU6050 Rate/Angle flight control.

The APK retains the previous development certificate with a higher version code. Launch the updated local/cached WebApp and refresh its offline copy. AP password is `12345678`; AP serves API only. APK/local Flight App provides the UI. STA requires the same router Wi-Fi on phone and kit.

## Short gaps and safe recovery

Android sends latest input at 50 Hz over UDP independently of HTTP/WebView callbacks, without queuing old stick movements. Firmware validates exact device, private 64-bit lease token, increasing sequence and channel bounds. The 250 Hz flight/PID task remains separate from networking.

| Condition | Result |
| --- | --- |
| Brief missing ACKs with fresh UI input | Retry latest input; retain throttle, ARM and ownership within negotiated deadline. |
| Controller receives no RC for 300 ms | Centre roll/pitch/yaw; retain throttle/ARM/source only within the bounded grace interval. |
| Controller receives no RC for 1 second | Web RC expires; existing source/failsafe logic applies. Unmatched/no standby disarms. No altitude hold or automatic landing is implemented. |
| Android receives no fresh input for over 300 ms | Fence session; attempt safe UDP burst and captured HTTP cleanup. |
| Android receives no genuine ACK within deadline | Fence session; maximum 900 ms. JS maximum is 850 ms. Legacy firmware remains 300 ms with HTTP fallback. |
| Hard loss while previously transmitting in foreground | Retry same verified Device ID using fresh session. Restore sticks at throttle 1000/CH5 1000; ARM manually. |
| Controller disarms | Clear throttle/ARM, retain connected sticks. Resolve disarm reason before manual ARM. |
| STOP, background/focus loss, reload, pairing or intentional network-mode change | Cancel recovery, stop/release; require manual flight control and ARM. |
| Wrong Device ID / another active owner | Block flight commands and ownership theft. |

Initial APK opening/explicit Wi-Fi join reserves MOBILE configuration ownership without RC/ARM. Laptop mirrors MOBILE/PPM in view-only mode. Pings renew configuration reservations only and cannot hide failed flight RC. Telemetry failure alone does not stop healthy RC. Resizing centres directional input without resetting throttle/ownership.

## Automated verification

A1/A2 firmware compiled with Arduino CLI 1.5.1 / Espressif core 3.3.12. Image magic, chip, version, dual OTA fit, factory/application equality and SHA-256 checked. APK compiled with JDK 17 / Android Platform and Build Tools 36; DEX, resources, manifest, alignment, v2/v3 signature and exact bundled assets checked.

Native Java tests use real loopback UDP sockets: 50 Hz publication, 160 ms input gaps, 210 ms ACK gaps, stale-input fence, wrong-token/device/replayed/unsent ACK rejection and safe stop. Browser tests execute bundled UI/bridge with simulated controller/native APIs: 440 ms loss retains throttle/ARM/session, hard loss restores fresh disarmed controls, STOP cancels retries, wrong IDs block control, and lifecycle/reload remains read-only. C++ tests cover actual 300/1000 ms boundaries, rollover and binary protocol.

Run `npm run check`, `release:check`, `test:control`, `test:setup`, `test:upload`, `test:flight-math`, `test:rc-link`. Browser suites `test:recovery`, `test:flight`, `test:ui`, `test:network`, `test:mobile-view`, `test:real-browser` and `android-app/tests/browser_transport_test.js` require Playwright/Chromium. Native tests: `android-app/README.md`.

## Physical verification pending

No phone/emulator, physical controller, USB/OTA flash or flight was tested here. First test with propellers removed: actual RC rate and loaded flight-loop timing while telemetry/settings run; short-gap throttle hold; STOP; screen lock/calls; Wi-Fi loss; safe reconnect/manual ARM; wrong-kit rejection. Verify ESC/motor order and sensor orientation before the existing tethered validation procedure. Radio loss beyond the grace interval can still disarm and cause a fall; these changes cannot guarantee against a flip/crash.
