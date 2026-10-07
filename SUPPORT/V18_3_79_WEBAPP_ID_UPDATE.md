# V18.3.79 — WebApp ID and PPM priority

Install **18.3.79-android.1 / 1837901** and matching A1/A2 firmware together. The existing development signing certificate is retained. The hosted WebApp is updated separately; updating the website does not update a phone or running kit.

## Connect a phone to one WebApp

1. Put the kit, phone and computer on the same router Wi-Fi. Open the hosted WebApp, connect the exact kit Device ID, and pair using the kit's owner code or the app's single-use laptop invitation.
2. Read **WEBAPP ID** at the top of that WebApp. Registration activates it on this kit. Each page instance has a separate authenticated identity. The kit resolves six-digit collisions; different kits have separate registries, so the full Device ID remains mandatory.
3. Connect the Android app to the same STA kit. Enter that WebApp ID in **Training WebApp ID**, then **Save / change WebApp ID**. The app remembers it separately for each kit. You can replace it later.
4. Select **Tripod** or **Flight Training** in the app. The kit binds this run to that authenticated WebApp session. Only it receives the app's training RC stream or may run the virtual FC PID sensor bridge. The phone owns the joystick and manual virtual ARM. Other WebApps cannot take the mobile lease or inject training sensors.
5. Keep the selected WebApp open in the foreground. To use a different page, end training, connect/pair that page, then save its displayed ID in the app. Refreshing a page creates a new authenticated instance; check its displayed ID again.

IDs select a local WebApp; they are **not pairing passwords**. Owner pairing and encryption remain required. There is no cloud command relay, global login routing, or remote flight over the internet. The website may load over the internet, but its kit communication stays on the same LAN. The browser must permit local-network access; the router must allow devices to communicate (guest/client isolation prevents this).

## Real flight and PPM

For the requested real-flight workflow, join the kit AP and use the Android native UDP joystick and STOP. AP does not run simulator/PID/firmware-update sessions. Disarmed Wi-Fi maintenance remains available to configure STA. A fresh, valid, complete PPM frame takes priority over phone/network physical RC, including when Web input preference was selected. PPM-only preference never falls back to network input. Simulator input stays explicitly APP or PPM while physical motor outputs are blocked.

Source changes keep the existing disarm/manual-ARM rules and optional explicitly configured matched handover. Network ownership never overrides live PPM selection. STOP still fences the phone publisher and forces safe output. Verify receiver mapping, throttle, ARM polarity and source changes with propellers removed before physical flight.

## Traffic and recovery

Native RC remains 50 Hz. The selected browser observer is bounded at 10 Hz. Active MOBILE control suspends background app/web HTTP polling. Browser reconnection uses 1/2/4/8-second backoff. A denied unmatched observer stops automatic reconnects; explicitly connect again after ending training. Advanced FC PID mode retains its purposeful, bounded virtual-sensor exchange.

Brief app ACK gaps neutralize simulation input while preserving the run and mobile lease within the existing 8-second app / 10-second kit windows. Recovery requires safe sticks and manual virtual ARM. A selected observer missing for 10 seconds, authentication loss, explicit STOP, kit change, or ID replacement ends or safely expires training. It cannot become a physical-flight ARM command.

The previous pairing problem is also fixed: an Android saved code rejected after `PAIR RESET` prompts once for the new code. The code is saved only after successful authenticated pairing. SRP hello/proof can wait 15 seconds without extending RC or other HTTP timeouts.

## Installation and verification

Use matching A2 files for the user's Aerion F1 / ESP32-C6 (chip 13), A1 files for ESP32-C3. An already migrated dual-slot secure kit can use encrypted APP OTA on STA while disarmed and owned. A legacy partition layout requires the USB FACTORY migration described in [the secure kit installation guide](V18_3_78_SECURE_KIT_UPDATE.md); back up reviewed non-secret settings first. Do not reset existing pairing merely to install this update.

Automated checks execute the production registration/binding/training policy, collision handling, two browsers/two phones, wrong-ID rejection, AP denial, observer expiry, wraparound, gap retention, neutral ID changes and PPM arbitration. Browser/native/firmware build checks are reported with the release. A physical Android phone, RF-stall scenario, flashing and drone flight have not been tested in this workspace.
