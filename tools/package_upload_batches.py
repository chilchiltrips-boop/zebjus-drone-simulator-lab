#!/usr/bin/env python3
"""Minimum GitHub web-upload batches: <=100 files, <=25 MiB per file."""
import argparse,csv,hashlib,json,math,shutil,zipfile,sys
sys.dont_write_bytecode = True
from project_files import project_files
from release_integrity import verify_manifest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT.parent);parser.add_argument('--max-files',type=int,default=100);args=parser.parse_args()
    if not 1<=args.max_files<=100:raise SystemExit('Use 1..100 files per upload.')
    version=(ROOT/'VERSION.txt').read_text().strip();name='ZEBJUS_V'+version.replace('.','_')+'_UPLOAD_BATCHES';destination=args.output.resolve()/name
    if destination.exists():raise SystemExit('Choose an empty destination: '+str(destination))
    verify_manifest(ROOT)
    files=project_files(ROOT)
    for p in files:
        if p.stat().st_size>25*1024*1024:raise SystemExit('GitHub web single-file limit exceeded: '+str(p.relative_to(ROOT)))
    final_paths={'release-integrity.json','tools/release_integrity.py','tools/project_files.py','tools/test_upload_integrity.py','tools/test_firmware_setup.py','VERSION.txt','FILE_COUNT.txt','firmware-catalog.json','firmware-latest.json','firmware-updater.js','tools/build_firmware.py','tools/cleanup_repo.py','tools/validate_project.py','tools/make_offline_manifest.py','tools/validate_offline_bundle.py','tools/embed_ap_pages.py','tools/ap_portal_source.html','tools/ap_fly_source.html','tools/ap_io_source.html','tools/test_flight_math.cpp','control-sticks.js','kit-console.js','flight-diagnostics.js','flight/index.html'}
    def final(p):
        rel=p.relative_to(ROOT);return rel.parts[0] in {'.github','FlightCore_Firmware','android-app'} or rel.as_posix() in final_paths
    reserved=[p for p in files if final(p)]
    if len(reserved)>args.max_files:raise SystemExit('Final workflow-input group exceeds file limit.')
    count=math.ceil(len(files)/args.max_files);capacities=[len(files)//count+(i<len(files)%count) for i in range(count)]
    while capacities[-1]<len(reserved):
        i=max(range(count-1),key=lambda i:capacities[i]);capacities[i]-=1;capacities[-1]+=1
    groups=[[] for _ in range(count)];groups[-1]=reserved[:];sizes=[0]*(count-1)+[sum(p.stat().st_size for p in reserved)]
    for p in sorted((p for p in files if not final(p)),key=lambda p:(-p.stat().st_size,str(p))):
        i=min((i for i in range(count) if len(groups[i])<capacities[i]),key=lambda i:sizes[i]);groups[i].append(p);sizes[i]+=p.stat().st_size
    assert all(len(g)<=args.max_files for g in groups) and len(groups)==math.ceil(len(files)/args.max_files)
    destination.mkdir(parents=True);entries=[];rows=[]
    for i,group in enumerate(groups,1):
        batch=f'UPLOAD_{i:02d}'
        for p in sorted(group):
            relative=p.relative_to(ROOT).as_posix();out=destination/batch/relative;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
            entries.append({'batch':batch,'path':relative,'bytes':p.stat().st_size,'sha256':digest(p)})
        rows.append({'batch':batch,'files':len(group),'bytes':sizes[i-1]})
    manifest={'version':version,'fileCount':len(files),'maxFilesPerBatch':args.max_files,'maxFileBytes':25*1024*1024,'batches':rows,'files':entries}
    (destination/'UPLOAD_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
    with (destination/'BATCH_INVENTORY.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['batch','files','bytes']);w.writeheader();w.writerows(rows)
    (destination/'READ_FIRST.md').write_text(f'''# ZEBJUS Aerion V{version} R3 — {len(groups)} upload batches

ഈ ZIP extract ചെയ്യുക. ZIP GitHub-ലേക്ക് upload ചെയ്യരുത്.

1. GitHub branch selector-ൽ **upload-v{version.replace('.', '-')}-r3** എന്ന പുതിയ branch `main`-ൽ നിന്ന് create ചെയ്യുക. Live Pages source `main` ആയി നിലനിർത്തുക. ആ പുതിയ branch-ന്റെ repository root → Add file → Upload files.
2. `UPLOAD_01`-ന്റെ **ഉള്ളിലെ files/folders** drag ചെയ്യുക. `UPLOAD_01` folder തന്നെ upload ചെയ്യരുത്.
3. അതേ upload branch-ൽ batches ക്രമത്തിൽ commit ചെയ്യുക. എല്ലാം repository root-ലേക്കാണ്. ഇടവേള എടുത്താലും live main-ൽ files mix ആവില്ല.
4. `vendor`-ന്റെ അകത്ത് upload ചെയ്യരുത്; `vendor/vendor` path ഉണ്ടാകരുത്. Existing paths replace ചെയ്യുക.
5. അവസാന batch-ൽ release-integrity marker, firmware/APK/workflow inputs ഉണ്ട്. macOS-ൽ hidden `.github` / `.gitignore` കാണാൻ Cmd+Shift+. ഉപയോഗിക്കുക.
6. എല്ലാ batches-ഉം commit ചെയ്തശേഷം upload branch → main Pull Request create ചെയ്യുക. **Verify complete upload** check pass ആയശേഷം ഒരു merge നടത്തുക. ഇതിലൂടെ main-ൽ complete files ഒരുമിച്ച് വരും.

ഓരോ batch-ലും പരമാവധി {args.max_files} files. ഓരോ file-ഉം 25 MiB-യിൽ താഴെ. Files split ചെയ്തിട്ടില്ല. Inventory-യിലെ batch bytes ആകെ വലുപ്പമാണ്; single-file limit അല്ല. {len(files)} files-ന് {len(groups)} ആണ് ഏറ്റവും കുറഞ്ഞ batch എണ്ണം.

Wrapper `READ_FIRST.md`, inventory, manifest, assembly helper എന്നിവ repository-ലേക്ക് upload ചെയ്യേണ്ടതില്ല.
Local use: `python3 assemble_project.py` (Windows: `python assemble_project.py`). Hash verified project `ZEBJUS_Local`-ൽ ലഭിക്കും. അതിലെ offline launcher ഉപയോഗിക്കുക.
Wrapper files accidentally GitHub root-ൽ എത്തിയിട്ടുണ്ടെങ്കിൽ CI cleanup അവ നീക്കും. `release-integrity.json` project-ന്റെ internal completion check ആണ്; അത് upload ചെയ്യണം.
APK: `android-app/dist/`. A1/A2 APP + FACTORY binaries: `FlightCore_Firmware/`.
AP password: **12345678**. Guide: `SUPPORT/V18_3_61_UPDATE_AND_TEST.md`.
Real-phone, USB/OTA, sensor voltage and loaded 250 Hz measurements are pending.
''')
    (destination/'assemble_project.py').write_text('''#!/usr/bin/env python3
import hashlib,json,shutil
from pathlib import Path
r=Path(__file__).resolve().parent;m=json.loads((r/'UPLOAD_MANIFEST.json').read_text());out=r/'ZEBJUS_Local'
if out.exists():raise SystemExit('Rename existing ZEBJUS_Local before assembly.')
assert len(m['files'])==m['fileCount']==len({e['path'] for e in m['files']})
for e in m['files']:
    rel=Path(e['path'])
    if rel.is_absolute() or '..' in rel.parts or e['batch'] not in {b['batch'] for b in m['batches']}:raise SystemExit('Invalid path')
    p=r/e['batch']/rel
    if not p.is_file() or p.stat().st_size!=e['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=e['sha256']:raise SystemExit('Missing/changed: '+str(p))
out.mkdir()
for e in m['files']:
    p=out/e['path'];p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/e['batch']/e['path'],p)
print('Verified',m['fileCount'],'files. Open',out/'OFFLINE_START_HERE.md')
''')
    archive=destination.with_suffix('.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(destination.rglob('*')):
            if p.is_file():z.write(p,p.relative_to(destination.parent))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for e in entries:
            data=z.read(f"{name}/{e['batch']}/{e['path']}");assert len(data)==e['bytes'] and hashlib.sha256(data).hexdigest()==e['sha256']
    print(json.dumps({'zip':str(archive),'zipBytes':archive.stat().st_size,'projectFiles':len(files),'batches':rows},indent=2))
if __name__=='__main__':main()
