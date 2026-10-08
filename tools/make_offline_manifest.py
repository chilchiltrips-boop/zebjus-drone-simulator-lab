from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
paths=['index.html','flight/index.html','controller.css','controller.js','firmware-updater.js','firmware-catalog.json','manifest.webmanifest']+[p.relative_to(root).as_posix() for p in sorted((root/'vendor/esptool').rglob('*')) if p.is_file()]
assets=[{'url':p,'bytes':(root/p).stat().st_size,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in paths]
(root/'offline-manifest.json').write_text(json.dumps({'version':(root/'VERSION.txt').read_text().strip(),'assets':assets},indent=2)+'\n')
print('Minimal offline manifest:',len(assets),'assets')
