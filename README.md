# ZEBJUS F450 Drone Engineering Lab V18.3.37

Browser-based F450 assembly, 2D wiring, Python learning, simulator, local-kit control and firmware update environment for ZEBJUS FlightCore.

## V18.3.37 Rate + Angle FlightCore integration

ZFC-A2 / XIAO ESP32-C6 now contains the supplied MPU6050 Rate-mode and Angle-mode control loops instead of acting only as a Wi-Fi/sensor bridge. The A2 profile uses D1/D2/D3/D0 for M1/M2/M3/M4 ESC PWM, a 250 Hz control loop, boot gyro calibration, accelerometer roll/pitch, 1D Kalman fusion, the supplied PID/mixer structure, CH5 arming and CH6 Angle/Rate selection.

Control-source order is: fresh physical PPM first, then verified WebApp RC, then the same HTTP RC path from the built-in `/fly` page when connected directly to the controller AP. Source changes, RC timeout, IMU read failure, mode changes while armed, or CH5 low force motor-safe output. The firmware does **not** auto-run ESC calibration at boot.

A1 / ESP32-C3 intentionally remains bridge-only until its real motor-output pin map is confirmed. BMP388 can coexist on I²C and is discoverable, but altitude hold is not part of this release. Browser PID persistence/live write is also not enabled yet.

## Stable firmware filenames

These names should stay unchanged in future releases:

- Source: `FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`
- A1 application binary: `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin`
- A2 application binary: `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A2_APP.bin`
- A1 factory image (when available): `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_FACTORY.bin`
- A2 factory image (when available): `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A2_FACTORY.bin`

The release number belongs in `VERSION.txt`, firmware `FW_VERSION`, catalog metadata and UI metadata — **not in the mutable firmware filename**. Replacing a future `ZEBJUS_FLIGHTCORE.ino` therefore replaces the old source instead of creating another version-named source file.

## Automatic board-aware firmware build

`.github/workflows/build-flightcore-a1.yml` keeps its stable filename for replacement compatibility, but now builds **all supported board profiles**:

1. ZFC-A1 / ESP32-C3,
2. ZFC-A2 / XIAO ESP32-C6,
3. application images for both boards,
4. merged/factory images when the Arduino build actually produces them,
5. SHA-256, byte size, UTC build time and Build ID metadata,
6. full project validation before publishing, and
7. stable binary/catalog files committed back to the repository.

The web updater verifies ESP image structure and board chip ID before an imported `.bin` is accepted.

## Connection / Python / sensor reliability

- Device identity uses the complete 48-bit MAC, with migration matching for older six-hex IDs.
- A discovered kit is shown as **FOUND**, not Connected, until the browser client has verified that exact Device ID.
- Changing kit clears stale client identity so an old kit cannot silently reconnect as the new selection.
- A2 telemetry reports live Rate/Angle flight state, active RC source, channels and motor outputs; A1 continues as receiver + raw-IMU bridge telemetry.
- Python runs in a fresh Web Worker on every Run/Rerun. Stop terminates the Worker, so even a non-cooperative infinite loop can be stopped.
- LSM6DS3 and MPU6050 are auto-detected; Python Lab includes live charts, sample rate/age, CSV recording and browser-side teaching calibration.

## Local development

```bash
npm start
```

Open the local URL printed by `server.js`. Do not rely on double-clicking `index.html`; ES modules, service workers and firmware APIs are designed to run from HTTP/HTTPS.

Run the integrity check before publishing:

```bash
npm run check
```

## Firmware Center behavior

If `catalog.json` says an application image is unavailable, Firmware Center will not pretend an old binary is current. After GitHub Actions builds the new stable binary, the catalog becomes available with its SHA-256 and the updater can auto-load it. Browser-imported `.bin` files remain supported.

V18.3.37 contains a real Rate/Angle flight loop on the A2/XIAO ESP32-C6 profile. A1 remains bridge-only. Altitude hold, persistent live PID tuning, battery failsafe and full flight calibration are still pending. Perform initial motor-order/direction and control checks with propellers removed.

See `FILE_REPLACEMENT_POLICY.md` for future drag/drop replacement rules, `RELEASE_NOTES.md` for the replace-in-place current notes, and `RELEASE_NOTES_V18_3_27.md` for this historical release snapshot.

## GitHub web-upload cleanup
GitHub's browser uploader overwrites matching filenames but does not delete files removed from a newer release ZIP. The firmware workflow therefore runs `tools/cleanup_repo.py` after compilation. It removes known obsolete runtime/firmware leftovers, refreshes `FILE_COUNT.txt`, validates the result, and commits those deletions together with the stable firmware binary.
