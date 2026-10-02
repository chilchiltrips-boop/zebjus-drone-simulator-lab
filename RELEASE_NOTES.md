# ZEBJUS Aerion V18.3.62

- AP now serves the kit API only. Captive DNS, embedded browser pages and redirects are removed; OS probe endpoints receive an empty 204 response.
- Installed Android app: actual AP/STA toggle, saved/new Wi-Fi configuration and same-Device-ID reconnect on router Wi-Fi. No external kit browser page opens.
- Isolated telemetry failures no longer clear the APK identity/session while successful flight RC acknowledgements continue. RC timeout remains 300 ms.
- Configuration-only session release does not inject Web RC into a physical PPM receiver, including native pause/network cleanup.
- Mobile ownership or fresh PPM automatically turns the laptop transmitter display ON and mirrors received sticks. The laptop does not transmit RC merely because that display is ON.
- WebApp Take Control ON/OFF is at the top beside AP/STA. Automatic AP discovery connects as an observer; RC/ARM/Python never restart on reconnect.
- Precise throttle accumulation, bounded integer frames, target selection and multi-touch controls verified; top bar uses fixed responsive areas.
- CI retains release integrity checking and checks missing final-batch helpers before dependency setup. The upload group includes all helpers and its completion manifest.
- Current compiled A1/A2 APP/FACTORY binaries and a signed Android APK are included, with matching source/version/hash metadata.

See SUPPORT/V18_3_62_UPDATE_AND_TEST.md for setup and the physical test boundary.
