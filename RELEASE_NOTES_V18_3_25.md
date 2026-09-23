# V18.3.27 — Component Loader + Stable Firmware Files

## Fixed

- Real packaged 3D component models now load from local `.glb` files.
- Removed the old `cloneAsset() => null` behavior that prevented the runtime from ever using those models.
- Added local model preload and component-level procedural fallback instead of all-or-nothing failure.
- Corrected the root `firmware-latest.json` catalog pointer.
- Removed stale V18.3.23 A1 binary and unused FC standoff model.

## Firmware/update workflow

- Active source renamed to stable `ZEBJUS_FLIGHTCORE.ino`.
- Generated A1 application renamed to stable `ZEBJUS_FLIGHTCORE_A1_APP.bin`.
- A2/factory catalog filenames follow the same stable convention.
- Arduino-ESP32 build core updated to 3.3.12.
- GitHub Actions now overwrites stable binary/metadata files and validates the project before publishing.

## Validation

Added `tools/validate_project.py` for version, JSON, JavaScript syntax, HTML local references, component assets, GLB compatibility, service-worker model cache and firmware catalog/build naming checks.
