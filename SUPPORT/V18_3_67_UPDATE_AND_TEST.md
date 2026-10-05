# Aerion 18.3.67 update and test guide

## Install

1. Install `android-app/dist/ZEBJUS_Aerion_V18_3_67_Android.apk` over the existing development app. Version: 18.3.67-android.2; versionCode: 1836702. The signing certificate is unchanged.
2. Flash the matching firmware once: A1 APP.bin for ESP32-C3, or A2 APP.bin for Aerion F1 / XIAO ESP32-C6. Use APP.bin for Wi-Fi OTA; FACTORY.bin is for USB factory flashing. Stop app control before flashing from the web Firmware page.
3. Reload the updated web lab. In AP mode without internet, use the offline launcher or a previously saved offline web lab. Firmware AP exposes its local API and does not serve the lab page.

## Flight controller setup

Start with the correct A2 kit and all propellers removed. Detect board waits for the active session grant before polling; an actual lost session still stops outputs and requires a fresh start.

For PWM ESC calibration, tick the three checks with the battery disconnected. Click Start HIGH, connect the battery, then click Stop / LOW at the ESC's calibration tone prompt. Wait for LOW to finish and confirm the successful tones. After successful calibration the battery may stay connected for motor tests. **Calibrate ESC again** starts a fresh attempt and requires the battery-disconnected check again before HIGH.

Connect motor power for Motor idle and Rotation. Start/Stop sends real PWM to the selected motor(s), with each test bounded to two seconds. Motor start and direction are pilot observations; the software does not measure RPM or identify an ESC's beep pattern.

App/Web receiver only saves the input source. PPM defaults to transmitter mode 2; modes 1–4 select the displayed stick arrangement. Move throttle, roll, pitch and yaw one at a time until each actual channel is detected. The remaining four roles are optional. Centre roll/pitch/yaw, put throttle at minimum and ARM OFF, then capture. Sweep assigned controls through their full travel; green sticks follow received PPM and the yellow guide indicates the current control. Save verifies mapping, measured travel, mode, reversal and ARM choice. Then choose ARM/failsafe behavior. Current/default PID is retained; tune separately in Hardware I/O.

Completed steps keep Next after Back. **Skip / Next** leaves pending checks red in Telemetry, including failed checks; four PPM axes must be detected before skipping the receiver section. This does not mark calibration successful or bypass the firmware's arming rules.

Python examples expose `SERVO_PIN`, `GPS_RX_PIN` and `GPS_TX_PIN`. HT16K33 uses fixed board I²C pins; choose `MATRIX_DRIVER="MAX7219"` for explicit `DIN_PIN`, `CLK_PIN` and `CS_PIN` on three free D7–D10 pins. Read `pinmap_get` to check current allocations before selecting pins.

## Virtual practice

1. Connect phone and web-lab computer to the same verified kit AP/router.
2. In the app, tap **Tripod** or **Flight Training**. Controls turn ON at throttle 0%, DISARMED. Both A1 and A2 support simulation without a ready IMU.
3. Open the corresponding web page and tap **ARM** in the app at minimum throttle. Its sticks control the virtual aircraft. The web page follows automatically and may show VIEW ONLY because the app owns control.
4. Physical telemetry must report `armed:false`, `trainingActive:true`, `outputsBlocked:true`. Virtual ARM is separate. Physical ESC pulses stay at their minimum throughout simulation.
5. Switching between Tripod and Flight Training resets throttle and virtual ARM. Only the selected simulator receives the input. Reopening a page after app ARM can join at neutral throttle.

Simulator selection has no propeller checkbox. Output inhibition is enforced in firmware; actual motor/ESC tests keep their safety confirmations.

## Link and STOP

Simulation negotiates HTTP RC ACKs, so a missing native UDP ACK does not prevent training. Accepted RC also renews the inhibition lease. Foreground ACK/network loss stops the old grant and retries the same destination at minimum throttle and DISARM. ARM is never restored automatically. Stale web input pauses/disarms the virtual model; restore neutral DISARM then ARM to resume a retained Flight Training lesson.

STOP, app background, reload, or manual disconnect cancel control recovery. Returning to the app requires explicit control and manual ARM. A delayed frame from a previous simulator run cannot be applied to a newer run or real flight.

## Physical joystick

Choose **Real Joystick**, then **Take control** and manual **ARM**. Physical flight still needs its supported A2 profile, ready IMU and calibration. A1 is a sensor/RC bridge, not a newly enabled physical flight controller. Switching out of simulation resets input and preserves the neutral/manual-ARM guard.

## Verification boundary

Host tests execute the production firmware training command, HTTP RC handler, arming and PWM guards. Java tests execute the native grant policy and real DatagramSocket transport. Browser integration uses the actual bundled Android UI/adapter and web simulators with a simulated kit/radio, including A1/no-IMU simulation, delayed ACKs, safe recovery, mode changes, late page opening, STOP, background and firmware picker/cache handling.

These are software checks. No Android phone/emulator, physical Wi-Fi radio, IMU, ESC or drone was used. Validate connection, reported physical DISARM and motor output inhibition on the actual kit before evaluating physical joystick operation.
