# ZEBJUS FlightCore V18.3.42

- Real MPU6050 attitude/Kalman updates continuously at 250 Hz while DISARMED, even with no active RC source.
- `pid_get`, receiver/PPM, attitude, calibration read and bench-status are read-only commands and work in View Only mode.
- Mutating Python commands auto-acquire the selected Device ID control lock when it is available; another controlling browser is still respected.
- Fixed ESC/motor Python errors so a control-lock failure is no longer mislabeled as a PROPS_REMOVED confirmation error.
- Persistent A2 MPU6050 level calibration: manual Acc X/Y/Z additive offsets, Roll/Pitch trim, NVS save/read/defaults, and automatic level capture targeting X=0 g, Y=0 g, Z=+1 g.
- Auto level capture also refreshes the live gyro bias while the frame is level/still.
- Python adds `get_calibration()`, `set_accel_offsets()`, `level_calibrate()` and `restore_calibration_defaults()` plus three editable calibration projects.
- Calibration page now exposes Read from FC, Capture Level, Save Offsets and Restore Defaults with live bias/acceleration values.
