# ZEBJUS F450 Drone Lab V18.3.34

- Python editor given more horizontal workspace; project and terminal columns reduced.
- Added Python project Undo / Redo and stronger file delete workflow.
- Real-kit selector is locked while Python is running to prevent target changes mid-stream.
- Python `Drone.imu()` / `i2c_scan()` no longer perform a fragile repeated DOM-target check after preflight.
- LSM6DS3 live example tolerates temporary sensor read misses instead of immediately terminating.
- Real IMU bridge retries transient reads; firmware IMU API now uses 100 kHz I²C and multiple read attempts for jumper-wire robustness.
