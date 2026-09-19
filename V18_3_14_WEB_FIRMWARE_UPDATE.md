# V18.3.14 Web Firmware Update Center

- New FIRMWARE UPDATE tab with firmware source, target, progress monitor, log, reboot and reconnect controls.
- Import a compiled `.bin` or auto-load a bundled `ESP_Firmware/Web_Flash/latest.json` package.
- Last imported firmware is cached in IndexedDB and can auto-load on the next visit.
- Same-Wi-Fi OTA upload to `/api/firmware/update` using ESP32 `Update.h`. OTA is blocked while armed and requires the current browser control lock.
- `/api/reboot` and `/api/firmware/info` added.
- Automatic post-flash reboot and local-kit reconnect monitoring.
- USB first-flash/recovery path uses Espressif `esptool-js` through Web Serial. App images use `0x10000`; factory/merged images use `0x0`.
- Full-flash erase is blocked for application-only images.
- Current source package contains the Arduino `.ino`; the compiled `.bin` is not generated in this environment. Place a compiled app image in `ESP_Firmware/Web_Flash/` and enable it in `latest.json` for one-click bundled update.
