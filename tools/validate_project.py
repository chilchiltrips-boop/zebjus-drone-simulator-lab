"""Validate the minimal controller release without obsolete lab dependencies."""
from pathlib import Path
import json,re,subprocess
root=Path(__file__).resolve().parents[1]
version=(root/'VERSION.txt').read_text().strip()
assert json.loads((root/'package.json').read_text())['version']==version
assert re.search(r'FW_VERSION\s*=\s*"'+re.escape(version)+'"',(root/'FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino').read_text())
subprocess.run(['python3',str(root/'tools/embed_ap_pages.py'),'--check'],check=True)
for p in [root/'controller.js',root/'firmware-updater.js',root/'service-worker.js',root/'android-app/app/src/main/assets/android-transport.js']:
 subprocess.run(['node','--check',str(p)],check=True)
for name in ['index.html','flight/index.html','android-app/app/src/main/assets/flight/index.html']:
 text=(root/name).read_text();ids=re.findall(r'\bid="([^"]+)"',text);assert len(ids)==len(set(ids)),name+' duplicate IDs'
 for required in ['tab-fly','tab-setup','tab-firmware','fwConnectUsbBtn','fwFileInput','left','right','control','arm']:assert required in ids,(name,required)
 assert 'FLIGHT TRAINING' not in text and 'PYTHON LAB' not in text
 assert len(text.encode())<150000,'Native HTML asset size limit'
for name in ['FlightCore_Firmware/catalog.json','firmware-catalog.json']:
 data=json.loads((root/name).read_text());assert data['version']==version
 for board in data['boards']:
  assert board['latest']['version']==version
  for kind in ['app','factory']:
   package=board['latest'][kind]
   if package['available']:
    import hashlib
    file=root/'FlightCore_Firmware'/package['file'];raw=file.read_bytes();assert len(raw)==package['size'] and hashlib.sha256(raw).hexdigest()==package['sha256']
    assert raw[0]==0xE9 and int.from_bytes(raw[12:14],'little') in board['imageChipIds']
print('Controller validation PASS:',version,'shared web/Android UI, JavaScript, board catalog and available binary hashes')
