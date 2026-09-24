# ZEBJUS F450 Drone Engineering Lab V18.3.36

Browser-based F450 assembly, 2D wiring, Python learning, simulator, local-kit control and firmware update environment for ZEBJUS FlightCore.

## V18.3.36 corrective reliability update

OTA firmware reboot recovery now waits up to 120 seconds, drops a stale cached DHCP address after quick retries, then falls back to kit-name.local and same-Wi-Fi discovery. A successful flash remains marked successful while reconnect is pending; a 5-minute background watch verifies the new firmware when the kit comes back.

- Fixed the `app.js` ES-module parse regression in the Python bridge object (missing closing brace), which caused the V18 startup guard to report `app.js failed to load/parse`.
- Verified `school-lab.js` separately and added independent parsed/ready markers so startup diagnostics no longer mix app-module and school-lab failures.
- Fixed the ESP32-C3 GitHub Actions compile error around `ImuSample` by moving that type into a companion header included before Arduino auto-generated prototypes.
- Firmware build automation now copies companion `.h/.hpp/.c/.cpp` files into the temporary sketch.
- Strengthened `tools/validate_project.py` to parse `app.js` and other ES modules in real module mode; the V18.3.25 missing-brace bug would now be rejected before publishing.
- Restored **real local GLB component loading**. The previous runtime kept the `.glb` files in the package but intentionally returned `null` from `cloneAsset()`, so every installed item was forced to procedural geometry.
- Added `glb-loader.js`, a small offline glTF 2.0 binary loader tailored to the packaged ZEBJUS component assets. All declared models preload before saved assembly restoration.
- Kept a **per-component procedural fallback**. One missing/damaged model can no longer block the page or the rest of the assembly.
- Component models are included in the service-worker offline cache.
- Firmware source and generated application binaries now use **stable replace-in-place filenames**.
- Removed the stale V18.3.23 application binary and removed the unused FC standoff model (the current FC is foam-tape mounted, with no standoff).
- Firmware catalog/latest pointers, updater, build script and GitHub Actions workflow now agree on the same filenames.
- Arduino-ESP32 build core updated from 3.3.7 to **3.3.12**.
- Added `tools/validate_project.py` for JS/JSON/file-reference/GLB/catalog/version checks.

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
- Bridge telemetry continues to poll receiver + raw IMU data even though the real flight loop is not integrated.
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

The V18.3.36 firmware is still the local bridge / educational firmware represented by the source in this repository; it is not a claim that the final complete Angle/Rate flight-control core is present. Keep propellers removed during firmware, I²C and sensor bench work.

See `FILE_REPLACEMENT_POLICY.md` for future drag/drop replacement rules, `RELEASE_NOTES.md` for the replace-in-place current notes, and `RELEASE_NOTES_V18_3_27.md` for this historical release snapshot.

## GitHub web-upload cleanup
GitHub's browser uploader overwrites matching filenames but does not delete files removed from a newer release ZIP. The firmware workflow therefore runs `tools/cleanup_repo.py` after compilation. It removes known obsolete runtime/firmware leftovers, refreshes `FILE_COUNT.txt`, validates the result, and commits those deletions together with the stable firmware binary.
