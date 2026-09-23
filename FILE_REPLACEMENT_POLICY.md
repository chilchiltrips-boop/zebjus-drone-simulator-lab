# ZEBJUS file replacement policy

## Replace in place (stable filenames)

Keep these names stable between releases so GitHub drag/drop/push updates the existing path instead of leaving old versioned copies:

- `index.html`
- `styles.css`
- `app.js`
- `glb-loader.js`
- `service-worker.js`
- `kit-local.js`
- `school-lab.js`
- `ui-runtime.js`
- `firmware-updater.js`
- `three.module.min.js`
- `firmware-catalog.json`
- `firmware-latest.json`
- `FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`
- `FlightCore_Firmware/catalog.json`
- `FlightCore_Firmware/latest.json`
- `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin` (generated)
- `FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A2_APP.bin` (generated when A2 build is enabled)

Component `.glb` and thumbnail filenames should also remain stable when a model is replaced.

## Intentionally versioned files

`RELEASE_NOTES_V*.md` is historical documentation. Multiple release-note files may coexist intentionally. Git history is the primary source of old code; do not keep old version-numbered `.ino` or application `.bin` files in the active firmware folder.

## Before publishing

Run:

```bash
python3 tools/validate_project.py
```

The validator rejects duplicate/versioned `.ino` sources, stale versioned app binaries, mismatched catalogs, missing component files and unsupported packaged GLB features.
