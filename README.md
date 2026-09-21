# ZEBJUS F450 Drone Engineering Lab V18.3.23

## Current release

V18.3.23 adds a real FlightCore I²C scanner and a smarter Python Lab editor while keeping the existing same-Wi-Fi kit connection, simulator, firmware updater, and safety guards.

### I²C / Python Lab
- New FlightCore endpoint: `GET /api/i2c/scan`.
- Scan is blocked while the controller reports ARMED.
- The scanner uses the Arduino board profile's default `SDA` / `SCL` pins. For the current `ESP32C3 Dev Module` profile this resolves to SDA GPIO8 and SCL GPIO9.
- The I²C bus is opened only for the scan and released afterward so the BOOT/recovery input can be restored on boards where SCL shares GPIO9.
- Common addresses are shown only as hints; an address alone does not prove the exact sensor model.
- Python example:

```python
from zebjus import Drone

drone = Drone()
scan = await drone.i2c_scan()
```

The WebApp terminal prints detected addresses and the total count.

### Smart Python editor
- Monaco-based Python editor with a PyCharm-like dark coding layout.
- Python syntax colouring, line numbers, auto indentation, bracket/quote closing, and code suggestions.
- ZEBJUS completions for `Drone`, `drone.i2c_scan()`, `drone.status()`, and imports.
- `Ctrl/Command + Space` opens suggestions.
- `Ctrl/Command + Enter` runs the current Python code.
- If Monaco cannot load, the normal textarea editor remains available.

### Firmware build / WebApp Auto Load
`FlightCore_Firmware/` contains the source and firmware catalog. The included GitHub Actions workflow compiles the board-specific application binaries with Arduino-ESP32 3.3.7 and commits the generated `.bin` files and updated catalog back into the repository. This makes the files available to GitHub Pages / Firmware Center without a separate firmware server.

Expected A1 application binary:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_V18_3_23_APP.bin`

The source ZIP itself does not contain a fabricated binary. If you upload the project to GitHub, the included Actions workflow builds the real binary from the included source.

## Current controller profile
- Product: ZEBJUS FlightCore A1
- Board ID: `ZFC-A1`
- Arduino FQBN: `esp32:esp32:esp32c3`
- Arduino-ESP32 core: `3.3.7`
- Same-Wi-Fi local HTTP + mDNS connection
- OTA application update supported
- Bootstrap / saved Wi-Fi settings remain in NVS during a normal OTA application update

## First use
1. Upload the initial bootstrap once by USB/Arduino IDE.
2. Connect the kit to Wi-Fi and verify Kit Connect.
3. Upload this WebApp project to the repository.
4. GitHub Actions builds and publishes the V18.3.23 `.bin` automatically.
5. Open Firmware Update -> Auto Load Latest -> update the connected `ZFC-A1` kit.
6. After reboot, open Python Lab -> **I²C Scan Example** -> **Run**.

## Safety
The current V18.3.23 firmware is still a local bridge / educational firmware, not the final complete Angle/Rate flight-control core. I²C scanning is intentionally blocked while armed. Keep propellers removed during firmware and sensor bench work.
