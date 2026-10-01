# ZEBJUS V18.3.58 — upload batches

ഈ ZIP extract ചെയ്യുക. **ZIP GitHub-ലേക്ക് upload ചെയ്യരുത്.**

1. Repository root-ൽ Add file → Upload files തുറക്കുക.
2. `UPLOAD_01` folder-ന്റെ **ഉള്ളിലെ files/folders** select ചെയ്ത് drag ചെയ്യുക. `UPLOAD_01` folder തന്നെ upload ചെയ്യരുത്.
3. Commit പൂർത്തിയായശേഷം `UPLOAD_02` മുതൽ അതേ രീതിയിൽ ഓരോ batch വീതം upload ചെയ്യുക. എല്ലാം repository root-ലേക്കാണ്.
4. `vendor` folder-ന്റെ ഉള്ളിൽ upload ചെയ്യരുത്: അങ്ങനെ ചെയ്താൽ `vendor/vendor` path വരാം. Existing files replace ചെയ്യുക.
5. എല്ലാ 11 batches upload ചെയ്തശേഷം മാത്രമാണ് project complete. Outer `READ_FIRST.md`, inventory, manifest, assembly helper എന്നിവ upload ചെയ്യേണ്ടതില്ല.

ഓരോ batch-ലും പരമാവധി 100 files, 14.5 MB raw data മാത്രം. ഓരോ original path-ഉം ഒരു batch-ൽ മാത്രമാണ്. Vendor files split ചെയ്തിട്ടില്ല; folders വിവിധ batches-ൽ merge ചെയ്യപ്പെടും. `BATCH_INVENTORY.csv`-ൽ counts/size ഉണ്ട്.

Local offline use: install ചെയ്ത Python ഉപയോഗിച്ച് `python assemble_project.py` അല്ലെങ്കിൽ `python3 assemble_project.py` run ചെയ്യുക. Hash verify ചെയ്ത complete project `ZEBJUS_Local` folder-ൽ ലഭിക്കും. അതിലെ `Start_Offline.bat`, `Start_Offline.command` അല്ലെങ്കിൽ `python3 start_offline.py` ഉപയോഗിക്കുക.

Compiled A1/A2 APP/FACTORY `.bin` files ഉൾപ്പെടുത്തിയിട്ടുണ്ട്. Update guide: assembled project-ലെ `SUPPORT/V18_3_58_UPDATE_AND_TEST.md`. Physical USB/OTA, radio and flight checks pending ആണ്; automated browser/transport checks pass ആയി.
