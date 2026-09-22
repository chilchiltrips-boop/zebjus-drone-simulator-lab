ZEBJUS V18.3.23 - GITHUB DRAG & DROP READY

1. Open this folder: UPLOAD_CONTENTS_TO_GITHUB_ROOT
2. On Mac press Cmd + Shift + .  (this makes the hidden .github folder visible)
3. Press Cmd + A
4. Drag ALL selected files/folders into the ROOT of your GitHub repository.
5. Commit the upload.

IMPORTANT:
- Do NOT upload the outer UPLOAD_CONTENTS_TO_GITHUB_ROOT folder itself.
- .github/workflows/build-flightcore-a1.yml MUST exist in GitHub.
- tools/build_firmware.py MUST exist.
- FlightCore_Firmware/ZEBJUS_FLIGHTCORE_V18_3_23.ino MUST exist.

After upload:
GitHub -> Actions -> Build ZEBJUS FlightCore A1 Firmware

The workflow will compile the REAL ESP32-C3 application binary:
FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_V18_3_23_APP.bin
