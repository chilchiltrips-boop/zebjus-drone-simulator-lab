# Aerion 18.3.81 update

This release uses the complete 18.3.80 lab as its base. Install the matching web files, Android APK and firmware together.

## Install

1. Update the complete WebApp folder; restart the local server and reload the page to refresh cached assets.
2. Install `android-app/dist/ZEBJUS_Aerion_V18_3_81_Android.apk`. It uses the previous development signing certificate and retains paired kits and saved settings.
3. Select the correct controller: A1 = ESP32-C3 bridge, A2 = ESP32-C6 Aerion F1. Use the matching APP image for an existing secure 18.3.80 kit. For older firmware or USB recovery, use the matching FACTORY image at address 0x0. Do not interchange board images.
4. Keep the kit disarmed with propellers removed during updating and setup.

## Save router Wi-Fi

Connect to the kit AP named after its Kit Name, password `12345678`. Open `http://192.168.4.1/setup` or Wi-Fi settings in the app/web console. Enter the router SSID and password, then choose **Save Wi-Fi & reconnect**.

The kit saves and reads back its NVS profile before returning `profileSaved: true`. It then restarts after 2.5 seconds to join the router. The save acknowledgement confirms persistence; it does not claim the router connection has already succeeded. Join that router on the phone and computer and reconnect to the Kit Name/router IP. If the router is unavailable, reconnect to the kit AP. A failed save retains the password and does not schedule the restart.

Existing custom Kit Names remain. Old MAC-suffixed generated names migrate to `zebjus_drone_1`, with numbered conflict resolution on the router. IDs remain internal to pairing and command isolation; the connection UI asks for Kit Name and address.

## Android joystick and WebApp simulator

1. Put kit, phone and computer on the same router. In Android select **Router Wi-Fi · STA**, enter the Kit Name/router IP and connect. Leave the app in the foreground. A connected MOBILE reservation does not arm or publish physical RC.
2. Connect the WebApp to the same kit. Pair it as owner or with a valid app invitation.
3. Open Tripod and press **Start simulator**, or open Flight Training and press **Start**. The WebApp requests the selected simulator; Android accepts that authenticated kit request automatically. No simulator buttons or browser ID entry are needed in Android.
4. Wait for the acknowledged simulator link, then manually ARM in Android. Joystick channels appear in the web input display and drive the selected simulator. Real kit outputs remain blocked.
5. Web STOP ends the run and resets throttle/ARM. A new run requires another manual ARM. Background, expired ownership and stale input keep the existing safety guards. Only the browser that requested the session can consume its live simulator input or stop it.

## Verification boundary

Both board firmware builds and the signed APK are produced from this release. Firmware host tests exercise actual Wi-Fi persistence and training ownership code. Java tests exercise native grant/watchdog handling. Browser tests exercise the bundled Android interface and real WebApp against a simulated kit, including Tripod movement, Flight Training take-off, stale input, manual re-arm and web STOP.

No physical phone, router, drone or USB/OTA flash was exercised in this environment. After installation, verify saved Wi-Fi survives reboot and simulator output inhibition with propellers removed before any real flight.
