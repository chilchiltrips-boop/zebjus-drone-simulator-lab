#!/usr/bin/env python3
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
