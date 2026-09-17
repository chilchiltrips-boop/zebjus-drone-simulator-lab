# V18.3.11 Joystick pointer-return fix

- 10-Channel Joystick Lab no longer holds Roll/Pitch/Yaw at the last edge position when the pointer leaves the circular gimbal.
- Pointer exit, pointer cancel, pointer release anywhere in the window, and browser focus loss all release the virtual stick.
- Right stick springs Roll/Pitch to center.
- Left stick springs Yaw to center while preserving the current throttle value; this avoids an unsafe automatic throttle jump.
- X / DISARM SAFE behavior remains unchanged: throttle is forced to 1000 and arm is cleared.
- Simulator gimbals use the same robust pointer-release behavior.
- Cache/app version bumped to 18.3.11.
