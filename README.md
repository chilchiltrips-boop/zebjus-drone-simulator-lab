# ZEBJUS F450 Drone Engineering Lab — V12

V12 focuses on the mechanical/electrical details of the real build and a more readable PID tripod simulator.

## Flight-controller mounting
- FC standoffs/spacers are removed.
- The ZEBJUS FC case mounts directly to the upper plate using a thin double-side foam tape pad.
- The FC case retains ZEBJUS FC branding and the FRONT arrow.

## FC headers
- User-accessible 3-pin groups now use upward-projecting educational 2.54 mm-style male header pins.
- ESC female 3-pin connector housings animate downward from above onto the male pins.
- Source/PWM = orange.
- +5V = thin light red.
- GND = brown/black.
- ESC high-current / ~12 V positive = thick red.
- Ground return for high-current paths = thick brown/black.

## Battery / PDB
- The LiPo is mounted underneath the central drone frame.
- Two strap loops visually tighten around the battery.
- A 3D XT60 socket is soldered to the bottom PDB.
- Assembly Lab includes a Connect battery / Disconnect battery control.
- Battery connection animates the XT60 plug.
- After connection, simulated ESC startup tones play, FC/ESC LEDs light, and assembled propellers rotate slowly at idle.
- Disconnecting the battery turns off LEDs and stops idle propeller rotation.

## Assembly feedback
- Each major component placement has its own generated sound cue.
- Frame and motor screw sets install with a slower sequential tightening animation.
- A visible virtual Allen-key tool follows each screw while it tightens.

## 1045 propellers
- The runtime propeller is now a tapered, swept, two-blade 1045-style shape with a central adapter/nut.
- The same improved propeller is used in the tripod simulator.

## 2D wiring
- FC-side wires are drawn above the FC body and approach each pin with a visible final segment.
- Wires remain attached when components are dragged.
- Source/PWM is orange, +5V light red, GND brown/black, and high-current +12 V red.
- Existing phase-swap motor direction simulation, current-flow animation, wire delete/redraw, component dragging and PWM test are retained.

## Tripod PID simulator
- Larger Rate / Angle PID controls.
- Brighter studio-style lighting and background.
- Final assembled drone remains on the tripod.
- Prop speed is more readable.
- Ground dust/downwash particles increase with throttle.
- Stable / under-tuned / oscillating response logic is retained.

## Packaging
The ZIP has one top-level folder and no nested asset directory.
Upload every file inside that folder to the GitHub repository root.
