# ZEBJUS Aerion V18.3.71

Field reports showed 49 Hz real input but only 1 Hz simulator HTTP input. Tripod stopped and Flight Training paused while Wi-Fi stayed connected. This release gives Android simulator input a scoped native ZRC2 50 Hz publisher and the web a separate read-only 25 Hz NDJSON1 observer on port 4211. HTTP replies no longer pace simulation sticks.

- Exact Device ID, blocked physical outputs and simulator run are verified before publication. Input from an old destination is rejected; virtual ARM and physical ARM remain separate.
- The observer task uses bounded requests/packets, three subscribers, nonblocking writes and slow-client expiry. Slow HTTP snapshots preserve newer RC/ARM/destination. Polling remains available when a monitor cannot connect.
- App JSON captures offered and ACK-accepted channels independently of telemetry. Web JSON adds monitor health, controller uptime/frame count and simulator position/pause state.
- Real-flight watchdogs, stale-input/manual re-arm gates, PPM setup and editable firmware PID remain. Tripod PID edits stay virtual; explicit Save writes the controller.

Install the matching APK and A1/A2 firmware together. Tests execute production Java/firmware handlers and bundled app/web UI with mocked controller/radio; no physical phone, ESC, motor or flight test is implied.
