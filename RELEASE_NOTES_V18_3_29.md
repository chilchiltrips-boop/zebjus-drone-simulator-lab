# ZEBJUS F450 Drone Lab V18.3.30

- Python Lab terminal stays on the right side on normal desktop widths.
- Removed LEARN / Python Examples UI; normal typed Python is the default workflow.
- Added compact Hardware quick code selector for I²C Scanner and LSM6DS3 Sensor Live.
- Real-kit hardware examples now preflight the kit connection and show a short actionable message instead of a Pyodide traceback.
- Python stdout remains live in the visible terminal while the program runs.
- Stderr is buffered and reduced to a useful error message; editor line markers still identify code errors.
- Stop no longer adds misleading output when no Python program is running.
- Includes V18.3.28 assembly/wiring synchronization and prop-guard alignment fixes.

### CI cleanup hotfix
- GitHub web uploads can replace same-name files but do not delete removed files.
- Build workflow now removes obsolete `drone3d.js`, `wiring2d.js`, `learning-lab.js`, old FC standoff asset, and legacy versioned firmware names before validation.
- `FILE_COUNT.txt` is regenerated after firmware compilation/cleanup, so the stable generated `.bin` is included in repository validation.
- Publish step uses `git add -A` so stale-file deletions are committed together with the stable firmware output.
