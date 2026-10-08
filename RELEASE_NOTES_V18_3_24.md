# V18.3.24 — 2D Assembly Sync + Python Learning IDE + LSM6DS3

- Page order: Assembly → 2D Wiring → Python Lab → Tripod Simulator → Joystick → remaining tools.
- Correct 2D motor, ESC power, ESC→FC and XT60 wiring now derives Guided Assembly completion automatically.
- Deleting/wrong wiring immediately removes that assembly completion; Next stays locked until prerequisites + wiring are correct.
- Guided wiring animation is preview-only and never advances the step.
- Python Lab redesigned as a 3-pane PyCharm-style learning IDE with local `.py` files, examples, syntax colouring, line numbers, autocomplete, input(), stdout/stderr and highlighted runtime errors.
- Python examples cover print, maths, input, conditions, for/while loops, functions, lists/dicts, OOP/classes and try/except.
- `drone.i2c_scan()` now returns data only so students fully control terminal text.
- New real-hardware APIs: `await drone.imu()`, `await drone.gyro()`, `await drone.accel()`.
- FlightCore adds `/api/imu` for LSM6DS3 at 0x6B/0x6A, WHO_AM_I 0x69, 104 Hz ±2g / ±245 dps scaling.
- IMU bench reads are blocked while armed.
- GitHub Actions builds the real A1 APP.bin after upload; catalog remains unavailable until compilation succeeds.
