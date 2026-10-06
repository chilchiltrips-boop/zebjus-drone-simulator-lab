# V18.3.73 USB and AP/STA connection recovery

Correct the bundled ESP32-C6 SPI1 flash register base to 0x60003000 and patch cached target objects before probing. Discover unnamed valid kits, use stable temporary AP names, verify Wi-Fi credential/preferred-profile storage, and schedule the restart consumed by the main loop after a successful AP test. mDNS failure no longer rejects working credentials; setup status reports STA IP and restart delay.

AP `/` and `/setup` provide a small Wi-Fi recovery form. Repair migration of optional local-build defaults while preserving saved profiles and Forget Wi-Fi. Public firmware contains no router credentials. Mobile failures retain password and AP connection; success hands over SSID/IP/name. Android waits for eligible router Wi-Fi and excludes the departing AP and cellular.

Install APK 18.3.73-android.1 (1837301) with matching A1/A2 firmware. Signing certificate and OTA layout are unchanged. See [update and field test guide](SUPPORT/V18_3_73_UPDATE_AND_TEST.md). Physical flash/phone/router/flight testing remains necessary.

# V18.3.72 monitor boot recovery

Moved the read-only monitor buffers off its task stack, avoided idle formatting, added reset/heap/stack diagnostics, and enforced the compiler stack-frame budget for both firmware profiles. Serial boot evidence from the affected kit is still needed to confirm its exact failure cause. APK protocol remains compatible with V18.3.71.

# ZEBJUS Aerion V18.3.72

Field reports showed 49 Hz real input but only 1 Hz simulator HTTP input. Tripod stopped and Flight Training paused while Wi-Fi stayed connected. This release gives Android simulator input a scoped native ZRC2 50 Hz publisher and the web a separate read-only 25 Hz NDJSON1 observer on port 4211. HTTP replies no longer pace simulation sticks.

- Exact Device ID, blocked physical outputs and simulator run are verified before publication. Input from an old destination is rejected; virtual ARM and physical ARM remain separate.
- The observer task uses bounded requests/packets, three subscribers, nonblocking writes and slow-client expiry. Slow HTTP snapshots preserve newer RC/ARM/destination. Polling remains available when a monitor cannot connect.
- App JSON captures offered and ACK-accepted channels independently of telemetry. Web JSON adds monitor health, controller uptime/frame count and simulator position/pause state.
- Real-flight watchdogs, stale-input/manual re-arm gates, PPM setup and editable firmware PID remain. Tripod PID edits stay virtual; explicit Save writes the controller.

Install the matching APK and A1/A2 firmware together. Tests execute production Java/firmware handlers and bundled app/web UI with mocked controller/radio; no physical phone, ESC, motor or flight test is implied.
