#!/usr/bin/env python3
"""Package complete repository paths into <=100-file, <15 MB upload folders."""
import argparse
import csv
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT.parent)
    parser.add_argument('--max-files',type=int,default=100)
    parser.add_argument('--max-bytes',type=int,default=14_500_000)
    args=parser.parse_args()
    if not 1<=args.max_files<=100 or not 1<=args.max_bytes<=14_500_000:
        raise SystemExit('Keep limits at <=100 files and <=14,500,000 bytes.')
    version=(ROOT/'VERSION.txt').read_text().strip()
    name='ZEBJUS_V'+version.replace('.','_')+'_UPLOAD_BATCHES'
    destination=args.output.resolve()/name
    if destination.exists():
        raise SystemExit(f'Output already exists: {destination}. Choose an empty output directory.')
    files=sorted(p for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts and '__pycache__' not in p.parts)
    # Upload build-trigger inputs together after ordinary assets. This prevents
    # an early web-upload commit from compiling partly uploaded Android sources
    # or publishing older firmware while the new release is still being staged.
    final_paths={'VERSION.txt','FILE_COUNT.txt','firmware-catalog.json','firmware-latest.json','firmware-updater.js','tools/build_firmware.py','tools/cleanup_repo.py','tools/validate_project.py','tools/make_offline_manifest.py','tools/validate_offline_bundle.py'}
    def final_input(path):
        relative=path.relative_to(ROOT)
        return relative.parts[0] in {'.github','FlightCore_Firmware','android-app'} or relative.as_posix() in final_paths
    files=sorted((p for p in files if not final_input(p)))+sorted(p for p in files if final_input(p))
    groups=[];group=[];total=0
    final_started=False
    for p in files:
        if final_input(p) and not final_started:
            if group:groups.append(group);group=[];total=0
            final_started=True
        size=p.stat().st_size
        if size>args.max_bytes:raise SystemExit(f'Single file exceeds batch limit: {p.relative_to(ROOT)}')
        if group and (len(group)>=args.max_files or total+size>args.max_bytes):
            groups.append(group);group=[];total=0
        group.append(p);total+=size
    if group:groups.append(group)
    destination.mkdir(parents=True)
    entries=[];rows=[]
    for i,group in enumerate(groups,1):
        batch=f'UPLOAD_{i:02d}'
        for p in group:
            relative=p.relative_to(ROOT).as_posix();out=destination/batch/relative
            out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
            entries.append({'batch':batch,'path':relative,'bytes':p.stat().st_size,'sha256':digest(p)})
        rows.append({'batch':batch,'files':len(group),'bytes':sum(p.stat().st_size for p in group)})
    manifest={'version':version,'fileCount':len(files),'limits':{'maxFiles':args.max_files,'maxBytes':args.max_bytes},'batches':rows,'files':entries}
    (destination/'UPLOAD_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
    with (destination/'BATCH_INVENTORY.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['batch','files','bytes']);writer.writeheader();writer.writerows(rows)
    (destination/'READ_FIRST.md').write_text(f'''# ZEBJUS V{version} — upload batches

ഈ ZIP extract ചെയ്യുക. **ZIP GitHub-ലേക്ക് upload ചെയ്യരുത്.**

1. Repository root-ൽ Add file → Upload files തുറക്കുക.
2. `UPLOAD_01` folder-ന്റെ **ഉള്ളിലെ files/folders** select ചെയ്ത് drag ചെയ്യുക. `UPLOAD_01` folder തന്നെ upload ചെയ്യരുത്.
3. Commit പൂർത്തിയായശേഷം `UPLOAD_02` മുതൽ അതേ രീതിയിൽ ഓരോ batch വീതം upload ചെയ്യുക. എല്ലാം repository root-ലേക്കാണ്.
4. `vendor` folder-ന്റെ ഉള്ളിൽ upload ചെയ്യരുത്: അങ്ങനെ ചെയ്താൽ `vendor/vendor` path വരാം. Existing files replace ചെയ്യുക.
5. എല്ലാ {len(groups)} batches upload ചെയ്തശേഷം മാത്രമാണ് project complete. Outer `READ_FIRST.md`, inventory, manifest, assembly helper എന്നിവ upload ചെയ്യേണ്ടതില്ല.

ഓരോ batch-ലും പരമാവധി {args.max_files} files, {args.max_bytes/1_000_000:g} MB raw data മാത്രം. ഓരോ original path-ഉം ഒരു batch-ൽ മാത്രമാണ്. Vendor files split ചെയ്തിട്ടില്ല; folders വിവിധ batches-ൽ merge ചെയ്യപ്പെടും. `BATCH_INVENTORY.csv`-ൽ counts/size ഉണ്ട്.

Local offline use: install ചെയ്ത Python ഉപയോഗിച്ച് `python assemble_project.py` അല്ലെങ്കിൽ `python3 assemble_project.py` run ചെയ്യുക. Hash verify ചെയ്ത complete project `ZEBJUS_Local` folder-ൽ ലഭിക്കും. അതിലെ `Start_Offline.bat`, `Start_Offline.command` അല്ലെങ്കിൽ `python3 start_offline.py` ഉപയോഗിക്കുക.

Compiled A1/A2 APP/FACTORY `.bin` files ഉൾപ്പെടുത്തിയിട്ടുണ്ട്. Update guide: assembled project-ലെ `SUPPORT/V18_3_60_UPDATE_AND_TEST.md`. Physical USB/OTA, radio and flight checks pending ആണ്; automated browser/transport checks pass ആയി.

AP password: **12345678**. Android APKയും sourceഉം `android-app/`-ൽ ഉണ്ട്. Firmware, Android app, workflow inputs അവസാന batch-ൽ ഒരുമിച്ച് നൽകിയിട്ടുണ്ട്; അതിനാൽ മുഴുവൻ assets upload ചെയ്ത ശേഷമാണ് പുതിയ build inputs commit ആകുന്നത്. അവസാന batch കഴിഞ്ഞ് Actions → Build Aerion Android APK അല്ലെങ്കിൽ Build ZEBJUS FlightCore Firmware → Run workflow ഉപയോഗിക്കാം.
''')
    (destination/'assemble_project.py').write_text('''#!/usr/bin/env python3
"""Merge and verify all extracted upload folders into a new local project."""
import hashlib,json,shutil
from pathlib import Path
root=Path(__file__).resolve().parent
manifest=json.loads((root/'UPLOAD_MANIFEST.json').read_text())
out=root/'ZEBJUS_Local'
if out.exists():raise SystemExit('ZEBJUS_Local already exists. Rename it before assembling a new copy.')
for entry in manifest['files']:
    relative=Path(entry['path'])
    if relative.is_absolute() or '..' in relative.parts:raise SystemExit('Invalid manifest path')
    source=root/entry['batch']/relative
    if not source.is_file() or source.stat().st_size!=entry['bytes'] or hashlib.sha256(source.read_bytes()).hexdigest()!=entry['sha256']:
        raise SystemExit('Missing or changed upload file: '+str(source))
out.mkdir()
for entry in manifest['files']:
    destination=out/entry['path'];destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(root/entry['batch']/entry['path'],destination)
print('Verified',manifest['fileCount'],'files. Open',out/'OFFLINE_START_HERE.md')
''')
    archive=destination.with_suffix('.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(destination.rglob('*')):
            if p.is_file():z.write(p,p.relative_to(destination.parent))
    # Verify the delivered ZIP reconstructs the exact source, not just the staging tree.
    with zipfile.ZipFile(archive) as z:
        for entry in entries:
            data=z.read(f"{name}/{entry['batch']}/{entry['path']}")
            assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256']
    assert len({entry['path'] for entry in entries})==len(files)
    print(json.dumps({'zip':str(archive),'zipBytes':archive.stat().st_size,'projectFiles':len(files),'batches':rows},indent=2))


if __name__=='__main__':main()
