# GitHub upload — V18.3.24

Upload the contents of this folder to the **repository root** so `index.html` is at the top level.

After the first commit, `.github/workflows/build-flightcore-firmware.yml` automatically:
1. installs Arduino CLI,
2. installs Arduino-ESP32 3.3.7,
3. builds ZFC-A1 / ZFC-A2 application binaries,
4. updates `FlightCore_Firmware/catalog.json`, and
5. commits the generated `.bin` files back to the repository.

For the current ESP32-C3 controller, Firmware Center expects:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_V18_3_24_APP.bin`

If the workflow is still running, Firmware Center can temporarily show **No bundled binary**. Refresh after the GitHub Actions build completes and the generated firmware commit appears.
