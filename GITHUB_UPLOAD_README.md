# GitHub upload — V18.3.26

Upload the **contents** of this folder to the repository root. Keep `index.html`, `.github`, `FlightCore_Firmware`, `tools` and all web assets at their current relative paths.

The active source filename is permanently:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`

Companion compile-safe type definitions are kept at:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h`

The workflow watches both files, and the builder copies the header into the temporary Arduino sketch before compilation.

After it is added/replaced, `.github/workflows/build-flightcore-a1.yml` installs Arduino-ESP32 **3.3.12**, compiles the ESP32-C3/ZFC-A1 application and overwrites:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin`

The workflow also updates `FlightCore_Firmware/catalog.json`, `FlightCore_Firmware/latest.json`, `firmware-catalog.json` and `firmware-latest.json` and commits them with the binary.

This avoids stale `...V18_3_xx...ino/.bin` files. Version history is kept in Git commits, `VERSION.txt`, firmware metadata and release notes rather than mutable filenames.
