# Staged kit releases

## Stage 1 — 18.3.75

Take Control accepts the verified FC grant immediately. Later telemetry reconciles ownership without allowing older replies or public monitor packets to overwrite a newer grant. Disconnect fences in-flight grants. Lease renewal and physical RC watchdogs remain separate.

Both connection screens show the unique Kit Name. An IP is a discovery hint; the saved full Device ID remains the reconnect identity. New factory kits default to `zebjus_drone_<full MAC>`. Existing names remain. Duplicate live names must be renamed or explicitly selected by Device ID. Name and identity checks are not encryption.

Flash diagnostics include chip, stub state, flash ID, capacity and whether a write started. Invalid flash IDs still block every erase/write. A USB hardware fault cannot be repaired by suppressing this guard.

18.3.75 app and web retain 18.3.74 controller compatibility. Flash matching 18.3.75 firmware to get the full-name factory default and previous idle HTTP connection recovery. The APK uses the existing development certificate. No phone or physical flight controller was available for hardware verification.

## Stage 2 — security and migration gate

Before publishing security changes, build both A1/C3 and A2/C6 and record APP bytes, both OTA slot sizes and free heap. Current A2 18.3.74 has only 2,240 bytes of OTA headroom. A larger partition layout requires a verified USB factory migration, backup and restore of non-secret settings, and explicit refusal of oversized APP-only OTA. Keep Wi-Fi enrollment accessible through AP maintenance.

Use Espressif Security 2 (SRP6a and AES-GCM, patched IV counters) or another reviewed authenticated protocol. Use a unique enrollment credential per kit, never a shared product password. The kit's Device ID and Kit Name are included in authenticated session scope. A paired phone can issue an expiring companion invitation with telemetry/training/PID scopes. The companion cannot ARM, transmit joystick frames or take over the phone lease. Native UDP and ACKs need their own authenticated encryption, direction-specific nonces and replay checks; provisioning encryption alone does not secure RC.

Publish a new APK with the security protocol and secure credential storage. Test wrong-kit, expired invitation, tampering, duplicate sequence, background/resume, STOP and IP changes across app, web and firmware. Do not advertise secure pairing before these paths interoperate.

## Stage 3 — kit-required training and PID

Gate every simulator start and input route, including keyboard/API callbacks, on a live paired kit and matching run. Virtual training inhibits physical outputs and can run without a ready IMU. Real flight requires calibrated sensors, healthy FC loop, explicit mode selection and manual ARM.

Allow the paired companion to save validated PID drafts while the phone retains the joystick lease. Use a bounded staged apply, revision and persistent readback; do not set global configurationBusy for an ordinary virtual-training PID save. Slider changes stay previews. Saves must not stop native RC ACKs. Reject conflicting revisions and all physical armed saves.

Ordinary AP operation exposes joystick and STOP. Wi-Fi setup, firmware and recovery remain in a separate maintenance path so switching to STA is possible. STA on the same router permits training, telemetry and configuration. Local control does not depend on internet availability; WAN/cloud joystick flying is outside this release.

## Stage 4 — advanced FC PID training

Keep web physics, send bounded virtual sensor samples to the FC, run its own PID and return virtual motor outputs. Use a distinct capability/version and run-bound sequence protocol. Physical outputs stay inhibited even on stale input, mode changes and reset. Verify timing and loop isolation on both boards before release. Simulator results alone do not validate real-flight gains.

## Required hardware acceptance between stages

1. A Take Control grant followed by a status timeout still renews the same lease.
2. Two kits on one router cannot exchange control, training or PID requests.
3. Run phone RC and laptop Tripod for 15 minutes; export both diagnostics by Device ID.
4. STOP, background, router loss and wrong IP produce neutral/manual ARM recovery.
5. Test USB probe and write/readback with an electrically isolated board.
6. For later stages, complete the security, migration and simultaneous PID checks above before promoting the release.
