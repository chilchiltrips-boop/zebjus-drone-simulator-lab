# 18.3.73 connection recovery

The supplied ZIP matched GitHub main at 36ae9fee. This release fixes reproducible software causes behind the reported USB/AP/STA failures.

| Symptom | Defect | Fix |
| --- | --- | --- |
| C6 flash-ID probe fails | C6 used the C3 SPI register base 0x60002000 | Use C6 SPI1 at 0x60003000 in the vendor target and runtime patch, including cached bundles |
| AP connected but laptop cannot discover kit | Empty firmware kit name was rejected by browser discovery | Stable ID-based temporary name and compatible Device ID validation without a name requirement |
| Wi-Fi saved but STA switch never completes | wifiTestRestartAt was assigned but never consumed by loop | Schedule restartAt, which the loop processes after 7.5 seconds |
| Save reports success after failed NVS writes | Credential/preferred-network writes were unchecked | Read back SSID/password/preferred profile before success |
| Valid router credentials rejected by mDNS | Naming failure was treated as password/association failure | Save verified credentials, fall back to an ID-based name and return STA IP |
| AP root opens a blank page | Root returned 204; setup route absent | Small Wi-Fi form at / and /setup in AP mode |
| Mobile cannot retry a bad password | Password cleared before final test result | Retain password and AP connection on failure; clear after confirmed success |
| Android router handover fails | Selected the departing AP and announced router ready prematurely | Exclude old AP/cellular, react to Wi-Fi capability changes and wait for a eligible router, then reconnect with SSID/IP/name hints |

Default-profile migration now handles the old empty seed marker without replacing saved profiles or undoing explicit Forget Wi-Fi. Public firmware includes no personal router credentials. Set Wi-Fi through the AP page/app; optional local builds may define ZEBJUS_DEFAULT_WIFI_SSID and ZEBJUS_DEFAULT_WIFI_PASS.

## Update and field check

1. Download the current repository ZIP, extract it and run the offline launcher. Open http://localhost:8787/ in Chrome or Edge and refresh to load 18.3.73 assets.
2. Install android-app/dist/ZEBJUS_Aerion_V18_3_73_Android.apk over the previous app. Version 18.3.73-android.1, code 1837301; package and signing certificate are unchanged.
3. Flash the matching A1 (ESP32-C3) or A2 (Aerion F1 / ESP32-C6) firmware. USB APP writes at 0x10000 and retains settings/layout. FACTORY writes the full 4 MB at 0x0 for a blank/incompatible installation and replaces stored settings. OTA uses APP only.
4. For USB recovery, close Arduino/other serial users. Use USB power with external wiring disconnected. Hold BOOT, tap RESET, release BOOT, select Already in BOOT mode and retry USB Connect. Invalid flash IDs still block erase/write; do not force through a continuing probe failure.
5. Confirm firmware 18.3.73 and the same Device ID after boot. A completed write alone is not boot confirmation.
6. Hold BOOT for 5 seconds and release to select AP. Join ZEBJUS-FC-<kit suffix>, password 12345678, and stay connected despite no-Internet warnings. Manually open http://192.168.4.1/; captive probes retain 204 and do not automatically launch the app.
7. Enter the exact 2.4 GHz router SSID/password in the AP form or app. Bad credentials should fail while retaining password/AP. Correct credentials should report success/name/STA IP, then reboot after about 7.5 seconds.
8. Join that router on phone/laptop. If Android needs manual selection, use Phone Wi-Fi settings and return. Reconnect to the same Device ID; use the reported IP if .local/mDNS is unavailable. DHCP may change the IP on a later reboot.
9. Read saved profiles, power-cycle to check persistence, and test AP to saved STA and STA to AP while disarmed. Network changes do not start RC transmission or ARM the motors.

## Verification

Both boards compile with Arduino-ESP32 3.3.12 and the original dual 1,310,720-byte OTA slots. Build checks validate chip IDs, embedded version, APP size, FACTORY/APP equality and monitor stack budget. APK SDK 36 build verifies DEX, manifest, v2/v3 signatures, alignment and exact source assets with the existing certificate.

Tests execute production C6 SPI transactions, Wi-Fi storage/test/main loop with NVS/radio doubles, actual app/WebApp browser AP/STA and password flows with simulated controller/native-network APIs, and Java control/UDP loopback. Existing setup/output inhibition, manual ARM/watchdogs, simulator HTTP/UDP, read-only monitor and upload guards pass. The recovered product sources match the previously tested files byte-for-byte.

No physical USB flashing, phone/emulator Wi-Fi callback sequence, router association, ESC/motor or flight test was performed. Follow the field checks above on the actual kit.
