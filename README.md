# ZEBJUS F450 Drone Engineering Lab — V15.2

V15 focuses on simulator physics, complete Roll/Pitch/Yaw PID tuning, motor audio, manual disturbance testing, transmitter realism and cleaner assembly UI.

## Assembly UI
The following overlay text has been removed from the 3D assembly canvas:
- VIRTUAL PRODUCT BENCH
- F450 guided mechanical assembly
- Arc guards / locked snaps / actual FC layout text
- FRONT / RED ARMS overlay

The main top bar and assembly toolbar now have improved alignment, wrapping and spacing.

## PID modes

### RATE MODE
Only the **Rate PID** panel is used:
- Roll P / I / D
- Pitch P / I / D
- Yaw P / I / D

### ANGLE MODE
Both cascaded loops are used:
- Rate Roll / Pitch / Yaw PID
- Angle Roll / Pitch / Yaw PID

Angle mode uses the Angle loop to generate desired rates, then the Rate loop drives the virtual motors.

## Tripod physics
- Roll, Pitch and Yaw are simulated.
- Yaw angle and yaw rate are both visible.
- Throttle moves the drone slightly up/down on the tripod's sliding/pivot section.
- Individual motor mix changes from PID correction.
- Individual propeller speed now follows M1–M4 motor mix, not only a common throttle speed.
- Rotor blur follows individual motor speed.

## Manual disturbance
Enable **Manual tilt**, then drag the drone in the 3D simulator:
- Angle mode actively returns the drone toward the commanded angle.
- Rate mode arrests angular rate but does not automatically level the attitude.
- M1–M4 speeds visibly change while the controller corrects the disturbance.
- Motor sound changes with the correction load.

## Motor / propeller audio
Web Audio is generated in the browser; no external audio files are required.
- Tripod propeller/motor pitch increases with throttle.
- Sound changes with motor imbalance during PID corrections.
- 2D BLDC test has a free-spin motor sound.
- 2D sound pitch follows PWM 1100–2000 µs.

## Transmitter
The virtual sticks now use a radio-gimbal style:
- rounded square gimbal housing
- circular travel ring
- cross/diagonal guides
- stem + stick cap
- circular travel clamping

## Airflow / downwash
The tripod simulator now includes:
- four separate animated downwash streams under the four propellers
- speed-dependent air rings
- stronger radial floor dust particles at higher throttle
- downwash intensity follows each motor's individual speed

## Response chart
The simulator response chart now plots:
- Roll
- Pitch
- Yaw

## Existing V14 hardware work retained
- corrected FC 4×3 ESC block
- 3×3 GPIO block
- separate RX/PPM block
- I²C
- 2.54 mm upward male headers
- flexible ESC-to-FC wiring
- GPS stand
- optional 2D/3D sync
- under-frame battery and XT60 animation
- staged ESC/FC LEDs and power sequence


## V15.2 XT60 visibility / validation fix
- The bottom PDB now has a larger, clearly visible yellow XT60 socket at the outer left edge.
- XT60 contact barrels, solder tabs, thick red BAT+ lead and brown-black BAT− lead are visible.
- The battery plug animation targets this visible socket.
- Before connection, the 2D validator explicitly says `XT60 battery + / − not connected yet`.
- Pressing **Connect battery XT60** immediately updates the build checklist and 2D validation.
- The removed assembly overlay no longer leaves a stale `benchSubtitle` JavaScript reference.
- Final Inspection remains a deliberate manual confirmation step after XT60 + props.
