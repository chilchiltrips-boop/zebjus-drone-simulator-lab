# ZEBJUS Aerion — GitHub snapshot audit / V18.3.61 R3

Reviewed: `zebjus-drone-simulator-lab-main(7).zip`, provided on 2026-10-02.
Original ZIP SHA256: `9065361abde707120373e1ecb4b2169574ff66e96d15dfea0657a3c93bfca72d`.

## Result from the uploaded snapshot

The supplied GitHub snapshot contains the complete R2 runtime. None of the 231 offline-runtime inventory entries was missing or had a wrong hash. Every expected R2 project path from its uploaded manifest was present except `android-app/.gitignore`; all present R2 paths matched their recorded hashes. This snapshot does not show a partially uploaded R2 runtime.

Actual files: **388**. Declared `FILE_COUNT.txt`: **379**. The difference consists of **10 extras and one missing hidden file**. The initial full validation failed only on that inventory mismatch. Runtime control tests, reconnect tests, output cleanup tests, setup retry tests and flight-math tests passed.

## Confirmed findings and fixes

| Finding | Effect | R3 correction |
|---|---|---|
| Packaging wrappers copied into repository root | Wrong count; conflicting instructions from older releases | Cleanup removes the eight known wrapper files below |
| Previous V18.3.60 APK still present | Android artifact wildcard can offer two versions | Remove old APK; current APK is selected explicitly |
| Unused `thumb_fcStandoff.png` left behind | Obsolete inventory entry | Remove this known obsolete thumbnail |
| Missing `android-app/.gitignore` | Local build output can enter uploads/commits | Restore ignore file; add root ignore rules |
| Validator, cleanup and packer used different exclusions | Generated Python/Node/Android outputs can change counts | Shared inventory excludes these generated paths consistently |
| Each batch can become a main commit | Live users can receive mixed files between commits | Upload to a staging branch, then merge one complete PR |
| Automatic workflows accepted any push branch | Partial staging uploads could start expensive builds | Automatic firmware/Android push builds now watch main |
| Firmware publish step targeted main without a branch condition | A manual run on another branch could enter publication logic | Publish step is main-only |
| Build had no complete-release fingerprint | A partial/mixed tree could compile or reach publication | Release-integrity check before dependencies and on current main before publishing |
| Current upload guides stated compiled images were absent | Misleading instructions and uncertainty about old timestamps | Current guides describe included APP/FACTORY images and the current APK |

The eight wrapper files are `BATCH_INVENTORY.csv`, `READ_FIRST.md`, `assemble_project.py`, `UPLOAD_MANIFEST.json`, `UPLOAD_INVENTORY.json`, `UPLOAD_03_INVENTORY.json`, `UPLOAD_03_GUIDE.md`, and `UPLOAD_GUIDE.md`. These are outer packaging helpers. R3's **`release-integrity.json` is different: it belongs in the project and must be uploaded**.

Cleanup targets this explicit list; other historical release notes and user files are preserved. On GitHub the cleanup deletions are committed with the next successful main firmware publication. Local cleanup requires no toolchain download: `python3 -B tools/cleanup_repo.py`.

## Batch upload timing

Waiting between batches does not change or corrupt the files already committed. The risk is the **intermediate repository state**. If GitHub Pages publishes from main, each source-branch push can publish that intermediate state; a browser can fetch different files from different upload commits. Dependency-triggering commits can also start builds before later batches are present.

Use `upload-v18-3-61-r3`, created from main. Upload every batch to that same branch, retaining root-relative paths. Commit the final batch last, open one PR to main, wait for **Verify complete upload**, and merge once. Keep Pages publishing from main rather than the temporary upload branch. This is the procedure to avoid exposing partial files during a long upload.

The release-integrity check verifies all expected bytes, missing paths and unexpected project files. It detects missing later batches, wrong bytes even with the same size, accidentally uploaded wrappers, and missing hidden files. It is a consistency check, not a cryptographic signature/authentication system. Intentional source changes need `npm run release:seal` before committing their new release fingerprint.

## Firmware and APK

| Package | Result |
|---|---|
| ZFC-A1 APP / FACTORY | Catalog sizes/hashes, ESP chip header, version and factory/APP agreement verified |
| ZFC-A2 APP / FACTORY | Catalog sizes/hashes, ESP chip header, version and factory/APP agreement verified |
| A2 APP size / OTA slot | 1,303,088 / 1,310,720 bytes; 7,632 bytes remain |
| Current Android APK | V18.3.61, 57,964 bytes; APK ZIP valid; both packaged assets exactly match source |
| APK SHA256 | `39dc2d0fa7eb3fd344c13f156b17754df06a2291cd8369dd9da9886dc02d4910` |

The recorded firmware build time is 2026-10-01T20:31:26Z. R2/R3 do not change firmware source or the APK runtime, so this date alone does not mean the images are wrong. R3 preserves all four verified binaries and the current APK byte-for-byte. No new firmware compilation or Android SDK build was needed for the tooling corrections.

## Verification performed

- Full project JSON/JavaScript/file-reference validation and every offline inventory/provenance hash.
- Arduino setup transient-error recovery, bounded persistent failure, compiler errors without retry, install-only preserving firmware.
- Seven upload-integrity tests: complete tree, missing later batch, wrong bytes at the same size, unexpected wrapper, generated-output exclusions, intentional release refresh, first-manifest count.
- Native dropdown Simulator/Real selection, other controls remaining clickable, small throttle accumulation, held thumb position, release hold, keyboard SAFE, Tripod, page-exit cancellation, two simultaneous touch pointers, header layouts at 1374/1024/760/390 pixels.
- Mobile ownership and laptop view-only mirroring; target selection does not steal ownership or disarm the phone; armed configuration guards, backup identity, saved Wi-Fi and CSV columns.
- Real-target camera/hand RPC with synthetic hand landmarks and kit HTTP; stale hands stop control; camera cleanup, refresh, AP/STA reconnect, wrong-device rejection and no automatic Python/flight restart.
- Internet-blocked Python/OpenCV/NumPy/Pillow/pandas/Matplotlib and local hand-model inference; complete browser cache, server-stopped reload, Stop/rerun and incomplete-cache detection.
- Standalone/embedded Flight App controls, refresh/link-loss/identity handling and offline operation.
- Actual native Java lease/lifecycle/pending-grant/stale-reply/ACK-watchdog/local-policy tests; flight-math C++ tests.
- Python source syntax, APK/source asset equality, workflow YAML and shell syntax, upload package hashes and 100-file limits.

Browser checks used headless Chromium with software graphics. One UI assertion failed with several graphics-heavy browser suites running concurrently; the full UI suite passed when run alone. This does not establish physical performance under load, so actual phone/browser/radio timing remains unmeasured.

## Limits of this audit

This is an audit of the supplied ZIP, not a read of live GitHub Actions logs or Pages settings. Actual Actions execution, a fresh core install/build, USB/OTA flashing, phone lock/incoming call and flight/sensor/load timing were not performed. Synthetic device/hand fixtures prove software flows; they do not certify real flight behavior. The download server can still fail after retries during a persistent upstream outage.

## Sources for GitHub behavior

- [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Workflow triggers and branch/path filters](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
