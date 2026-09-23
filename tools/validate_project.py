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
required=['RELEASE_NOTES.md','index.html','styles.css','app.js','glb-loader.js','three.module.min.js','service-worker.js','kit-local.js','school-lab.js','ui-runtime.js','firmware-updater.js','FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino','FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h','FlightCore_Firmware/catalog.json','FlightCore_Firmware/latest.json','firmware-catalog.json','firmware-latest.json','.github/workflows/build-flightcore-a1.yml','tools/build_firmware.py']
for rel in required:
    if not (ROOT/rel).is_file(): fail(f'missing required file: {rel}')
for p in (ROOT/'FlightCore_Firmware').glob('*.ino'):
    if p.name!='ZEBJUS_FLIGHTCORE.ino': fail(f'versioned/duplicate firmware source must be removed: {p.name}')
for p in (ROOT/'FlightCore_Firmware').glob('*_V*_APP.bin'):
    fail(f'stale versioned application binary must be removed: {p.name}')
for rel in ['drone3d.js','wiring2d.js','learning-lab.js']:
    if (ROOT/rel).exists(): fail(f'orphan legacy runtime should be removed: {rel}')

# Package inventory / active release note / duplicate HTML IDs.
actual_count=sum(1 for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts)
try:
    declared_count=int(read('FILE_COUNT.txt').strip())
    if declared_count!=actual_count: fail(f'FILE_COUNT.txt={declared_count}, actual packaged files={actual_count}')
except Exception as e: fail(f'invalid FILE_COUNT.txt: {e}')
if f'V{version}' not in read('RELEASE_NOTES.md').splitlines()[0]: fail('RELEASE_NOTES.md heading does not match VERSION.txt')
html_ids=re.findall(r'\bid=[\"\']([^\"\']+)',read('index.html'))
for ident in sorted(set(x for x in html_ids if html_ids.count(x)>1)): fail(f'duplicate HTML id: {ident}')
for p in ROOT.rglob('*'):
    if p.is_file() and p.stat().st_size==0: fail(f'zero-byte packaged file: {p.relative_to(ROOT)}')

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
        for mat in j.get('materials',[]):
            pbr=mat.get('pbrMetallicRoughness',{})
            if pbr.get('baseColorTexture') or pbr.get('metallicRoughnessTexture') or mat.get('normalTexture') or mat.get('occlusionTexture') or mat.get('emissiveTexture'):
                fail(f'{rel} uses texture-backed materials not supported by the bundled offline loader')
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

# Service worker must know the loader and every GLB so offline use is deterministic.
sw=read('service-worker.js')
if './glb-loader.js' not in sw: fail('service worker does not cache glb-loader.js')
for rel in assets:
    if f'./{rel}' not in sw: fail(f'service worker does not pre-cache component model: {rel}')
for rel in thumbs:
    if f'./{rel}' not in sw: fail(f'service worker does not pre-cache component thumbnail: {rel}')


# Assembly-runtime regressions: model readiness, magnetic snapping, colour handling and mechanical datums.
if app.find('const ARM_GLTF_Z_SCALE=2.715/3.20')>app.find('const slots='): fail('ARM_GLTF_Z_SCALE is declared after slot generation (runtime TDZ risk)')
if 'Math.hypot(s.p[0]-p.x,s.p[2]-p.z)' not in app: fail('magnetic snap distance is not horizontal X/Z distance')
nearest_match=re.search(r'function nearestFreeSlot[\s\S]*?\n}',app)
if nearest_match and 'distanceTo(p)' in nearest_match.group(0): fail('nearestFreeSlot still uses 3D distance')
if "'f450_arm_red.glb':{scale:[1,1,ARM_GLTF_Z_SCALE]}" not in app or "'f450_arm_white.glb':{scale:[1,1,ARM_GLTF_Z_SCALE]}" not in app: fail('F450 arm GLB mechanical-datum normalization missing')
if "c.asset&&!assetsReady" not in app: fail('component placement is not gated until local GLB preload completes')
if 'PDB_XT60_SOCKET' not in app: fail('real PDB asset path lacks visible XT60 socket decoration')
loader=read('glb-loader.js')
if 'srgbToLinear' not in loader or 'colorAttribute' not in loader: fail('offline GLB loader does not preserve bundled component vertex colours')
if 'buildMaterial' not in loader: fail('offline GLB loader does not preserve glTF material factors')
if 'rememberMaterialVisual' not in app or 'setMaterialFade' not in app: fail('X-ray mode does not preserve original material visual state')

# The arm GLB motor-pad and hole datums are authored at Z=3.20 / 3.105 / 3.295.
# V18.3.27 scales only local Z so the assembled motor center is exactly 2.715 from the arm root.
try:
    aj=glb_json(ROOT/'f450_arm_red.glb')
    byname={n.get('name'):n for n in aj.get('nodes',[])}
    mp=byname.get('motor_pad',{}).get('matrix',[])
    if len(mp)!=16 or abs(mp[14]-3.2)>1e-6: fail('red-arm motor_pad mechanical datum changed; revalidate ARM_GLTF_Z_SCALE')
    for nm,z in [('hole0',3.105),('hole1',3.105),('hole2',3.295),('hole3',3.295)]:
        m=byname.get(nm,{}).get('matrix',[])
        if len(m)!=16 or abs(m[14]-z)>1e-6: fail(f'red-arm {nm} mechanical datum changed; revalidate motor screw slots')
except Exception as e: fail(f'could not validate arm mechanical datums: {e}')

school=read('school-lab.js')
if 'const FAILURE_LIMIT=5;' not in school or 'OFFLINE_AFTER_MS=10000' not in school: fail('school-lab reconnect/heartbeat policy is not 5 failures + 10 s offline timeout')

# Browser local-kit API literals must exist in firmware routes.
kit=read('kit-local.js')
client_endpoints=set(re.findall(r"['\"`](/api/[A-Za-z0-9_./-]+)",kit))
firmware_endpoints=set(re.findall(r'server\.on\(\"([^\"?]+)',ino))
for ep in sorted(client_endpoints-firmware_endpoints): fail(f'kit-local.js endpoint missing in firmware: {ep}')

# Build/update references must use stable firmware names and current supported core.
build=read('tools/build_firmware.py'); workflow=read('.github/workflows/build-flightcore-a1.yml')
if "ZEBJUS_FLIGHTCORE.ino" not in build or "CORE_VERSION='3.3.12'" not in build: fail('firmware build script is not on stable source name/core 3.3.12')
if 'ZEBJUS_FLIGHTCORE_TYPES.h' not in ino or 'ImuSample' not in read('FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h'): fail('firmware ImuSample type is not safely declared in companion header')
if "('*.h','*.hpp','*.c','*.cpp')" not in build: fail('firmware build script does not copy companion headers/sources into temporary Arduino sketch')
if 'ZEBJUS_FLIGHTCORE_A1_APP.bin' not in workflow or '_V18_' in workflow: fail('workflow still uses a versioned A1 application filename')
if 'FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h' not in workflow: fail('workflow does not rebuild when firmware companion header changes')
if "version: '1.5.1'" not in workflow: fail('workflow does not pin stable Arduino CLI 1.5.1')
if 'actions/checkout@v5' not in workflow: fail('workflow checkout action is not on Node-24-compatible v5')

if warnings:
    for x in warnings: print('WARN:',x)
if errors:
    for x in errors: print('ERROR:',x)
    print(f'FAILED: {len(errors)} error(s)')
    sys.exit(1)
print(f'PASS: {len(assets)} GLB models, {len(thumbs)} thumbnails, JSON/JS/catalog/file-reference checks OK')
