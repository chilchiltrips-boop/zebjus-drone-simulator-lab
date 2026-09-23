# ZEBJUS F450 Drone Engineering Lab V18.3.31

Browser-based F450 assembly, 2D wiring, Python learning, simulator, local-kit control and firmware update environment for ZEBJUS FlightCore.

## V18.3.31 corrective reliability update

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

## Automatic A1 firmware build

`.github/workflows/build-flightcore-a1.yml` runs when the stable `.ino`, catalog, version, build script or workflow changes. It:

1. installs Arduino CLI,
2. installs Arduino-ESP32 `3.3.12`,
3. compiles ZFC-A1 (`esp32:esp32:esp32c3`),
4. overwrites `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin`,
5. updates SHA-256 and availability in both firmware catalogs, and
6. commits the generated stable binary/metadata back to the repository.

So a future firmware source update does not require manually renaming a `.bin` for each version.

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

The V18.3.31 firmware is still the local bridge / educational firmware represented by the source in this repository; it is not a claim that the final complete Angle/Rate flight-control core is present. Keep propellers removed during firmware, I²C and sensor bench work.

See `FILE_REPLACEMENT_POLICY.md` for future drag/drop replacement rules, `RELEASE_NOTES.md` for the replace-in-place current notes, and `RELEASE_NOTES_V18_3_27.md` for this historical release snapshot.

## GitHub web-upload cleanup
GitHub's browser uploader overwrites matching filenames but does not delete files removed from a newer release ZIP. The firmware workflow therefore runs `tools/cleanup_repo.py` after compilation. It removes known obsolete runtime/firmware leftovers, refreshes `FILE_COUNT.txt`, validates the result, and commits those deletions together with the stable firmware binary.
