# ZEBJUS V18.3.46 — real kit motor routing and Hardware I/O Studio

- Corrected ESC PWM conversion: firmware now converts 1000–2000 µs pulses to 12-bit ticks for a 250 Hz (4000 µs) period. M1–M4 output mapping can be reassigned among physical D0–D3 connectors, saved in NVS and verified with guarded individual tests. The 2D reference wiring follows the connected kit's map.
- Added configurable PPM rising/falling edge and independent roll, pitch, throttle and yaw reversing. Receiver readings show actual PPM/Web input rates and active channels. CH6 still chooses Rate (inner rate PID directly) or Angle (outer angle PID cascaded into its own inner rate PID).
- Added scan and register-level read/write for multiple I²C addresses, one 50 Hz servo output on an unreserved A2 D7–D10 pin, 9600 baud RX-only GPS NMEA, independent 3.3 V GPIO outputs with explicit pin release, and an HT16K33 8×8 matrix on 0x70–0x77. Pin assignments survive reboot; overlapping servo/GPS/GPIO pins are rejected. Expansion operations and bus scans are blocked while armed or bench motors run.
- Added responsive Hardware I/O Studio in the WebApp and an embedded `/io` page hosted by the same real FC in both AP and STA modes. Both use the existing Device ID and exclusive control lock. Python browser examples and the desktop `ZebjusClient` expose the same commands.
- The Python Lab, camera/OpenCV/MediaPipe bridges, scrollable editor, expanded terminal, resizable image output, joystick keyboard mapping and measured FC rates from V18.3.45 remain available.

**Hardware limits:** These motor and spare-pin controls require the A2/XIAO ESP32-C6 profile. A1/ESP32-C3 is still a sensor/Wi-Fi bridge with no verified ESC pin map. A2 stabilized flight still requires the supported MPU6050 configuration. Generic I²C register access does not automatically implement a device driver; the included matrix driver supports HT16K33, and GPS currently returns raw NMEA rather than navigation control. Servo power must come from an appropriate external supply with a common ground.

**Build and safety:** The archive contains updated source and an automated GitHub build workflow, but no newly compiled firmware binary. Arduino CLI and a physical kit were unavailable here. Compile both profiles, then complete the propellers-removed and restrained checks in `SUPPORT/FLIGHT_VALIDATION_V18_3_46.md` before flight.

Previous release: `RELEASE_NOTES_V18_3_45.md`.
