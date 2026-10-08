# ZEBJUS Aerion Controller 18.4.0

A small local controller with three pages: Controls, Setup and Firmware. Web and Android use the same generated UI. The assembly/wiring/Python labs, simulator, flight-training destinations, camera/gesture controls and their runtime assets have been removed. The complete 18.3.66 release remains on `backup/main-18.3.66-before-simple-20261008`.

Join the controller AP Wi-Fi (password `12345678`) or its saved router Wi-Fi. Enter the local controller IP and Connect. Take control enables the sticks; ARM is always manual at minimum throttle. A connected kit with an IMU problem stays visibly connected; ARM remains disabled until the flight controller is ready. A1/C3 remains a sensor/communication bridge. A2/C6 flight uses the existing MPU6050 control path.

Android binds HTTP and its 50 Hz UDP RC stream to the selected Wi-Fi network. Telemetry and settings use separate native worker queues. Device identity, single-controller ownership, controller ACK/input deadlines, output watchdogs and disarmed configuration guards remain. Link loss clears ARM/throttle; reconnect never silently arms.

USB port selection is independent of firmware downloads. Open the Firmware page directly, select USB, then load/choose a matching image and flash. Browser API/permission failures, port cancellation and bootloader failures have separate messages. Downloads have bounded timeouts. USB recovery defaults to 115200 baud. APP images flash at `0x10000`; FACTORY images at `0x0`; erase is available only with a full FACTORY image. Wi-Fi OTA accepts APP images only, verifies the selected controller/board and requires disarm. Android now allows `.bin` selection and sends the binary through its guarded native upload API.

`release-status.json` records whether the matching signed APK is available. GitHub Actions builds both firmware profiles and the Android source, exercises the actual UI/USB chooser with simulated transports, and publishes only generated packages for an unchanged source commit. Configure the existing development certificate password as repository Actions secret `AERION_DEVELOPMENT_STORE_PASSWORD` to sign the APK. Without it, Android compilation and the unsigned review build complete, but the installable APK is not published. The certificate is preserved; no replacement signing key is generated.

Run `npm run release:seal`, `npm run check`, `npm run test:control`, `npm run test:browser`, `npm run test:flight-math`, `npm run test:rc-link`, `npm run test:fc-setup`. Browser tests need Playwright Chromium. `python3 android-app/tools/build_apk.py --unsigned-only` compiles using SDK Platform 36/Build Tools 36.0.0. Set the signing environment variable to produce the installable APK with the existing certificate.

Automated tests simulate network/USB devices. A phone, USB controller and physical drone must still be verified on the bench.
