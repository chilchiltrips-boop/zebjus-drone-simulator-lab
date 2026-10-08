from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1];m=json.loads((root/'offline-manifest.json').read_text());assert m['version']==(root/'VERSION.txt').read_text().strip()
for a in m['assets']:
 p=root/a['url'];assert p.is_file(),a['url'];assert p.stat().st_size==a['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'],a['url']
print('Offline bundle PASS:',len(m['assets']),'controller/USB assets;',sum(a['bytes'] for a in m['assets']),'bytes')
