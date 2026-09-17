# V18.3.13 — Real RX Mirror + Live Health

- PPM receiver telemetry on configurable GPIO18 with 10-channel mirror data.
- Tripod virtual transmitter follows physical receiver Roll/Pitch/Throttle/Yaw and ARM state when live RC frames are available.
- Physical RX mode mirrors ANGLE/RATE into the simulator; ALTITUDE currently uses the simulator's Angle attitude model until a dedicated altitude physics loop is added.
- Joystick inactivity watchdog centers Roll/Pitch/Yaw only; throttle is never modified. Timeout and armed warning are configurable.
- Separate command freshness indicator: COMMAND OK / DELAY / LOST.
- Sensor health panel: IMU, barometer, LiDAR and receiver with OK / NOT FOUND / STALE states.
- PID editor shows UNSAVED after a PID change, SENDING while waiting for the real FC, and SAVED only after a positive PID acknowledgement.
- Duplicate Kit Connect connection-order helper removed.
- Cache/version moved to 18.3.13.

The local bridge firmware reports real PPM receiver health. IMU/barometer/LiDAR remain NOT FOUND in this bridge until their actual flight-controller sensor drivers publish live health fields; the web UI is ready to consume those fields.
