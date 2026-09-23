# ZEBJUS F450 Drone Lab V18.3.29

Deep assembly/runtime reliability release based on full project audit.

## 3D assembly and component loading

- Fixed F450 arm GLB mechanical scale so each real model motor-pad datum lands exactly on the M1–M4 motor snap centers.
- Motor screw targets now follow the rotated/scaled real arm hole pattern instead of world-axis offsets.
- Magnetic snap distance now uses horizontal X/Z distance only; elevated GPS/prop/FC targets no longer appear falsely far from a workbench pointer.
- Tightened per-component snap radii so parts do not jump into place from visibly wrong positions.
- Fixed bundled GLB vertex-colour handling (authored 8-bit display colours are converted to Three.js linear working space) and balanced scene lighting to reduce washed-out/faded parts.
- GLB loader now preserves basic glTF material factors and fails safely on unsupported packaged features.
- Component placement waits for local model preload, preventing a fast click from permanently installing a procedural fallback while the GLB is still loading.
- Added the missing visible XT60 socket/terminals to the successfully loaded bottom-PDB GLB path.
- X-ray mode now restores each material's original opacity/transparency/depth state instead of overwriting it every frame; FC-case X-ray and frame X-ray can coexist.
- Component shelf uses lightweight local thumbnails; generated `thumb_matrix.png` replaces the heavy LED-matrix reference image in the shelf.
- Service worker pre-caches all active component thumbnails as well as all 15 packaged GLB models.

## Runtime / school lab

- Fixed a temporal-dead-zone startup risk by declaring `ARM_GLTF_Z_SCALE` before slot generation.
- Reconnect policy is normalized to 5 consecutive failures and a 10-second offline threshold.
- Existing V18.3.26 app-module / school-lab diagnostics and firmware `ImuSample` header fix are retained.

## Firmware CI

- Stable firmware filenames remain `ZEBJUS_FLIGHTCORE.ino` and `ZEBJUS_FLIGHTCORE_A1_APP.bin`.
- Arduino-ESP32 remains pinned to 3.3.12.
- GitHub Actions now pins Arduino CLI 1.5.1 instead of the `1.x` wildcard that selected a release candidate on the runner.
- Checkout action updated to v5 for Node 24 runner compatibility.

## Validation

`tools/validate_project.py` now also checks assembly snap implementation, arm mechanical datums, colour-loader support, thumbnail offline caching, preload gating, reconnect policy, CI tool pinning and stable active release notes.
