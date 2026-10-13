# V18.3.84 security-remediation candidate — NOT flight approved

This branch updates source for the audit findings; it is not a signed or hardware-qualified release.

## Changed behavior
- The local Node server binds to loopback unless ZEBJUS_BIND_HOST is explicitly set, and refuses non-public repository files.
- AP_WIFI pairing is for network provisioning / read-only status, not physical RC or OTA. Android MOBILE clients require independent OWNER pairing (the label code / PAIR RESET); a known AP Wi-Fi password alone cannot grant physical flight control.
- Web Flight App and Wi-Fi recovery page must be regenerated from tools/embed_ap_pages.py, then offline-manifest.json and release-integrity.json must be resealed.
- OTA now fails closed without a **provisioned publisher public key** at build time (ZEBJUS_OTA_PUBLISHER_PEM), plus a matching signed firmware package and non-rollback version. USB remains the recovery path. Never embed a private signing key in firmware or this repository.
- Firmware updater refuses unsigned imported or bundled OTA packages; USB flashing remains available subject to the usual precautions.
- Browser offline readiness checks cached content hashes and network refreshes cannot silently replace sealed assets.

## Still required before merging / operating hardware
1. CI must generate and verify embedded pages, manifests, compiled firmware for both boards and Android transport tests.
2. Produce a new signed APK matching 18.3.84. The checked-in APK remains 18.3.82 and should not be installed as 18.3.84.
3. Provision and protect a production OTA signing key and matching trusted public key; sign image metadata before enabling Wi-Fi OTA. No signing key is committed here.
4. Audit any user-visible AP instructions that imply automatic OWNER flight access.
5. Complete bench testing with **propellers removed**, then documented A2 hardware, failsafe, sensor orientation, ESC and tethered-flight acceptance.
6. Verify router credentials and secure boot / flash encryption on production boards. Unique WPA credentials remain a separate provisioning/migration task.

## OTA signature format
For signing, hash the UTF-8 message below with SHA-256, then sign with a supported RSA/ECDSA private publisher key:
```
ZFC3-OTA-V1
<BOARD_ID>
<VERSION>
<BYTE_LENGTH>
<LOWERCASE_SHA256>
```
The message ends with a newline. Encode the signature as lowercase hex in the firmware catalog's `latest.app.signature` value. Compile firmware with `ZEBJUS_OTA_PUBLISHER_PEM` set to the corresponding **public** PEM only. Both signatures and current-version comparison are verified inside SecureOta.h.

## Review constraints
No aircraft has been flashed, armed, or flown by this change. Do not merge a source-only remediation as a production flight release.
