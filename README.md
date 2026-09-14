# ZEBJUS F450 Drone Engineering Lab — V14

## Corrected ZEBJUS FC headers
- ESC section: **4 columns × 3 rows**
  - columns = ESC1, ESC2, ESC3, ESC4
  - rows = Source / +5V / GND
- External GPIO: separate **3 columns × 3 rows** block, visually lower/separated from RX.
- RX/PPM: separate **1 column × 3 rows** block.
- I²C: separate 4-pin block.
- All FC user pins project upward as 2.54 mm-style male header pins.

## ESC female plug / flexible cable
- ESC Source/+5V/GND wires now rise above the top plate and approach the FC from above.
- Flexible curved 3D leads remain visible.
- One female 3-pin housing descends vertically onto each ESC male-header column.

## Top-deck optional-component space
- Receiver: reserved right-side top-deck position.
- GPS: automatic raised mast / GPS stand.
- LED matrix: reserved left-side position.
- Sensor / LED / servo positions stay separated from the FC header blocks.

## FC RGB status
- Bright RGB indicator replaces the previous weak two-LED indication.
- Boot: bright red.
- Ready: bright green/cyan.
- Battery disconnect: RGB off.

## Battery
- XT60 connection animation now includes visible flexible thick red + brown-black leads.
- Existing ESC startup tone, LED sequence, power-flow and prop idle are retained.

## 2D wiring / 3D sync
- 2D FC header drawing mirrors the corrected 3D layout.
- ESC, GPIO, RX and I²C blocks are boxed separately.
- Exact pin dots stay visible above wires.
- PPM Receiver, Servo, LED Matrix, I²C Sensor, GPS + stand and LED/Output can be added to the 2D bench.
- An optional part that is already placed in 3D is hidden from the 2D **unplaced-parts** bench; its 2D wires also disappear because that node is no longer drawn.

## Guided order
Bottom PDB → Arms → Prop guards → Motors → Motor screws → ESCs → Motor U/V/W →
ESC power soldering → Top plate → Frame screw set → FC double-side tape →
ZEBJUS FC → ESC Source/+5V/GND → Battery underneath + straps → XT60 → Props → Final inspection.
