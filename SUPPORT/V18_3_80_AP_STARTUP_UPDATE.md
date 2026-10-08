# V18.3.80 — AP connection and Aerion identity

Install matching **18.3.80-android.2 / 1838002** and controller firmware **18.3.80**. The previous signing certificate is retained: install over the existing app; do not uninstall or Clear data.

For the user’s kit, the generated name becomes **FlightCore A2-41FEFF63B0E4**. AP SSID remains **ZEBJUS-FC-41FEFF63B0E4**, Device ID remains **ZFC-41FEFF63B0E4**, and AP password becomes **12345678** after the firmware update. Old automatic zebjus_drone names migrate; custom names stay intact. Update any saved name in another browser if it still searches for the old name, retaining the exact Device ID.

**Real flight:** Connect drone → Real flight · Kit AP. Android selects the kit AP using 12345678 and its OS Wi-Fi approval. Firmware 18.3.80 uses automatic, encrypted AP authentication; no extra Pairing code dialog. Take control and ARM remain explicit. AP web sessions are maintenance/observers; Android native UDP publishes real RC. Fresh valid PPM retains first priority. Anyone who knows this shared AP password can connect to the kit’s nearby AP; it is the AP access credential you requested.

**Training:** Kit, phone and computer share the same router. Connect drone → Training · Router Wi-Fi, enter the kit router IP, and pair with the owner code or laptop invitation as before. Save the WebApp’s six-digit ID on app home, then select Tripod or Flight Training. There is no cloud relay. AP Wi-Fi credentials cannot authenticate or control on STA.

The new Aerion Drone Lab logo retains the company geometric Z and adds four cyan rotor rings. The launcher and five-second startup show it with a reveal, hover, rotor pulse, scan and title sequence. Reduced-motion users see a static five-second intro. Ordinary background/resume and network changes do not restart the intro. Startup never initiates RC or ARM.

Firmware 18.3.79 can still use its existing owner pairing with the new app, but its old AP password/code prompt will remain until firmware 18.3.80 is installed. Update an already migrated dual-slot kit using disarmed, owned STA APP OTA. Legacy partitions require the matching USB FACTORY migration; see V18_3_78_SECURE_KIT_UPDATE.md. An APK update alone cannot change the kit’s Wi-Fi password or firmware authentication.

Build/browser/crypto checks use simulated peers and actual production code. A physical phone, USB flash, radio link and drone flight have not been tested here.
