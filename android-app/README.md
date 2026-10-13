# Aerion Flight Android — 18.3.84-android.1

Router Wi-Fi and Kit AP connection choices, the STA/AP switch, and the Wi-Fi settings page are restored. Join the same network as the selected kit. AP password: 12345678. Scan networks, enter credentials and Test & Save from AP; failed tests retain the password and connection. Native encrypted joystick control, STOP, manual ARM and output-inhibited web-started training remain.

Build with SDK 36 and JDK 17 using tools/build_apk.py. The existing development signing certificate needs AERION_DEVELOPMENT_STORE_PASSWORD. Without it, Actions exports an unsigned artifact for private signing; do not install or relabel the old APK as this version. Physical phone and drone tests are outstanding.
