# V18.3.68 update and verification

1. Install `android-app/dist/ZEBJUS_Aerion_V18_3_68_Android.apk` over the development app. Its signing certificate is unchanged.
2. Flash matching `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin` or `ZEBJUS_FLIGHTCORE_A2_APP.bin` using the correct board profile. Factory images are for USB recovery. Check the displayed firmware version is 18.3.68.
3. Reload the web lab so the 18.3.68 cache activates. Connect the phone and computer to the same kit AP or router; verify the Device ID on both.
4. Select Tripod or Flight Training in the app, open its web page, keep throttle at minimum and ARM the virtual drone manually. Move roll/pitch/yaw and throttle; the web sticks and model should follow. Physical outputs stay blocked. The new APK/firmware negotiate ZRC2 at 50 Hz; old clients use HTTP.
5. For real motor tests remove all propellers and use the bounded setup output test with the motor battery connected. Observe actual rotation before confirming. Firmware output limits and arming guards remain active.
6. On PID tuning, read the kit PID, edit linked Roll/Pitch or select a parameter bank and inspect Tripod. Save to controller explicitly, then check readback. Edits made on Tripod stay virtual.
7. Open another browser tab during setup, then return. Configuration progress/control should remain; active motor/ESC output stops and ESC needs repeating. Back/Next preserves completed steps. Genuine connection/owner/session loss ends setup and shows Restart.

Automated coverage executes the actual web pages and APK UI against a simulated controller, the actual Java UDP transport over loopback, production firmware session/RC handlers on the host, and both compiled board profiles. It covers delayed HTTP with live roll/pitch and virtual motion, token/version/sequence rejection, physical-output isolation, explicit PID save, responsive PID layout, background configuration leases and hidden-output STOP. Physical phone/radio/ESC testing was not performed.
