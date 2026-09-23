# ZEBJUS F450 Drone Lab V18.3.26

Corrective release for browser startup and ESP32-C3 firmware CI.

- Fixed `app.js` ES-module parse failure in the Python bridge object (missing closing brace).
- Added independent `school-lab.js` parsed/ready diagnostics.
- Improved startup error text so app-module and school-lab failures are distinguished.
- Moved `ImuSample` into `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h` so Arduino auto-generated prototypes compile correctly.
- Firmware builder now copies companion `.h/.hpp/.c/.cpp` files into the temporary Arduino sketch.
- Validator now parses ES-module files in true module mode, preventing the V18.3.25 syntax regression from passing validation again.
- Stable firmware filenames remain unchanged: `ZEBJUS_FLIGHTCORE.ino` and `ZEBJUS_FLIGHTCORE_A1_APP.bin`.
