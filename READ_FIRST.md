# ZEBJUS Aerion V18.3.61 R2 — 4 upload batches

ഈ ZIP extract ചെയ്യുക. ZIP GitHub-ലേക്ക് upload ചെയ്യരുത്.

R2: firmware build retries/cache, Aerion header, throttle drag/precision and target selection fixes ഉൾപ്പെടുന്നു. Existing complete V18.3.61 repository-ക്ക് ചെറിയ `ZEBJUS_V18_3_61_R2_FIXES.zip` മാത്രം upload ചെയ്താൽ മതി (17 files; 1 batch). This full bundle retains verified V18.3.61 firmware/APK bytes.

1. Repository root → Add file → Upload files.
2. `UPLOAD_01`-ന്റെ **ഉള്ളിലെ files/folders** drag ചെയ്യുക. `UPLOAD_01` folder തന്നെ upload ചെയ്യരുത്.
3. Commit കഴിഞ്ഞ് ബാക്കിയുള്ള batches ക്രമത്തിൽ upload ചെയ്യുക. എല്ലാം repository root-ലേക്കാണ്.
4. `vendor`-ന്റെ അകത്ത് upload ചെയ്യരുത്; `vendor/vendor` path ഉണ്ടാകരുത്. Existing paths replace ചെയ്യുക.
5. അവസാന batch-ൽ firmware/APK/workflow inputs ഉണ്ട്. അതിനു മുമ്പ് എല്ലാ batches-ഉം upload ചെയ്യണം. macOS-ൽ hidden `.github` കാണാൻ Cmd+Shift+. ഉപയോഗിക്കുക.

ഓരോ batch-ലും പരമാവധി 100 files. ഓരോ file-ഉം 25 MiB-യിൽ താഴെ. Files split ചെയ്തിട്ടില്ല. Inventory-യിലെ batch bytes ആകെ വലുപ്പമാണ്; single-file limit അല്ല. 379 files-ന് 4 ആണ് ഏറ്റവും കുറഞ്ഞ batch എണ്ണം.

Wrapper `READ_FIRST.md`, inventory, manifest, assembly helper എന്നിവ repository-ലേക്ക് upload ചെയ്യേണ്ടതില്ല.
Local use: `python3 assemble_project.py` (Windows: `python assemble_project.py`). Hash verified project `ZEBJUS_Local`-ൽ ലഭിക്കും. അതിലെ offline launcher ഉപയോഗിക്കുക.
APK: `android-app/dist/`. A1/A2 APP + FACTORY binaries: `FlightCore_Firmware/`.
AP password: **12345678**. Guide: `SUPPORT/V18_3_61_UPDATE_AND_TEST.md`.
Real-phone, USB/OTA, sensor voltage and loaded 250 Hz measurements are pending.
