# V18.3.8 TX10 / Kit Connect / Cache Update

- Added transmitter ON/OFF with safe channel reset.
- Added keyboard joystick control: arrows, W/S, A/D, T, M and X.
- Added visual LED status indicators; CH8 beeper control removed from the Joystick Lab and held at safe value.
- Added flight-mode selection with Angle, Rate and Altitude.
- Arm interlock: Angle/Rate require throttle <=1050; Altitude requires throttle centered near 1500.
- Altitude mode centers throttle and returns it to center after momentary keyboard/pointer input.
- Refined Kit Connection page for clearer same-Wi-Fi discovery, connection order and status.
- Service worker now uses network-first for HTML/JS/CSS/manifest and a new cache namespace.
- Server sends no-store for service-worker.js and revalidation headers for app code to prevent normal refresh from reverting to an older build.
