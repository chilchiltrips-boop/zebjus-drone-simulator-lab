#!/usr/bin/env python3
"""Generate offline-cache inventory after editing the application."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
files = []
for p in sorted(ROOT.rglob('*')):
    rel = p.relative_to(ROOT)
    if not p.is_file():
        continue
    allowed = (len(rel.parts) == 1 and p.suffix in {'.html', '.js', '.css', '.json', '.webmanifest', '.png', '.jpg', '.jpeg', '.svg', '.glb'})
    allowed |= rel.parts[0] == 'vendor' and not p.name.endswith(('.map', '.d.ts'))
    allowed |= rel.as_posix() in {'python_companion/browser_cv2.py', 'python_companion/browser_cvzone.py', 'python_companion/simple_syntax.py', 'FlightCore_Firmware/catalog.json', 'FlightCore_Firmware/latest.json'}
    if allowed and p.name not in {'offline-manifest.json', 'service-worker.js', 'package.json'}:
        data = p.read_bytes()
        files.append({'path': rel.as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
payload = {'version': (ROOT / 'VERSION.txt').read_text().strip(), 'totalBytes': sum(f['bytes'] for f in files), 'files': files}
(ROOT / 'offline-manifest.json').write_text(json.dumps(payload, indent=2) + '\n')
print('Offline files:', len(files), 'bytes:', payload['totalBytes'])
