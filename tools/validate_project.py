#!/usr/bin/env python3
import hashlib, json, re, struct, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]; warnings=[]

def fail(msg): errors.append(msg)
def warn(msg): warnings.append(msg)
def read(rel): return (ROOT/rel).read_text(errors='replace')
def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()

version=read('VERSION.txt').strip()
print(f'ZEBJUS project validation • {version}')

# Required active files and stable mutable names.
required=['index.html','styles.css','app.js','glb-loader.js','three.module.min.js','service-worker.js','kit-local.js','school-lab.js','ui-runtime.js','firmware-updater.js','FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino','FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h','FlightCore_Firmware/catalog.json','FlightCore_Firmware/latest.json','firmware-catalog.json','firmware-latest.json','.github/workflows/build-flightcore-a1.yml','tools/build_firmware.py']
for rel in required:
    if not (ROOT/rel).is_file(): fail(f'missing required file: {rel}')
for p in (ROOT/'FlightCore_Firmware').glob('*.ino'):
    if p.name!='ZEBJUS_FLIGHTCORE.ino': fail(f'versioned/duplicate firmware source must be removed: {p.name}')
for p in (ROOT/'FlightCore_Firmware').glob('*_V*_APP.bin'):
    fail(f'stale versioned application binary must be removed: {p.name}')

# JSON syntax and version consistency.
json_files=['package.json','manifest.webmanifest','firmware-catalog.json','firmware-latest.json','FlightCore_Firmware/catalog.json','FlightCore_Firmware/latest.json']
parsed={}
for rel in json_files:
    try: parsed[rel]=json.loads(read(rel))
    except Exception as e: fail(f'invalid JSON {rel}: {e}')
if parsed.get('package.json',{}).get('version')!=version: fail('package.json version does not match VERSION.txt')
if parsed.get('firmware-catalog.json')!=parsed.get('FlightCore_Firmware/catalog.json'): fail('root and firmware catalog differ')
for rel in ['firmware-catalog.json','firmware-latest.json','FlightCore_Firmware/catalog.json','FlightCore_Firmware/latest.json']:
    if parsed.get(rel,{}).get('version')!=version: fail(f'{rel} version does not match VERSION.txt')
if parsed.get('firmware-latest.json',{}).get('catalog')!='firmware-catalog.json': fail('root firmware-latest.json points to wrong catalog')
if parsed.get('FlightCore_Firmware/latest.json',{}).get('catalog')!='catalog.json': fail('FlightCore_Firmware/latest.json points to wrong catalog')

# Firmware source version and stable catalog filenames.
ino=read('FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino')
m=re.search(r'FW_VERSION\s*=\s*"([^"]+)"',ino)
if not m or m.group(1)!=version: fail('firmware FW_VERSION does not match VERSION.txt')
cat=parsed.get('firmware-catalog.json',{})
for b in cat.get('boards',[]):
    bid=b.get('id','').replace('ZFC-','')
    latest=b.get('latest',{})
    if latest.get('version')!=version: fail(f'{b.get("id")} latest.version mismatch')
    expected_app=f'ZEBJUS_FLIGHTCORE_{bid}_APP.bin'; expected_factory=f'ZEBJUS_FLIGHTCORE_{bid}_FACTORY.bin'
    if latest.get('app',{}).get('file')!=expected_app: fail(f'{b.get("id")} app filename is not stable: {latest.get("app",{}).get("file")}')
    if latest.get('factory',{}).get('file')!=expected_factory: fail(f'{b.get("id")} factory filename is not stable')
    for kind in ('app','factory'):
        pkg=latest.get(kind,{})
        if pkg.get('available'):
            fp=ROOT/'FlightCore_Firmware'/pkg.get('file','')
            if not fp.is_file(): fail(f'{b.get("id")} {kind} marked available but file missing: {fp.name}')
            elif pkg.get('sha256') and sha256(fp).lower()!=str(pkg['sha256']).lower(): fail(f'{fp.name} checksum mismatch')

# JavaScript syntax. ES modules must be parsed in module mode; plain `node --check file.js`
# can treat .js as CommonJS and miss module-only grammar failures in this package.
node=subprocess.run(['bash','-lc','command -v node'],capture_output=True,text=True)
if node.returncode==0:
    module_files={'app.js','glb-loader.js','three.module.min.js'}
    for p in sorted(ROOT.glob('*.js')):
        if p.name in module_files:
            r=subprocess.run(['node','--input-type=module','--check'],input=p.read_text(errors='replace'),capture_output=True,text=True)
        else:
            r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
        if r.returncode: fail(f'JS syntax error {p.name}: {(r.stderr or r.stdout).strip()}')
else: warn('node not installed; JavaScript syntax check skipped')

# Local HTML file references.
html=read('index.html')
for attr,url in re.findall(r'\b(src|href)=["\']([^"\']+)["\']',html,re.I):
    url=url.split('?',1)[0].split('#',1)[0]
    if not url or re.match(r'^(?:https?:|data:|mailto:|tel:|javascript:)',url): continue
    if not (ROOT/url.lstrip('./')).exists(): fail(f'index.html missing local {attr}: {url}')

# Component model and thumbnail references declared by app.js.
app=read('app.js')
assets=sorted(set(re.findall(r"(?:asset|assetCCW):'([^']+)'",app)))
thumbs=sorted(set(re.findall(r"thumb:'([^']+)'",app)))
if not assets: fail('no component GLB assets declared in app.js')
for rel in assets+thumbs:
    if not (ROOT/rel).is_file(): fail(f'app.js references missing component file: {rel}')
if "import {loadGLB} from './glb-loader.js'" not in app: fail('app.js does not import local GLB loader')
if 'cloneAsset(path){return null}' in app: fail('component asset clone is still disabled')

# Validate exactly the GLB features supported by the bundled offline loader.
def glb_json(path):
    data=path.read_bytes()
    if len(data)<20 or data[:4]!=b'glTF': raise ValueError('bad header')
    version_,total=struct.unpack_from('<II',data,4)
    if version_!=2 or total>len(data): raise ValueError('bad version/length')
    off=12; js=None; has_bin=False
    while off+8<=total:
        ln,typ=struct.unpack_from('<II',data,off); off+=8
        chunk=data[off:off+ln]; off+=ln
        if typ==0x4E4F534A: js=json.loads(chunk.rstrip(b'\0 ').decode())
        if typ==0x004E4942: has_bin=True
    if not js or not has_bin: raise ValueError('missing JSON/BIN chunk')
    return js
for rel in assets:
    try:
        j=glb_json(ROOT/rel)
        if j.get('extensionsRequired'): fail(f'{rel} requires unsupported GLB extensions: {j["extensionsRequired"]}')
        for v in j.get('bufferViews',[]):
            if v.get('byteStride'): fail(f'{rel} uses unsupported interleaved byteStride')
        for a in j.get('accessors',[]):
            if a.get('sparse'): fail(f'{rel} uses unsupported sparse accessor')
            if a.get('componentType') not in (5120,5121,5122,5123,5125,5126): fail(f'{rel} unsupported accessor componentType')
        for mesh in j.get('meshes',[]):
            for prim in mesh.get('primitives',[]):
                if prim.get('mode',4)!=4: fail(f'{rel} contains non-triangle primitive mode')
                if 'POSITION' not in prim.get('attributes',{}): fail(f'{rel} primitive missing POSITION')
    except Exception as e: fail(f'invalid GLB {rel}: {e}')


# Assembly interaction invariants: screen-space snapping avoids camera/bench parallax,
# and base material state must survive X-ray toggles without permanent fade.
if 'nearestFreeSlotFromPointer' not in app or 'snapPixelLimits' not in app:
    fail('assembly magnetic snapping is not screen-space / parallax-safe')
if 'zebjusBaseVisual' not in app or 'restoreMaterialBase' not in app:
    fail('assembly material base state is not preserved across X-ray/selection states')
if 'renderer.toneMappingExposure=1.10' not in app:
    warn('assembly renderer exposure differs from calibrated V18.3.27 value')
for legacy in ['drone3d.js','wiring2d.js','learning-lab.js']:
    if (ROOT/legacy).exists(): warn(f'unused legacy runtime file still present: {legacy}')

# Service worker must know the loader and every GLB so offline use is deterministic.
sw=read('service-worker.js')
expected_cache='zebjus-flightcore-v'+version.replace('.', '-')
if expected_cache not in sw: fail(f'service worker cache namespace is stale; expected {expected_cache}')
if './glb-loader.js' not in sw: fail('service worker does not cache glb-loader.js')
for rel in assets:
    if f'./{rel}' not in sw: fail(f'service worker does not pre-cache component model: {rel}')

# Build/update references must use stable firmware names and current supported core.
build=read('tools/build_firmware.py'); workflow=read('.github/workflows/build-flightcore-a1.yml')
if "ZEBJUS_FLIGHTCORE.ino" not in build or "CORE_VERSION='3.3.12'" not in build: fail('firmware build script is not on stable source name/core 3.3.12')
if 'ZEBJUS_FLIGHTCORE_TYPES.h' not in ino or 'ImuSample' not in read('FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h'): fail('firmware ImuSample type is not safely declared in companion header')
if "('*.h','*.hpp','*.c','*.cpp')" not in build: fail('firmware build script does not copy companion headers/sources into temporary Arduino sketch')
if 'ZEBJUS_FLIGHTCORE_A1_APP.bin' not in workflow or '_V18_' in workflow: fail('workflow still uses a versioned A1 application filename')
if 'version: 1.5.1' not in workflow: fail('workflow must pin stable Arduino CLI 1.5.1 instead of floating 1.x / prerelease')
if 'FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h' not in workflow: fail('workflow does not rebuild when firmware companion header changes')

if warnings:
    for x in warnings: print('WARN:',x)
if errors:
    for x in errors: print('ERROR:',x)
    print(f'FAILED: {len(errors)} error(s)')
    sys.exit(1)
print(f'PASS: {len(assets)} GLB models, {len(thumbs)} thumbnails, JSON/JS/catalog/file-reference checks OK')
