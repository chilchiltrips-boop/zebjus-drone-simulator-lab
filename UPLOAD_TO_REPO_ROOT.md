# ZEBJUS V18.3.23 A1 Actual BIN Build Pack

This pack contains the minimum files required for GitHub Actions to compile the real
ESP32-C3 / ZEBJUS FlightCore A1 application binary.

Expected generated file:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_V18_3_23_APP.bin`

Upload the CONTENTS of this folder into the ROOT of the GitHub repository.

Important on macOS:
- `.github` is hidden.
- In Finder press `Cmd + Shift + .` so the `.github` folder is visible before dragging files.

After upload:
1. GitHub -> Actions
2. `Build ZEBJUS FlightCore A1 Firmware`
3. Wait for the green check.
4. The workflow also commits the actual `.bin` into `FlightCore_Firmware/`.
