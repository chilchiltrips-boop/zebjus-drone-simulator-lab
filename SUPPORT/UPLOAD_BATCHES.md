# ZEBJUS Aerion V18.3.61 R3 — GitHub upload

Batch upload ചെയ്യാൻ എടുക്കുന്ന സമയം files corrupt ചെയ്യില്ല. എന്നാൽ live `main` branch-ൽ ഓരോ batch-ഉം commit ചെയ്താൽ, ഇടവേളയിൽ പഴയ/new files ഒരുമിച്ച് publish ആകാം. അതിനാൽ:

1. `main`-ൽ നിന്ന് **upload-v18-3-61-r3** എന്ന branch create ചെയ്യുക. Pages publishing source `main` ആയി നിലനിർത്തുക.
2. എല്ലാ batches-ന്റെയും **ഉള്ളിലെ files/folders** അതേ branch-ന്റെ repository root-ൽ upload ചെയ്ത് commit ചെയ്യുക. `UPLOAD_01` folder/ZIP തന്നെ upload ചെയ്യരുത്.
3. macOS-ൽ **Cmd+Shift+.** ഉപയോഗിച്ച് `.github`, `.gitignore`, `android-app/.gitignore` കാണിക്കുക. Folder paths നിലനിർത്തുക; `vendor/vendor` ഉണ്ടാകരുത്.
4. അവസാന batch-ൽ `release-integrity.json` completion marker ഉണ്ട്. ഇത് project file ആണ്; upload ചെയ്യണം. Outer `UPLOAD_MANIFEST.json`, `READ_FIRST.md`, `BATCH_INVENTORY.csv`, `assemble_project.py` wrapper files upload ചെയ്യരുത്.
5. എല്ലാ batches-ഉം കഴിഞ്ഞ് upload branch → `main` Pull Request create ചെയ്യുക. **Verify complete upload** check pass ആയശേഷം merge ചെയ്യുക. Partial upload-ൽ ഈ check fail ആകുന്നതാണ് ശരിയായ behavior.
6. Merge കഴിഞ്ഞ് firmware workflow automatically runs. മറ്റൊരു branch-ൽ manual run ചെയ്താലും അത് `main`-ലേക്ക് binaries publish ചെയ്യില്ല. Current main upload incomplete ആണെങ്കിൽ older build അതിനെ overwrite ചെയ്യില്ല.

Source edits intentional ആണെങ്കിൽ local project-ൽ `npm run release:seal` നടത്തി `release-integrity.json`, `FILE_COUNT.txt`, `offline-manifest.json` കൂടി commit ചെയ്യുക. `npm run release:check` / `npm run check` പരിശോധിക്കുക.

Current verified A1/A2 **APP + FACTORY `.bin` files** `FlightCore_Firmware/`-ൽ ഉൾപ്പെടുത്തിയിട്ടുണ്ട്. Current Android APK: `android-app/dist/ZEBJUS_Aerion_V18_3_61_Android.apk`. R3 changes build/inventory/upload tooling; firmware/APK and runtime bytes are unchanged, so a new flash/APK install is not required for these corrections.

Arduino core **3.3.12** remains pinned. Temporary download failures have four attempts with 10/20/40-second backoff; completed downloads are cached. A persistent upstream server outage can still fail setup.

Full source uses the minimum number of batches (100 files maximum each). Patch ZIP, when supplied, needs only one batch on an existing complete R2 repository. Known obsolete upload wrappers and the previous APK are removed by `tools/cleanup_repo.py`; this cleanup is committed by the next successful main firmware publication. To normalize locally without downloading a toolchain: `python3 -B tools/cleanup_repo.py`.

Physical phone/radio/flight, USB/OTA flashing and loaded 250 Hz timing require real-hardware validation. GitHub Actions execution/Pages settings were not inspected directly in this ZIP audit.
