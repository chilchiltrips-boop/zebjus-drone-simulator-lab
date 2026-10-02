#!/usr/bin/env python3
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
