# ZEBJUS F450 Drone Engineering Lab — V17.2 Branding + PID Hold Simulator

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
