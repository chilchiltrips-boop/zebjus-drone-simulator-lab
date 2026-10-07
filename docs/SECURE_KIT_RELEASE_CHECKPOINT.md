# Secure kit stages 2–4: release checkpoint

Status: **unreleased candidate**. The main branch remains on 18.3.75.
The candidate branch is `codex/secure-kit-stages`; the proposed coordinated
app, web and firmware version is 18.3.78.

Do not install the candidate firmware alongside the released 18.3.75 app/web.
The secure protocol requires a matching app/web implementation. No final
18.3.78 APK or complete release has been published at this checkpoint.

## Stage 2: migration, pairing and permissions

The candidate firmware adds the ZFC3 authenticated transport, per-kit pairing,
scoped sessions and a larger dual-slot flash layout.

- A kit is identified by its full immutable Device ID and its saved display name.
  Names alone are not authorization and can be duplicated in a classroom.
- A random 128-bit pairing code is generated per kit. The firmware stores an SRP
  salt and verifier rather than a plaintext owner code.
- The physical USB pairing label reports Device ID, kit name and pairing code.
  A missed/lost owner code is recovered by the disarmed USB `PAIR RESET` flow;
  firmware must reject reset during physical arming, bench work, OTA or training.
- AP Wi-Fi also uses a separate random per-kit password. The shared
  `12345678` password has been removed from the candidate firmware.
- SRP-6a uses the vendored Espressif implementation, a 3072-bit group and SHA-512.
  ZFC3 is the project's custom framing protocol, not Espressif provisioning
  Security 2 wire compatibility.
- HKDF derives distinct AES-256-GCM keys for HTTP requests, HTTP responses,
  RC packets, RC acknowledgements and monitor telemetry. Each direction has
  a separate counter; authenticated replay windows reject repeats.
- An owner can invite a web companion using a random, short-lived, single-use
  invitation. Companion permissions allow viewing, kit-bound training and
  PID work during the app's inhibited training session. They do not grant
  RC takeover, physical ARM, bench output, Wi-Fi administration or OTA.
- Native Android pairing storage uses Android Keystore encryption. Browser
  pairing secrets are kept in memory, and monitor telemetry must be encrypted.

The last published firmware candidate compiles for A1 and A2. Later local
hardening and encrypted-monitor changes still require a fresh compile.

### Flash migration

The new 4 MiB flash layout has two application slots of 0x1e0000 bytes each:

| Partition | Offset | Size |
|---|---|---|
| NVS | 0x9000 | 0x5000 |
| OTA data | 0xe000 | 0x2000 |
| App 0 | 0x10000 | 0x1e0000 |
| App 1 | 0x1f0000 | 0x1e0000 |
| SPIFFS | 0x3d0000 | 0x30000 |

The first upgrade from the old layout requires a **USB FACTORY image**.
An APP/OTA image cannot migrate the partition table. The updater must inspect
the actual running layout and reject Wi-Fi OTA until migration is complete.

Before factory migration, export/review non-secret kit settings. Factory erase
also removes NVS settings: reconnect Wi-Fi, pair again and restore reviewed
settings while disarmed. Do not import old ownership tokens or pairing secrets.

## Stage 3: kit-required training and concurrent PID save

| Connection | Intended policy |
|---|---|
| AP, normal session | Owner joystick and emergency STOP |
| AP, explicit disarmed maintenance | Limited Wi-Fi setup/test to join a router |
| STA, same local router | Paired RC, training, telemetry, permitted PID/configuration and OTA |
| Public WAN/cloud relay | No real-time physical RC route |

A laptop, Android app and FC may share a router that has internet access.
Their control traffic stays on that local network. Internet access by itself
does not remove radio loss, client isolation, input stalls or stale telemetry.

Training requires a fresh authenticated kit connection and an active matching
training destination/run. Losing the kit pauses/stops training. During virtual
training, physical motor output remains inhibited.

The app keeps its RC lease while the permitted web companion edits PID gains.
PID writes carry a revision to detect conflicting changes. Firmware applies
pending gains at the FC task boundary and persists a complete revisioned record
through a bounded worker. The client reports success only after the saved
revision is confirmed.

The new diagnostics showed fresh native UDP acknowledgements at the same time
as HTTP telemetry timeouts, followed by an app input-stop event. The local app
change delivers stick input directly to the native stream and promotes only
validated fresh native acknowledgements for liveness. It does not extend
physical RC safety timeouts.

## Stage 4: FC PID in virtual training

The advanced mode is supported on A2. A1 continues to use the web training
engine and must advertise that FC PID mode is unavailable.

The laptop supplies virtual attitude/rate samples for the exact paired kit and
training run. An isolated FC virtual engine uses the same PID equations and
gains as physical flight, then returns virtual motor values. The laptop uses
those values in its virtual physics rather than applying a second PID loop.

The virtual engine has no physical motor-write interface. Sensor/RC staleness,
run changes, loss of ownership or missing output inhibition stop virtual
arming/output. A fresh manual virtual ARM cycle is required after a fault.
Live gain updates reset virtual PID integrators while retaining a valid virtual
arming state within the same active run.

## Verification evidence and remaining release gates

[Candidate firmware build](https://github.com/chilchiltrips-boop/zebjus-drone-simulator-lab/actions/runs/37601054624)
passed for both board profiles:

| Profile | Compiled application size | Slot utilization |
|---|---:|---:|
| A1 | 1,280,943 bytes | 65% |
| A2 | 1,371,650 bytes | 69% |

These sizes are for candidate commit
`4f2d34d420204d1522cc1772082f2a1cc02fc6ef`, before the last local monitor
and crypto hardening changes.

Local checks completed before the workspace outage included browser-client
SRP against the actual vendored C server, wrong-code rejection, AEAD tamper
and replay rejection, native JCA/browser crypto interoperability, permissions,
virtual PID direction/stale/run/revision behavior, RC monitor parsing,
ownership, connection stability, USB recovery, updater migration guard and
flight-training core lessons.

Remaining mandatory release gates:

1. Recover the local working tree and publish the final app/web/Android changes.
2. Remove the recursive raw-transport call in the draft browser fixture and run
   the complete paired app/web workflow test.
3. Recompile the final A1/A2 firmware, including encrypted monitor telemetry.
4. Rebuild the signed 18.3.78 APK and verify its matching packaged web assets.
5. Verify release metadata, hashes, migration checks, embedded pages and offline
   assets; publish the matching firmware/APK/web set together.
6. Perform actual kit/router/Android tests: pairing two classroom kits, companion
   scope and cross-kit denial, AP/STA transitions, simultaneous PID persistence,
   virtual engine output inhibition, watchdog behavior and USB recovery.

No actual FC, motor, USB flash or physical flight test has been performed here.
The logs do not prove that the FC is overloaded; real radio conditions and FC
timing need hardware verification.

## Workspace interruption

The build workspace became inaccessible with:
`Environment is not connected`.

Repeated shell and artifact-materialization attempts could not access the local
working tree. GitHub remained reachable, so this checkpoint records the verified
candidate and the outstanding work. Main was deliberately not promoted to a
mismatched app/web/firmware release.
