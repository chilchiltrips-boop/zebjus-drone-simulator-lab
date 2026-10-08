# ZEBJUS V18.3.43 — Unified RC / Tripod Real-Kit Mirror

- Fresh WebApp/AP/Python RC now becomes the active FlightCore source; physical PPM is automatic fallback. Any source change while armed still forces DISARM.
- WebApp Joystick real-kit target simultaneously mirrors the same CH1–CH10 frame into Tripod Simulator.
- Tripod Simulator adds REAL KIT MIRROR: mouse/touch/keyboard sticks, RUN/STOP, ANGLE/RATE and PID Apply can drive the selected controlled FlightCore while the same response remains visible in simulation.
- Telemetry mirrors every active RC source (PPM, WEB_STA, WEB_AP/Python) into the Tripod sticks, so an AP transmitter can be visualized from a connected lab session.
- Python Real Kit target now mirrors PID writes, RC frames and supported bench/calibration actions into Simulator; literal PID constants are previewed in Tripod before execution.
- Real mirror requires the selected Device ID control lock and explicit bench-safety confirmation.
