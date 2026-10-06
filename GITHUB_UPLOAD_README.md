# ZEBJUS Aerion V18.3.73 — GitHub upload

Batch upload ചെയ്യാൻ സമയം എടുക്കുന്നത് files corrupt ചെയ്യില്ല. Partial files live main-ൽ mix ആകാതിരിക്കാൻ:

1. main-ൽ നിന്ന് **upload-v18-3-64** branch create ചെയ്യുക. Pages source main ആയി നിലനിർത്തുക.
2. ഓരോ UPLOAD batch-ന്റെയും **ഉള്ളിലെ files/folders** അതേ branch-ന്റെ repository root-ൽ upload ചെയ്യുക. Batch folder/ZIP തന്നെ upload ചെയ്യരുത്. Folder paths നിലനിർത്തുക; vendor/vendor ഉണ്ടാകരുത്.
3. macOS: Cmd+Shift+. ഉപയോഗിച്ച് `.github`, `.gitignore` കാണിക്കുക.
4. Final batch includes **tools/cleanup_repo.py, tools/project_files.py, tools/release_integrity.py, release-integrity.json** with workflows, firmware and APK. ഇവ ഒരുമിച്ച് upload ചെയ്യണം. Outer wrapper README/inventory/assembly helper upload ചെയ്യരുത്.
5. എല്ലാ batches-ഉം കഴിഞ്ഞ് PR → main; **Verify complete upload** pass ആയശേഷം merge ചെയ്യുക. Partial upload check fail ആകുന്നത് ശരിയാണ്.

## Missing release_integrity.py

Android workflow runs from android-app, so **../tools/release_integrity.py is correct**. The error means `tools/release_integrity.py` is absent in that commit. Keep the check; upload the helper files and completion manifest. The new workflow reports Incomplete upload before downloads. Python-invoked scripts do not need an executable file bit.

The full release has the minimum four batches (<=100 files each), with no split files and each individual file below 25 MiB. A supplied one-batch update includes the prior R3 helper changes and current runtime/BIN/APK changes, and requires the other unchanged project files to be complete. If integrity finds missing/mixed files, use all four full batches; do not reseal an incomplete upload to hide it.

Known obsolete browser AP pages, older APKs and accidentally uploaded wrappers are removed by **python3 -B tools/cleanup_repo.py** before integrity checking. Main firmware publication commits those deletions. Intentional development edits need `npm run release:seal`, `npm run release:check`, `npm run check` and updated manifests.

**Install the new APK and flash the matching firmware** after upload. APK: android-app/dist/ZEBJUS_Aerion_V18_3_73_Android.apk. A1/A2 APP + FACTORY images: FlightCore_Firmware. AP password is 12345678; open the installed app/local WebApp, because firmware AP has no browser pages.

Arduino core 3.3.12 is pinned, with bounded dependency retries and cache reuse. A persistent upstream outage can still fail setup. Local compilation/tests do not establish a successful remote GitHub job or physical phone/kit/USB/OTA performance.
