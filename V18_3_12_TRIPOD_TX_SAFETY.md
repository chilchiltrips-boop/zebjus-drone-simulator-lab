# V18.3.13 Tripod transmitter safety + TX10 visual sync

- Tripod Simulator Virtual Transmitter now uses the same round TX10 gimbal/stick visual language as the 10-Channel Joystick Lab.
- Pointer leaving the circular gimbal immediately releases the directional axis instead of allowing an edge command to remain latched.
- Pointer up/cancel, lost pointer capture, browser blur and hidden-tab events also release the directional command.
- Right stick returns Roll/Pitch to center. Left stick returns Yaw to center while retaining the current throttle value.
- Keyboard directional states are cleared when the browser loses focus or the tab becomes hidden, preventing a missed key-up from holding Roll/Pitch/Yaw.
- The same keyboard focus-loss guard is applied to the 10-Channel Joystick Lab.
- Cache/app version bumped to 18.3.13.
