# ZEBJUS Aerion V18.3.63

- Android RC uses a native 50 Hz latest-input UDP publisher and a separate firmware networking task. HTTP telemetry/settings and WebView reply delivery no longer pace that stream.
- MOBILE grants supply a private per-session UDP token and negotiated deadline. Device ID, token, sequence, lease and fresh-input checks reject old/wrong-session frames and ACKs. Safe HTTP cleanup invalidates the token.
- Brief radio gaps retain throttle/ARM/source. Roll/pitch/yaw centre after 300 ms without controller RC; Web RC expires at 1 second. Android fences stale stick input after 300 ms and missing genuine ACKs after at most 900 ms. Legacy firmware retains HTTP and its 300 ms deadline.
- Foreground recovery of explicitly enabled APK/standalone flight controls uses a fresh session, minimum throttle and DISARMED. ARM is manual. STOP, background, reload, wrong kit and intentional Wi-Fi-mode changes cancel recovery. Controller disarm keeps connected sticks available at safe values.
- Mobile configuration reservations retain the negotiated deadline when Take control starts. Active RC no longer sends redundant pings; stale telemetry cannot override newer ACKs. Resizing centres directional input while retaining throttle/ownership.
- Shared WebApp/Tripod/Flight App sticks have brighter blue bases, cyan rings, white knobs and movement highlights. View-only sticks remain readable.
- Matching compiled A1/A2 APP/FACTORY binaries, signed APK, offline hashes and release metadata are included. Obsolete APKs and optional signature sidecars are removed.
- Native loopback UDP, replay/scope, cancellation, browser loss/recovery and controller gap-policy tests are included in focused checks/CI.

Install the new APK **and** matching controller firmware. AP remains API only. See [update and physical tests](SUPPORT/V18_3_63_UPDATE_AND_TEST.md). Automated/simulated tests do not establish real radio reliability or flight stability; no phone, physical kit or flight was tested here.
