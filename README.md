# ZEBJUS Aerion V18.3.84 — saved router Wi-Fi with AP recovery

The kit tries saved router Wi-Fi at boot. If no profile connects, its AP is available at http://192.168.4.1 (SSID: Kit Name; password: 12345678). Join it, press Connect kit, scan nearby 2.4 GHz networks, select or type the SSID, enter the password, then Test & Save. A failed test keeps AP access and leaves saved profiles unchanged. Success confirms storage and displays the STA IP before restarting. Join the router on the phone/computer and reconnect the same Kit Name. Saved profiles can be selected or forgotten from Wi-Fi settings. Explicit AP mode stays selected until switching back to saved router Wi-Fi.

The WebApp Settings and Android Wi-Fi page expose STA/AP mode switching and network configuration. Encrypted ZFC3 control and AP/STA output-inhibited simulator training remain. The WebApp header omits Android connection information.

Use fresh matching A1/C3 or A2/C6 firmware from the build workflow. Existing compiled packages remain marked unavailable while V18.3.84 is being built. First migration from V18.3.72 needs USB FACTORY because of the larger OTA partition layout. Android signing requires the repository development-key secret; unsigned build artifacts cannot be installed as updates. Physical radio, flash and flight acceptance remain outstanding.
