# Aerion Flight Android — 18.3.83-android.1

VersionCode 1838301. Connect the phone to the kit AP (SSID: Kit Name; default password `12345678`) and use the app's Controls and Safety pages. A computer running the local/cached WebApp joins the same AP for live input and Tripod/Flight Training. Router switching and Wi-Fi settings are hidden from the active app UI. Physical controls remain native, encrypted and guarded by the firmware's lease and manual ARM rules.

Build with Android SDK 36 and JDK 17 using `python3 tools/build_apk.py` from this directory. The existing development key requires `AERION_DEVELOPMENT_STORE_PASSWORD`; the matching GitHub Action uses the repository secret of that name. Do not relabel the existing V18.3.82 APK as this release. Physical Android and drone tests are outstanding.
