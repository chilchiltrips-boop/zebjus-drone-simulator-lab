# ZEBJUS Aerion V18.3.61 — update and hardware acceptance

This package contains complete WebApp source and offline runtimes, the Android APK/source, and compiled A1/A2 APP + FACTORY firmware. Software/build tests use simulated kit transport. **No real phone, drone, USB/OTA flash, battery monitor or loaded 250 Hz measurement has been performed for this release.**

## Install matching firmware and APK

1. Back up PID/calibration before updating. Remove propellers for firmware, motor and transition checks.
2. Select the controller profile shown by the kit. **Aerion F1 = ZFC-A2**, the Rate/Angle flight controller. A1 is a sensor bridge; its build cannot gain flight capability from detecting an IMU.
3. USB factory install: matching `ZEBJUS_FLIGHTCORE_A2_FACTORY.bin` at **0x0**. Existing matching layout APP-only USB update: `ZEBJUS_FLIGHTCORE_A2_APP.bin` at **0x10000**. OTA accepts the matching **APP** file. Never OTA the FACTORY file or cross-flash A1/A2.
4. Read status after reboot: firmware **18.3.61**, Device ID, boardId **ZFC-A2**, `flightReady`, settings schema **1**, saved PID/calibration and motor map. Compare compiled build ID/hash with the catalog. Runtime version alone does not verify the installed image hash.
5. Install `android-app/dist/ZEBJUS_Aerion_V18_3_61_Android.apk`. It uses the same included development certificate as the previous development APK. It is not a production/Play Store release.
6. AP password **12345678**; each kit has a unique SSID and permanent Device ID. Pair the exact ID. In-app Connect kit Wi-Fi uses Android's Wi-Fi approval dialog. System Wi-Fi settings cannot reliably auto-launch an app; the AP landing offers a user-tapped app link.

## Mobile controls and laptop observation

App opening/reload/resume only verifies the saved Device ID. Explicit **Check connection / Connect kit Wi-Fi** reserves a mobile session without starting RC or ARM. **Take control** enables sticks. **ARM** is a separate deliberate action at low throttle. If an unrelated Web session is already armed, the phone cannot steal it.

While this mobile session owns the kit, a laptop on the same AP reads telemetry and mirrors actual received stick channels in WebApp Joystick and Tripod. It cannot acquire control, transmit, ARM or change kit configuration. Close/background the phone or press STOP to release its session. Refresh and Wi-Fi/kit restarts never automatically reacquire control, restart Python, or ARM.

Ownership is an application protocol lease, not proof of an authenticated person's identity. The shared AP password and client role are not a security boundary against a custom hostile client. Do not describe MOBILE role as cryptographic app authentication.

Left: throttle/yaw; right: roll/pitch. Floating centers and sensitivity/deadband/expo are shared across WebApp joysticks. Throttle ramps at a configurable speed and holds on release. Directional axes spring to center. The APK shows actual firmware mode, ARM, Device ID, connection and ownership.

## Settings, diagnostics and exports

APK: top **AP/STA** opens Wi-Fi; gear opens Controls/PID/Calibration/Diagnostics. Full WebApp: **Settings → Aerion settings & live diagnostics**.

- Read/choose saved STA Wi-Fi, scan nearby networks, save/test a new router, or activate AP. Network changes need ownership and disarmed motors. Rejoin the resulting network and explicitly reconnect the same kit.
- Max tilt, Rate speed, filters, IMU mounting, idle/max motor pulse widths, PID, level calibration and six-face accelerometer calibration persist in NVS. Firmware and UI block configuration while armed or bench motors operate. Opening settings while armed remains observation only.
- Capture six **sensor** axes before mounting rotation: X+, X−, Y+, Y−, Z+, Z−. Hold still for each. Place the frame level/top-up before saving. Gyro zero is measured again on startup; backup does not replay an old gyro bias across mounting changes.
- Calibration tab exports PID, offsets/scales and controller settings. Restore requires the same Device ID, profile and schema; incomplete/invalid values are rejected before mutation. Keep your backup before replacing any hardware.
- Diagnostics graphs show requested/measured angle and rate plus four motor pulse outputs. They use received HTTP telemetry samples, **not** a lossless 250 Hz onboard recorder. Log holds up to 3,000 samples per current kit in memory; refresh clears it. Export CSV before refreshing. Native JSON/CSV exports use Android's file picker; opening it pauses/releases flight control.
- Diagnostics includes measured loop Hz/period/max gap/overruns, Web/PPM input Hz, RC age, request round-trip delay and last disarm/event. Sensor status distinguishes fresh/calibrated/used-in-flight. A barometer address response does not enable altitude control. Altitude/position/navigation remain unavailable.

## Mode changes and handover

Rate ↔ Angle can change while armed when enabled and roll/pitch are within 45°. PID state resets and motor outputs blend for 500 ms; rejection retains the previous actual mode. Validate behavior on a secured test rig before free flight.

Controls → **RC control source** selects AUTO, WEB or PPM. A live handover needs handover enabled, a fresh incoming source, its CH5 high, throttle within **100 µs**, roll/pitch/yaw within **150 µs**, and attitude within 45°. An explicit rejected request leaves the current source unchanged. The flight task rechecks conditions at the actual transition. An unmatched unexpected source loss still disarms.

For WEB → PPM, reserve the phone session, enable sticks, and match the physical receiver before selecting PPM. The phone can keep its lease and stage Web frames while PPM is active. For PPM → WEB, the APK's explicit WEB handover seeds the current received physical channels before switching. This continues an already armed flight; it never automatically arms a disarmed controller. Refresh/resume do not re-enable this flow. Closing the mobile session while PPM is active leaves a fresh physical receiver in charge. STOP explicitly requests disarm regardless of the current source.

## Battery hardware

The firmware now reads **INA219 or INA226 I²C bus voltage** at a chosen address (default 0x40). The default is **Not installed**; voltage is not fabricated from throttle or a timer. Existing controller hardware needs an appropriate voltage monitor and wiring to measure the pack.

Use 3.3 V compatible SDA/SCL and common ground on the existing I²C bus. Follow the monitor/module manufacturer's bus-sense wiring and voltage ratings. Do not connect LiPo voltage directly to a controller GPIO/ADC. Do not pass the drone's motor current through a small monitor module for this voltage-only feature. Confirm the board's regulator, ESC ratings and battery cell count separately.

Configure monitor kind/address/cells; compare against a multimeter at two pack voltages. Set calibration multiplier = trusted voltage ÷ displayed voltage, then recheck. INA219 driver uses bus-register scaling 4 mV; INA226 uses 1.25 mV. Current/consumed capacity are not implemented. Fresh measured voltage appears in the APK and diagnostics, with LOW/CRITICAL visual alerts. Stale/missing configured voltage or critical voltage blocks a **new** ARM. In flight, low/critical voltage alerts the pilot; it does not claim automatic landing or cut airborne motors solely because of a voltage threshold.

## Required physical acceptance — record actual results

| Check | Procedure | Required result |
|---|---|---|
| USB and OTA | Install correct images; power cycle | Matching ID/profile/version, saved settings verified |
| Timing under load | Run telemetry, scans/HTTP load and view graphs for 10 minutes | Measure real 250 Hz loop; record max gap/overruns and watchdog response |
| Mount/calibration | Verify all mounting axes; six stable faces; level capture | Correct gravity/gyro signs, top-up low-throttle ARM guard |
| Motor mapping | Test one motor at a time, then idle/max units | Correct CC3D X order and pulse widths; no props |
| Mode changes | Exercise both directions at several matched setpoints | No disarm or output spike on valid changes; rejected tilt retains mode |
| Handover | Matched and deliberately mismatched Web↔PPM | Valid transitions blend; rejected explicit transfer retains source |
| RC/IMU/stall failsafe | Remove RC, interrupt IMU, inject loop stall on rig | Disarm latch/reason visible; no spontaneous rearm |
| Battery | Meter comparison; low/critical; sensor disconnect | Calibrated fresh voltage and correct alerts/ARM blocking |
| Phone interruption | Lock screen, incoming call, switch apps, radio loss | Web control stops/releases; existing PPM handover behaves as documented |
| Resume/reconnect | Unlock, return, refresh, AP↔STA and kit restart | Same ID recovered; no RC/ARM/Python auto restart |
| Multi-client | Phone + laptop + second phone on kit AP | One mobile owner; laptop live mirror only; second owner rejected |
| Android files | Export/restore with actual system picker | Files saved/read, control remains stopped after resume |

Do not mark these physical rows passed using browser simulation. Rate/Angle and the new transitions need real-kit acceptance before flight.
