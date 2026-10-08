# Staged kit releases — V18.3.78

Stages 2–4 are implemented in the coordinated 18.3.78 app, web and firmware source.

| Stage | Implementation |
|---|---|
| 1 | Take Control/ownership sync, stale handling, flash diagnostics and unique-name identity |
| 2 | Larger dual-slot migration, per-kit encrypted pairing, scoped sessions and app invitations |
| 3 | Kit-required training, revisioned concurrent PID save, AP/STA policy |
| 4 | A2 isolated actual FC PID with virtual sensor/motor bridge and physical output inhibition |

Follow the [migration, pairing and training guide](V18_3_78_SECURE_KIT_UPDATE.md).
All three clients/components must match. Native transport/security changes require
the new APK; updating web files does not update an installed phone or running FC.

Automated build/protocol/host/browser checks are recorded with the release.
Physical Android/router/FC/USB/motor/flight acceptance has not been performed.
A1 supports paired laptop training; advanced FC PID and real flight require A2.
