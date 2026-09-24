# ZEBJUS F450 Drone Lab V18.3.36

- Fixed GitHub Arduino compile failure: `ImuKind` now lives in the companion header so Arduino auto-generated prototypes can resolve it.
- Same fix is shared by ZFC-A1 ESP32-C3 and ZFC-A2 XIAO ESP32-C6 builds.
- Build script now prints board ID/name/FQBN before compilation and raises a concise board-specific failure message.
- Upload packaging consolidated into one outer ZIP containing `BATCH_1_CORE` and `BATCH_2_ASSETS`.
- Retains V18.3.35 reliability, multi-board, Python Worker, assembly/wiring, simulator, and sensor-bridge improvements.
