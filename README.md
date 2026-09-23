# ZEBJUS F450 Drone Engineering Lab V18.3.25

Browser-based F450 assembly, 2D wiring, Python learning, simulator, local-kit control and firmware update environment for ZEBJUS FlightCore.

## V18.3.25 reliability update

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

The V18.3.25 firmware is still the local bridge / educational firmware represented by the source in this repository; it is not a claim that the final complete Angle/Rate flight-control core is present. Keep propellers removed during firmware, I²C and sensor bench work.

See `FILE_REPLACEMENT_POLICY.md` for the future drag/drop replacement rules and `RELEASE_NOTES_V18_3_25.md` for this release.
