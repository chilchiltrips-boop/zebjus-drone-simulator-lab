# ZEBJUS F450 Drone Engineering Lab — V17 PID Learning Simulator

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
