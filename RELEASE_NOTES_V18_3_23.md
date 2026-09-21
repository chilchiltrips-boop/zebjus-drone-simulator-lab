# V18.3.23 — I²C + Python Lab

- Added `/api/i2c/scan` to FlightCore firmware.
- Uses board-profile SDA/SCL pins and reports them in `/api/status`.
- I²C scans are blocked while ARMED.
- Added `LocalKitClient.i2cScan()` and school-lab bridge support.
- Added `from zebjus import Drone` Python API with `await drone.i2c_scan()`.
- Terminal prints I²C addresses, optional address hints, count, and scan time.
- Replaced the basic Python textarea experience with Monaco when available: syntax highlighting, line numbers, suggestions, auto-indent, auto brackets/quotes, and run shortcut.
- Removed embedded Wi-Fi credentials from the FlightCore source. Existing saved NVS Wi-Fi profiles remain usable after OTA.
- FlightCore identity now stays in `ZFC-xxxxxx` format after upgrading from bootstrap.
- GitHub Actions now compiles and commits the verified board-specific `.bin` files back into the repository automatically.
