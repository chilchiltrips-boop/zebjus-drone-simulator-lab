# ZEBJUS F450 Drone Engineering Lab V18.3.27

## Assembly placement / colour fixes
- Replaced bench-plane magnetic snap selection with screen-space target snapping. Elevated ESC, guard, motor, FC and prop targets no longer shift under perspective because of ray/bench parallax.
- Magnetic preview now stays on the exact installation slot and scales to the selected component class.
- Final installation continues to use the canonical slot transform, so preview and final placement share the same target.
- Reduced over-bright PBR lighting and ACES exposure to stop red/white/ESC component colours from looking washed-out.
- Preserved each material's base opacity / transparency / depth-write state across X-ray and FC-case X-ray toggles instead of forcing every material back to opacity 1.

## Cache / runtime consistency
- Bumped the service-worker cache namespace to `zebjus-flightcore-v18-3-27` so browsers do not keep serving the V18.3.26 app after replacement.
- App, HTML, package, firmware catalogs and firmware source version are aligned to 18.3.27.

## Firmware
- Keeps stable source name `FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`.
- Keeps stable binary name `ZEBJUS_FLIGHTCORE_A1_APP.bin`.
- Retains the companion `ZEBJUS_FLIGHTCORE_TYPES.h` fix for Arduino auto-generated prototypes and `ImuSample`.
- Arduino-ESP32 core remains 3.3.12.
- GitHub Actions pins stable Arduino CLI 1.5.1 (no floating prerelease selection).

## Cleanup / validation
- Removed unused legacy `drone3d.js`, `wiring2d.js`, and `learning-lab.js`; they were not loaded by the current application.
- Validator checks the service-worker cache version, parallax-safe assembly snap implementation, material-state preservation, stable firmware names, JS module syntax, local references and GLB compatibility.
