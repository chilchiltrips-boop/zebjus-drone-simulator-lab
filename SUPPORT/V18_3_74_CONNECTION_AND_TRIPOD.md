# 18.3.74 connection and Tripod diagnosis

The supplied app and web diagnostic files were compared with the 18.3.73 source. Duplicate uploads contained the same data. Personal Wi-Fi details, identifiers and raw recordings are excluded from the release.

## Findings from the recordings

Native simulator RC reported 29,466 accepted frames and 29,466 controller ACKs, with zero rejected ACKs in the recorded counters. ACKs remained fresh during some web simulator stale-input pauses. The web observer recorded roughly 1.0–1.15 second delivery gaps, four reconnects and zero invalid frames. This supports investigating observer scheduling and browser workload; it does not prove a particular physical radio fault.

The controller reported a maximum measured loop gap of 4,003,139 microseconds and two watchdog trips. This cumulative maximum does not establish when each gap occurred. The previous loop clock included deliberate bench/configuration inactivity, which could inflate the measurement. Genuine active armed stalls still trip the original watchdog and retain the latch.

The live controller reported firmware 18.3.73. A persisted Setup Wizard record showing 18.3.70 was an older setup record, not the active controller version.

## Defects fixed

| Defect | Effect | Fix |
| --- | --- | --- |
| Training freshness stayed at destination-selection time | The first failed ping after a long active session could immediately stop a paused reservation | Refresh from a confirmed controller RC ACK, accounting for ACK age |
| Paused heartbeat replies were not fenced against resumed transmission | A late HTTP timeout could stop a restarted healthy native stream | Check mode identity and transmission epoch on success and failure |
| STOP waited for outstanding replies | Native RC continued until the input watchdog stopped it | Pause native publication immediately, then finish neutral/release cleanup |
| Late native callback after intentional STOP | Misleading reconnect state/recovery | Ignore callbacks for inactive or different sessions; retain genuine stop handling |
| Full app DOM paint ran on tick and ACK | About 50 full status updates per second increased main-thread work | Cap ordinary paints at 10 Hz; safety resets paint immediately |
| Web channel grid was recreated for each packet | Excess allocation/layout and discarded nodes | Construct ten rows once and update changed values |
| Buffered stick snapshots were all rendered | Observer/UI backlog grew during delayed delivery | Apply newest ordinary sticks while retaining ARM, run, target, active, role and RC-source edges |
| Idle speculative socket held the single-client HTTP server for 5 seconds | Ready API requests queued behind an unused connection | Expire a socket with no first bytes after 250 ms; preserve ready requests |
| Deliberate bench/configuration inactivity counted as flight-loop time | Inflated stall diagnostics on resumption | Refresh the timestamp during deliberate inactive intervals |
| Telemetry failures were swallowed by the app | Exports omitted failed HTTP observer requests | Record bounded telemetry-error events with native RC state |
| Tripod roll used the opposite sign for the model axes | Right input visually tilted left | Positive roll lowers the right side, with nose +Z and up +Y |

Receiver channels and physical motor mixing are unchanged. RC freshness, physical ARM checks, motor inhibition, negotiated ACK deadlines, watchdog limits, safe throttle after hard recovery and manual re-ARM remain in force.

## Install and check

1. Install `android-app/dist/ZEBJUS_Aerion_V18_3_74_Android.apk`: **18.3.74-android.1**, code **1837401**, package `in.zebjus.aerion`. The existing development certificate permits updating the previous development app.
2. Flash matching **18.3.74** firmware for the actual controller: **A1 = ESP32-C3**, **A2 / Aerion F1 = ESP32-C6**. APP is for OTA or compatible USB update at `0x10000`. FACTORY writes a full installation at `0x0` and replaces stored settings; use it for a blank/incompatible installation.
3. After boot, verify firmware 18.3.74 and the expected Device ID. Download/extract the current repository ZIP, run the offline launcher and open `http://localhost:8787/`, or refresh the deployed web lab. Old extracted folders do not update themselves.
4. AP: phone and laptop join the same kit SSID, password `12345678`. `http://192.168.4.1/` or `/setup` provides Wi-Fi recovery. STA: both devices join the kit's router. The previous [USB/AP/STA guide](V18_3_73_UPDATE_AND_TEST.md) still applies.
5. Select Tripod in the app and open Tripod on the laptop. ARM the virtual drone at neutral input. Move roll right/left: the corresponding body side should lower. Forward pitch and yaw should retain their directions. Confirm physical outputs are blocked.
6. Run Tripod and Flight Training for at least ten minutes each in AP, then STA. Open settings while paused, wait and resume. A single temporary heartbeat failure should allow retry; genuine lease expiry still stops. STOP during a delayed request must stop native streaming immediately and clear throttle/ARM. A late reply must not restart it.
7. After an actual loss, reconnect must start at safe throttle with manual ARM. If a pause recurs, immediately export **both app and web diagnostic JSON**. Compare telemetry-error events, native ACK age/errors, monitor reconnects and controller loop/boot counters to separate observer loss, RC loss and reset/stall.

## Verification boundary

Production tests execute confirmed ACK freshness, paused/resumed heartbeat fencing, real expiry, immediate native STOP, late callback isolation, bounded paints, retained channel nodes, buffered NDJSON safety edges and actual Three.js roll/pitch geometry. Firmware host tests execute the HTTP wrapper and loop guard, including an armed stall that must still trip. Native Java tests cover UDP publication/ACK scope/watchdogs and router selection. Actual installed app/web browser tests cover AP/STA, Android lifecycle, delayed HTTP, Flight/Tripod/Real switching and safe stale-input recovery.

A1/A2 builds use Arduino-ESP32 3.3.12. Build checks verify profile chip ID, embedded release, dual 1,310,720-byte OTA slot fit, factory/APP equality and monitor stack budget. The SDK 36 APK verification checks DEX, manifest, existing certificate, alignment and exact bundled UI/transport bytes. Release and offline manifests check all packaged hashes.

The bundled app UI was restored byte-for-byte from the verified signed APK after a temporary workspace reset. Other source changes were reapplied and production regressions rerun. GitHub release workflow builds complete packages before validating the generated branch, and verifies the signed APK against rebuilt source.

No physical kit, phone/emulator, router association, USB flash or motor/flight test is claimed. These changes fix reproducible software faults. Remaining RF, power or hardware scheduling issues need fresh field recordings.
