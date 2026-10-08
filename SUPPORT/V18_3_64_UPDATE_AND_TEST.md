# V18.3.64 update and setup

Update the APK / WebApp and the matching A2 firmware together. Use the firmware updater's exact Device ID and board profile checks. A1 is a bridge and cannot run the flight configuration wizard.

Open Kit settings → FC Setup Wizard. Remove all propellers before beginning. Detect the board, verify its permanent Device ID, select quadcopter and Quad X/H, then keep the frame level and still for gyro and accelerometer / level calibration. Progress reports processed FC sample attempts; failed calibration can be retried.

For PWM ESC calibration, follow the manufacturer's battery and tone sequence. HIGH is limited to 12 seconds, LOW to 3 seconds. Confirm actual success tones after LOW finishes, or explicitly mark already-calibrated ESCs. Firmware has no tone feedback.

Find a reliable starting pulse individually for all four motors using the 800 ms pulse test and 5 µs adjustments. Mark only physically observed starts. Saved idle is the highest start +20 µs, with supported limits 1050–1250 µs. The wizard rejects an unsupported idle instead of silently clipping it. Verify every physical motor position and rotation using individual / all motor tests. Hardware I/O shows connector routing; end setup before changing routing or ESC direction.

Choose App/Web or Physical PPM. For PPM, use six distinct channels, sweep sticks and switches fully, then capture directional centres with throttle minimum and ARM low. Check mapping and reversals before save/readback. Directional centres need at least 150 µs on each side; every function needs 400 µs total travel. Select yaw-right, yaw-left, or mapped ARM switch. Yaw gestures need minimum throttle, centred pitch/roll and a one-second hold.

Set receiver RF-loss behavior to stop PPM pulses, then observe fresh → stale → fresh frames by switching the transmitter OFF and ON while setup inhibits arming. A receiver that continues sending held values cannot report RF loss to this FC. The Web step acknowledges the displayed timeout policy; it does not perform a physical loss test.

Finish leaves motors disarmed and releases the configuration grant. Return all directional sticks to centre, throttle minimum and ARM low; re-enable controls and ARM manually. Advanced PID opens the existing disarmed PID editor. The setup record is local to this browser / app and exact kit, and records physicalFlightTested=false.

Check touch-down neutrality, relative stick travel, throttle hold, STOP, brief gaps, prolonged loss / safe fresh-session recovery, foreground/background behavior and the correct Device ID before physical qualification. Software tests and successful builds do not certify an aircraft for flight.
