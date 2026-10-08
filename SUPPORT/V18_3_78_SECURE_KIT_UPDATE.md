# V18.3.78 — paired kit, app and web update

Install the matching **18.3.78-android.2 APK**, web app and A1/A2 firmware together.
VersionCode: **1837802**. The existing development signing certificate is retained.
18.3.75 and older clients cannot control the new secure firmware.

## First migration and kit labels

1. Export the kit's non-secret settings/snapshot before migration. Keep a reviewed copy of PID, receiver mapping and calibration values. Do not copy ownership tokens or pairing credentials into a restore file.
2. Choose the actual board: **A1 = ESP32-C3 bridge**, **A2 = ESP32-C6 / Aerion F1 flight core**.
3. Connect USB and use the matching **FACTORY** image with Upgrade & Erase. The first migration must write the new partition table; APP-only OTA cannot do this. Both new OTA slots are 1,966,080 bytes. USB flash ID/chip/capacity verification must pass before erase/write.
4. Factory migration removes NVS settings. Open a USB serial monitor at **115200 baud**, reset the disarmed kit and read its AP SSID/password. The AP password is random per kit.
5. The first boot prints `PAIR LABEL: Device ID / Kit Name / pairing code`. If that first label was missed, type **PAIR RESET** in the serial monitor while the kit is disarmed, with training/bench/OTA stopped. It creates a fresh label and invalidates earlier sessions. Label/reset commands are physical USB operations; owner codes are not exposed by public Wi-Fi APIs.
6. Install the APK, join the kit AP using its label password, and pair using the displayed name, full Device ID and 32-character owner code. Use Wi-Fi maintenance to test/save the router network. Join that same router on phone and laptop, reconnect, then restore reviewed settings while disarmed.
7. Later Wi-Fi upgrades use authenticated, encrypted APP chunks with board, offset, size and SHA-256 checks. An old partition layout is refused and requires USB FACTORY migration.

## School/college lab pairing

Names help find a kit; the full immutable 48-bit Device ID is always the identity.
New automatic names include the full MAC. A duplicate name never permits a different
kit to inherit control, PID or a training run.

Pair the owner Android app using the physical kit code. On STA, while disarmed and
holding the app session, open Settings → **Pair laptop for training / PID**.
Enter the `LAB-…:…` invitation in that kit's web pairing dialog. An invitation
expires after 60 seconds and can be used only once. The companion may observe,
use the active inhibited training run and save PID; it cannot acquire control,
ARM real motors, publish RC, run bench outputs, change Wi-Fi or flash firmware.
Settings → **Revoke laptop permissions** ends companion sessions. Sessions also
expire after two hours; pair again while disarmed.

The owner code permits administration when that owner holds control. Give students
companion invitations instead of sharing the kit's owner code.

## Connection policy

| Mode | Available operation |
|---|---|
| AP | Paired owner joystick and emergency STOP |
| AP, explicit disarmed maintenance | Wi-Fi setup/test and router handover |
| STA, same router | Paired real RC, training, telemetry, allowed PID/configuration and OTA |
| WAN/cloud | No physical joystick relay in this release |

Router internet access is optional. App, laptop and FC use the same local network.
Allow devices to communicate; guest/client isolation can prevent discovery and
local traffic. Use the kit's current IP if mDNS is unavailable.

AP selects Real Joystick. Tripod and Flight Training require STA. A1 has no physical
flight outputs/FC PID mode; A2 real flight still requires a ready calibrated IMU,
explicit Take control and manual ARM. STOP/background/hard loss cancel unsafe input;
recovery starts at minimum throttle, disarmed, with a new manual ARM.

## Training and PID save

A live authenticated kit and matching inhibited training run are required for
Tripod/Flight Training, including keyboard and simulator API input. No kit means
no running training. Lost identity/run or stale input pauses/stops the simulation.

Choose Tripod or Flight Training in the app. Open the corresponding laptop page
for that same kit. ARM the virtual drone at minimum throttle in the app; actual
kit motors remain blocked. The web companion retains training/PID permission
while the app retains its RC lease.

PID sliders are drafts. **Save PID** submits validated gains with a revision.
The FC applies a pending revision at the control-loop boundary and saves one
complete NVS record through a bounded worker. Success is shown after persisted
revision readback; competing writes or physical armed saves are rejected.

A2 offers **Kit PID · advanced training**. The laptop sends bounded virtual
attitude/rate samples; the FC runs its own PID with isolated integrators and
returns virtual motor values. Laptop physics uses those values without a second
PID loop. Physical GPIO/ESC output stays inhibited. Fresh samples, exact run,
output inhibition and motor bounds are checked; repeated frozen outputs expire.
A1 supports the laptop engine with a paired kit but does not offer FC PID.

## Verification boundary

Automated checks cover real vendored SRP C/browser interoperability, firmware
mbedTLS/browser and native Java AES-GCM interoperability, tampering/replay/wrong
kit/invitation rejection, scoped permissions, training run/staleness, PID revision,
physical PWM inhibition, roll direction, USB preflight/MD5 guards, AP/STA policy,
and packaged app/web workflows. UI-only routing tests use explicit authenticated
transport doubles; separate pairing tests exercise the actual encrypted client.

A real Android phone/router/FC, physical USB flash, ESC/motor and flight test have
not been performed here. Keep both app and web diagnostic exports from the first
kit test to assess radio loss and FC timing.

## മലയാളം — ചെയ്യേണ്ട ക്രമം

**ആദ്യം settings backup → ശരിയായ board-ന്റെ USB FACTORY flash → serial label/code
എടുക്കുക → പുതിയ APK install → AP password ഉപയോഗിച്ച് pair → router Wi-Fi save/test
→ phone/laptop/kit ഒരേ router-ൽ connect → app invitation ഉപയോഗിച്ച് laptop pair.**
Training-ൽ app joystick control നിലനിർത്തും; laptop-ൽ PID save ചെയ്യാം. Advanced
Kit PID A2-യിൽ ലഭ്യമാണ്. പഴയ APK ഉപയോഗിച്ച് പുതിയ firmware control ചെയ്യാനാവില്ല.

## Exclusive mobile session revision 2

App native RC publishes at 50 Hz. While the app transmits, HTTP telemetry/status
polling is suspended. The laptop uses one authenticated monitor at 10 Hz with
1/2/4/8-second reconnect backoff; no fast fallback telemetry or background
health/discovery/ownership pings run while MOBILE owns the session. Web takeover
is refused while mobile training or a native publisher is active.

An authenticated inhibited simulation neutralizes virtual input after a 300 ms
ACK gap, holds the same run/grant for up to 8 seconds, and requires manual virtual
ARM after recovery. Firmware retains its run for 10 seconds. STOP, background,
identity/run changes and hard expiry still fence the session. Real-flight ACK
and motor failsafes retain their original bounds.

Explicit PID saves are still allowed. Advanced FC PID requires a bounded
virtual-sensor exchange (at most 10 Hz, one request in flight); this purposeful
exchange is separate from suspended background telemetry polling.
