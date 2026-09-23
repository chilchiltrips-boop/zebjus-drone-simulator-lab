# Upload to repository root — V18.3.26

This package is already arranged for repository-root drag/drop.

On macOS press `Cmd + Shift + .` first so `.github` is visible, then select the **contents** of this folder and upload them to the existing repository root. Same-name files are intended to replace the earlier copies.

Do not create a second version-named firmware source. Keep:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`

GitHub Actions builds/replaces:

`FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin`

After upload, open **Actions → Build ZEBJUS FlightCore A1 Firmware** if you want to run it manually. A normal push that changes the stable firmware source also triggers it automatically.
