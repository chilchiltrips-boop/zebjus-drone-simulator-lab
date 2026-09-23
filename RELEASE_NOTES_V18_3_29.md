# ZEBJUS F450 Drone Lab V18.3.29

- Python Lab terminal stays on the right side on normal desktop widths.
- Removed LEARN / Python Examples UI; normal typed Python is the default workflow.
- Added compact Hardware quick code selector for I²C Scanner and LSM6DS3 Sensor Live.
- Real-kit hardware examples now preflight the kit connection and show a short actionable message instead of a Pyodide traceback.
- Python stdout remains live in the visible terminal while the program runs.
- Stderr is buffered and reduced to a useful error message; editor line markers still identify code errors.
- Stop no longer adds misleading output when no Python program is running.
- Includes V18.3.28 assembly/wiring synchronization and prop-guard alignment fixes.
