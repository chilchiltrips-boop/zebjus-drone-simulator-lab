# ZEBJUS F450 Drone Engineering Lab — V16

V16 applies the requested 11-part improvement pass.

1. Full 2D ↔ 3D optional-device sync, including 3D flexible wires for optional 2D connections.
2. Magnetic snap preview, green/red target feedback, existing screw/strap animations and X-ray inspection.
3. Expanded electrical validation: polarity, battery-voltage-to-FC mistakes, missing ESC grounds, wrong ESC output, duplicate FC pins, I²C swap, phase completeness and battery range.
4. More realistic power-up: XT60 spark, ESC sequence, gyro / receiver checks, READY TO ARM indication and assembly idle motor sound.
5. Improved PID physics: motor lag, battery voltage, payload, CG offset, wind disturbance and separate Roll/Pitch/Yaw inertial response.
6. Four-motor PID sound bank so correction load changes the sound as individual motor speeds diverge.
7. Improved prop/downwash: motor-specific blur, downwash rings/cones and floor dust that changes with throttle and height.
8. FC realism: exact accessible headers retained, hover tooltips and an FC case X-ray toggle.
9. Guided education cards: WHY, CORRECT, COMMON MISTAKE, RISK and CHECK for each build stage.
10. Professional tools: project JSON export/import, wiring SVG/PNG, BOM CSV, progress report, Print/PDF, fullscreen, graphics profiles, diagnostics and offline service worker.
11. The 3D assembly workbench is now ROUND instead of the previous square bed.

Existing V15.2 W/F/R/Delete wiring shortcuts and 2D↔3D optional-component add/delete sync are retained.
