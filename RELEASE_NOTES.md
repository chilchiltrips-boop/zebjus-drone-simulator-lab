# ZEBJUS F450 Drone Lab V18.3.39

- Fixed stale cached Device ID/IP blocking a replacement XIAO ESP32-C6 that reuses a previous Kit Name.
- Added multi-kit-safe discovery and strict per-device selection using full Device ID.
- Duplicate live Kit Names are surfaced instead of silently choosing the wrong controller.
- Background discovery now continues while the selected kit is connected.
- Preserves V18.3.38 A1/A2 dual firmware build/publish race protection and V18.3.37 Rate/Angle + PPM/Web/AP integration.
