# ZEBJUS F450 Drone Engineering Lab — V17.4 Runtime / Wiring / Axis Fix

V17 corrects the control-model teaching behavior.

## Rate Mode
Roll, Pitch and Yaw use Rate PID only. Stick centre commands 0°/s. If the student manually tilts the drone and releases it, the controller stops the rotation but does not return to level. This is intentional Rate-mode behavior.

## Angle Mode
Roll and Pitch use Angle PID outer loops feeding the Roll/Pitch Rate PID inner loops. A manual Roll/Pitch disturbance returns to the commanded angle when tuning is stable.

Yaw is Rate PID in both modes. There is no Yaw Angle PID or heading lock.

## Student PID lesson
The simulator now shows:
- P, I and D meaning
- live P / I / D contribution values
- live target / actual / error
- Rate-loop or Angle-loop teaching selection
- Low P / High P / Low I / High I / Low D / High D / Stable presets
- diagnosis for under-tuned, over-tuned and near-stable values
- practical tuning steps
- setpoint-vs-response graph
- individual motor response and sound during correction

The stable example uses the working ZEBJUS baseline:
Rate Roll/Pitch P=0.9, I=15, D=0.035; Rate Yaw P=3, I=13, D=0; Angle Roll/Pitch P=3.

All V16 assembly, wiring, electrical validation, round workbench, export, offline and diagnostics features remain.


## V17.1 Audio comfort update
- Battery / XT60 power-up no longer starts continuous motor or propeller audio in the 3D assembly workspace.
- Slow propeller idle remains as a visual indication only.
- ESC startup uses soft sine-wave chimes instead of harsh square-wave beeps.
- Component placement, screw, connector, battery and FC effects use lower volume and softer waveforms.
- PID simulator and 2D BLDC test retain speed-dependent motor sound because those sounds are educational, but their gain and high-frequency content are reduced.
- Settings now include a Sound ON/MUTE control and master volume slider.


## V17.2 ZEBJUS branding
- First-party component-purchase branding links to https://www.zebjus.com.
- Header shop CTA.
- Assembly component-shelf advertisement with local product images.
- Every component shelf card includes a ZEBJUS purchase/find link.
- Inspector includes a ZEBJUS hardware link.
- Wiring, PID learning and real-FC connection areas include small branded hardware cards.
- No third-party ad network is used.

## V17.2 Roll / Pitch hold behaviour
The course simulator now provides the requested **Rate Hold** training behaviour:
- Move Roll/Pitch stick to rotate/tilt the drone.
- On stick release, the simulator captures the current Roll/Pitch attitude.
- Wind or manual disturbance is corrected back to that captured attitude through a fixed capture helper feeding the Rate PID.
- Poor Rate PID values create slow recovery, drift/steady error, overshoot or oscillation.

This is deliberately labelled **Rate Hold**, because pure acro/rate mode normally controls angular rate only and does not hold an absolute angle after disturbance.

### Angle Mode
- A `Calibrate level` button stores the current Roll/Pitch level reference.
- Roll/Pitch stick commands angles relative to that calibrated level.
- On stick release, target returns to the calibrated level.
- Wind/manual disturbance is corrected back to calibrated level using Angle PID → Rate PID.
- Yaw remains Rate PID only; there is no yaw-angle lock.


## V17.3 update
- Increased component pick/drop feedback volume while keeping soft waveforms.
- Added a more realistic synthetic ESC power-up sequence with rising startup tones and individual ESC confirmation tones.
- XT60 connection now has a stronger spark, expanding power-wave animation and brighter animated current pulses.
- FC now includes dedicated PWR and STATUS LED geometry in addition to the RGB indicator.
- PWR LED remains ON whenever the battery is connected; STATUS remains visibly active after boot.
- Added an on-screen FC PWR / BOOT / READY indicator beside the battery power state.
- Fixed keyboard pitch-stick direction: Arrow Up moves the virtual pitch stick upward; Arrow Down moves it downward.
- Keyboard pitch/roll commands are momentary instead of accumulating after key release.
- Enlarged the round assembly workstation and increased the 3D canvas area.
- Rebalanced assembly side panels to give the 3D workbench more screen space.
- Optimized wiring, simulator, forms, Python, settings and responsive layouts.
- Added a subtle clickable ZEBJUS watermark advertisement to the 3D workstation and all other tab pages.


## V17.4 bug-fix pass
- Simulator STOP now hard-destroys all continuous simulator oscillators instead of leaving them at a tiny non-zero gain.
- Four individual simulated motor oscillators are also destroyed on STOP.
- Stopped simulator motor mix is forced to zero, so props cannot continue visually spinning from a previously high throttle.
- Leaving the PID Simulator tab stops the simulator and its audio.
- Leaving the 2D Wiring tab stops the BLDC test and its audio.
- Hiding / closing the page stops interactive motor audio.
- Sound Mute destroys all active continuous sound sources immediately.
- Battery disconnect cancels delayed startup tones and delayed spark animation.

### 2D motor wiring
- M1 and M4 now face inward, with U/V/W terminals on the LEFT toward ESC1/ESC4.
- M2 and M3 keep U/V/W on the RIGHT toward ESC2/ESC3.
- This makes all four ESC-to-motor phase connections face each other naturally.
- Pressing F now swaps connector facing only. Text is never mirrored, so labels remain readable.

### Simulator Roll/Pitch
- Roll and Pitch input paths are isolated.
- Roll changes only the Roll target/rate.
- Pitch changes only the Pitch target/rate.
- Three.js attitude order is now YXZ so yaw rotation does not visually exchange Roll/Pitch axes.
- Arrow Up / forward pitch uses the corrected Pitch sign.
- Manual disturbance Pitch sign is matched to the transmitter convention.
- An AXIS MAP indicator was added under the simulator.

### Additional bugs corrected
- 2D BLDC STOP now hard-stops its oscillator instead of leaving a residual hum.
- Recent V17.3 / V17.2 / V17.1 / V17 / V16 saves are included in migration lookup.
- Service-worker cache version bumped to prevent old runtime files from being reused.
