# ZEBJUS Aerion V18.3.61 R3 — 4 upload batches

ഈ ZIP extract ചെയ്യുക. ZIP GitHub-ലേക്ക് upload ചെയ്യരുത്.

1. GitHub branch selector-ൽ **upload-v18-3-61-r3** എന്ന പുതിയ branch `main`-ൽ നിന്ന് create ചെയ്യുക. Live Pages source `main` ആയി നിലനിർത്തുക. ആ പുതിയ branch-ന്റെ repository root → Add file → Upload files.
2. `UPLOAD_01`-ന്റെ **ഉള്ളിലെ files/folders** drag ചെയ്യുക. `UPLOAD_01` folder തന്നെ upload ചെയ്യരുത്.
3. അതേ upload branch-ൽ batches ക്രമത്തിൽ commit ചെയ്യുക. എല്ലാം repository root-ലേക്കാണ്. ഇടവേള എടുത്താലും live main-ൽ files mix ആവില്ല.
4. `vendor`-ന്റെ അകത്ത് upload ചെയ്യരുത്; `vendor/vendor` path ഉണ്ടാകരുത്. Existing paths replace ചെയ്യുക.
5. അവസാന batch-ൽ release-integrity marker, firmware/APK/workflow inputs ഉണ്ട്. macOS-ൽ hidden `.github` / `.gitignore` കാണാൻ Cmd+Shift+. ഉപയോഗിക്കുക.
6. എല്ലാ batches-ഉം commit ചെയ്തശേഷം upload branch → main Pull Request create ചെയ്യുക. **Verify complete upload** check pass ആയശേഷം ഒരു merge നടത്തുക. ഇതിലൂടെ main-ൽ complete files ഒരുമിച്ച് വരും.

ഓരോ batch-ലും പരമാവധി 100 files. ഓരോ file-ഉം 25 MiB-യിൽ താഴെ. Files split ചെയ്തിട്ടില്ല. Inventory-യിലെ batch bytes ആകെ വലുപ്പമാണ്; single-file limit അല്ല. 385 files-ന് 4 ആണ് ഏറ്റവും കുറഞ്ഞ batch എണ്ണം.

Wrapper `READ_FIRST.md`, inventory, manifest, assembly helper എന്നിവ repository-ലേക്ക് upload ചെയ്യേണ്ടതില്ല.
Local use: `python3 assemble_project.py` (Windows: `python assemble_project.py`). Hash verified project `ZEBJUS_Local`-ൽ ലഭിക്കും. അതിലെ offline launcher ഉപയോഗിക്കുക.
Wrapper files accidentally GitHub root-ൽ എത്തിയിട്ടുണ്ടെങ്കിൽ CI cleanup അവ നീക്കും. `release-integrity.json` project-ന്റെ internal completion check ആണ്; അത് upload ചെയ്യണം.
APK: `android-app/dist/`. A1/A2 APP + FACTORY binaries: `FlightCore_Firmware/`.
AP password: **12345678**. Guide: `SUPPORT/V18_3_61_UPDATE_AND_TEST.md`.
Real-phone, USB/OTA, sensor voltage and loaded 250 Hz measurements are pending.
