## V18.3.78 web.2 / android.2 — exclusive mobile session

- Native RC remains 50 Hz; the laptop observer is limited to 10 Hz.
- Active native control suspends app HTTP telemetry/status and web background polling, health, discovery and lease pings. Stream retry uses 1/2/4/8-second backoff.
- Verified simulation ACK gaps neutralize virtual input and retain the same run/grant for up to 8 seconds. Fresh ACKs alone cannot restore ARM; STOP/background and hard expiry still fence.
- Web takeover is blocked while mobile training/native transmission is active.
- Secure observer packets maintain paired-kit freshness and output-inhibition state. Advanced virtual sensors are bounded to 10 Hz; brief link gaps retain the chosen FC engine.
- Dual OTA slots provide 1,966,080 bytes each. First migration requires the matching USB FACTORY image.
- Automated verification does not replace physical phone/kit/router/USB/flight acceptance.

# ZEBJUS Aerion V18.3.78 — secure paired-kit stages 2–4

Ship matching app, web and firmware together. Per-kit SRP-6a pairing binds full
Device ID, name and permissions; HTTP, native RC/ACK and monitor telemetry use
separate AES-256-GCM keys/counters with replay rejection. Android stores owner
codes with Keystore encryption. Single-use app invitations grant laptop training
and PID permission while the app retains joystick ownership; companions cannot
ARM, take control, run bench outputs or flash. Revoke permissions in app Settings.

The first upgrade requires USB FACTORY migration to two 1,966,080-byte slots.
AP passwords are random per kit. AP provides owner joystick/STOP and explicit
disarmed Wi-Fi maintenance. STA on a shared router provides training/PID/admin;
no public WAN physical RC relay is added.

Tripod/Flight Training require a live paired kit and active inhibited run. PID
save uses revision checks, a staged FC apply and complete-record persistence with
confirmed readback. A2 advanced training runs actual FC PID against laptop virtual
sensors and returns virtual motor commands while every physical output is blocked.
Native input reaches the UDP publisher independently of HTTP callbacks; validated
ACKs prevent false stale stops. Frozen virtual outputs still expire.

Install **18.3.78-android.2 / 1837802** and matching A1/A2 firmware. The development
signing certificate is unchanged. Older clients cannot control secure firmware.
See [installation, pairing and verification](SUPPORT/V18_3_78_SECURE_KIT_UPDATE.md).
Automated checks and both board builds are required; physical phone/FC/flash/flight
verification remains a field-test boundary.

# V18.3.74 connection stability and Tripod roll

Tripod renders positive roll by lowering the model's right side; channel values and physical flight mixing are unchanged. App ACKs now renew paused-training freshness, and late paused-heartbeat errors are ignored after transmission resumes. STOP immediately pauses the native publisher; late callbacks after an intentional STOP cannot start recovery.

Ordinary app status paints are capped at 10 Hz, with immediate safety updates. Web channel rows retain their DOM nodes, and buffered monitor stick frames are coalesced while ARM/destination/ownership edges are preserved. The firmware releases unused HTTP preconnect sockets after 250 ms instead of waiting 5 seconds. Deliberate bench/configuration pauses reset the flight-loop measurement clock without clearing a genuine watchdog trip. App diagnostic exports now record failed telemetry requests.

Install APK **18.3.74-android.1** (1837401) with matching A1/A2 firmware and reload the web lab. Signing certificate and OTA partition layout are unchanged. See [diagnosis, verification and field checks](SUPPORT/V18_3_74_CONNECTION_AND_TRIPOD.md). Real kit testing is still required to assess any remaining radio, power or scheduling loss.

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
