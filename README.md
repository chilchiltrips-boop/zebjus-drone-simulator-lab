# ZEBJUS F450 Drone Engineering Lab — V13 FULL REALISM FIXED

This build fixes the malformed V12.1 `app.js` and implements the requested hardware-style assembly and simulator behaviour.

## Final guided order

Bottom PDB → Arms → Prop guards → Motors → Motor screw set → ESCs →
Motor U/V/W → ESC power soldering → Top plate → Frame screw set →
FC double-side foam tape → ZEBJUS FC → ESC Source/+5V/GND →
Battery underneath + automatic straps → XT60 connect → 1045 props → Final inspection.

**There are NO FC spacers/standoffs.** The FC case is mounted directly to the top plate using double-side foam tape.

## FC connector realism
- Upward-projecting 2.54 mm-style male header pins on the FC.
- ESC female 3-pin housings insert vertically from above.
- Source/PWM = orange.
- +5V = thin light red.
- GND = brown-black.
- High-current battery / ESC +12 V = thick red.
- High-current return = thick brown-black.

## Battery / power sequence
- LiPo is mounted under the central frame.
- Two straps appear automatically and tighten around the battery.
- The bottom PDB includes a 3D soldered XT60 socket.
- Connect battery button animates XT60 insertion.
- ESC LEDs and startup beeps run sequentially.
- FC power/status LEDs then start.
- Installed propellers idle slowly only after startup completes.
- Disconnect stops props, LEDs and power-flow particles.

## Assembly feedback
- Different generated sound cues for plate, arm, guard, motor, ESC, tape, FC, battery, strap, prop, connector and screw.
- Frame/motor screw sets use one-drag installation with a slower visible Allen-key tightening sequence.

## 2D wiring
- FC wires pass visibly over the FC case to the exact pin.
- FC pin circles are redrawn above the wires.
- FC rows are labelled SOURCE / +5V / GND.
- Wire gauge is represented visually:
  - +12 V high-current: thick red
  - Ground return: thick brown-black
  - Source/PWM: thin orange
  - +5 V: thin light red
- Components remain draggable and wires reroute automatically.
- Wire delete/redraw/undo retained.
- Motor U/V/W swap still reverses motor direction.
- PWM motor test and animated current flow retained.

## Tripod PID simulator
- Larger grouped Rate PID and Angle PID controls.
- Improved lighting/background.
- Realistic two-blade 1045 propeller geometry.
- Rotor blur increases with throttle.
- Ground dust/downwash increases with prop speed.
- Keyboard + virtual transmitter controls retained.

## GitHub Pages
The ZIP contains one top-level folder. Inside it all project files are flat; there is no nested `assets` folder.
Upload every file inside the folder directly to the GitHub repository root.
