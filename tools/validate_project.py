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
required=['RELEASE_NOTES.md','index.html','styles.css','app.js','python-worker.js','glb-loader.js','three.module.min.js','service-worker.js','kit-local.js','school-lab.js','ui-runtime.js','firmware-updater.js','FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino','FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h','FlightCore_Firmware/catalog.json','FlightCore_Firmware/latest.json','firmware-catalog.json','firmware-latest.json','.github/workflows/build-flightcore-a1.yml','tools/build_firmware.py']
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
if 'function nearestFreeSlotScreen' not in app or '.project(camera)' not in app: fail('magnetic snap is not using view-angle-independent screen-space target projection')
nearest_match=re.search(r'function nearestFreeSlotScreen[\s\S]*?\n}',app)
if nearest_match and ('distanceTo(p)' in nearest_match.group(0) or 'hitBench(' in nearest_match.group(0)): fail('screen-space magnetic snap still depends on 3D/bench-plane distance')
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

# OTA post-flash reconnect must tolerate slow DHCP/mDNS return after reboot.
if 'reconnectAfterFirmware' not in school or 'totalMs=120000' not in school or 'clearKnownAddress' not in read('kit-local.js'): fail('firmware reboot reconnect is missing staged cached-IP → mDNS discovery recovery')
fu=read('firmware-updater.js')
if 'FLASH SUCCESS • RECONNECT PENDING' not in fu or 'startPostFlashWatch' not in fu or '300000' not in fu: fail('Firmware Center does not preserve flash-success state with background reconnect verification')
if 'const FAILURE_LIMIT=5;' not in school or 'OFFLINE_AFTER_MS=10000' not in school: fail('school-lab reconnect/heartbeat policy is not 5 failures + 10 s offline timeout')

# Browser local-kit API literals must exist in firmware routes.
kit=read('kit-local.js')
client_endpoints=set(re.findall(r"['\"`](/api/[A-Za-z0-9_./-]+)",kit))
firmware_endpoints=set(re.findall(r'server\.on\(\"([^\"?]+)',ino))
for ep in sorted(client_endpoints-firmware_endpoints): fail(f'kit-local.js endpoint missing in firmware: {ep}')

# Build/update references must use stable firmware names and current supported core.
build=read('tools/build_firmware.py'); workflow=read('.github/workflows/build-flightcore-a1.yml')
if "ZEBJUS_FLIGHTCORE.ino" not in build or "CORE_VERSION='3.3.12'" not in build: fail('firmware build script is not on stable source name/core 3.3.12')
types_header=read('FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h')
if 'ZEBJUS_FLIGHTCORE_TYPES.h' not in ino or 'ImuSample' not in types_header: fail('firmware ImuSample type is not safely declared in companion header')
if 'enum ImuKind' not in types_header or 'IMU_MPU6050' not in types_header or 'IMU_LSM6DS3' not in types_header: fail('firmware ImuKind enum is not safely declared in companion header')
if re.search(r'^\s*enum\s+ImuKind',ino,re.M): fail('ImuKind must not be declared inside the .ino because Arduino auto-prototype generation can place prototypes before it')
if "('*.h','*.hpp','*.c','*.cpp')" not in build: fail('firmware build script does not copy companion headers/sources into temporary Arduino sketch')
if 'ZEBJUS_FLIGHTCORE_A1_APP.bin' not in workflow or '_V18_' in workflow: fail('workflow still uses a versioned A1 application filename')
if 'ZEBJUS_FLIGHTCORE_A2_APP.bin' not in workflow: fail('workflow does not require/publish the A2 application image')
if 'concurrency:' not in workflow or 'cancel-in-progress: true' not in workflow: fail('workflow lacks firmware-build concurrency protection')
if 'Publish attempt ${attempt}/4' not in workflow or 'git fetch origin main' not in workflow or 'git reset --hard origin/main' not in workflow: fail('workflow lacks non-fast-forward publish retry protection')
if 'test -s FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A1_APP.bin' not in workflow or 'test -s FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A2_APP.bin' not in workflow: fail('workflow does not require both A1 and A2 APP binaries')
if 'FlightCore_Firmware/ZEBJUS_FLIGHTCORE_TYPES.h' not in workflow: fail('workflow does not rebuild when firmware companion header changes')
if "version: '1.5.1'" not in workflow: fail('workflow does not pin stable Arduino CLI 1.5.1')
if 'actions/checkout@v5' not in workflow: fail('workflow checkout action is not on Node-24-compatible v5')
if 'FW_BUILD_DATE=__DATE__' not in ino or 'FW_BUILD_TIME=__TIME__' not in ino or 'firmwareBuiltAt' not in ino: fail('firmware compile date/time is not exposed by status/info APIs')
if 'built_at=datetime.now(timezone.utc)' not in build or "'builtAt':built_at" not in build: fail('firmware build script does not stamp ISO build date/time metadata')
if '#fwBuildTime' not in read('firmware-updater.js') or 'fwCurrentBuildTime' not in read('firmware-updater.js'): fail('Firmware Center build date/time rendering is missing')
if "type==='guard'||type==='prop'" not in app or 'const bladeMat=mat(0xdbe5eb' not in app or '[0,Math.PI].forEach' not in app: fail('high-visibility two-blade procedural CW/CCW propeller runtime is missing')
if 'rerunPythonBtn' not in app or 'python-stop-live' not in app or 'Variable from your code' not in app: fail('Python Run/Stop/Rerun or typed-variable completion polish is missing')
if 'pythonProjectUndo' not in app or 'pythonUndoFileBtn' not in app or 'pythonRedoFileBtn' not in app or 'python-file-delete' not in read('styles.css'): fail('Python project delete/undo/redo workflow is missing')
if 'if self.target() != \"real\"' in app: fail('Python runtime still contains fragile repeated Real-kit target checks')
if 'function pythonSetRunUi' not in app or 'target.disabled=running' not in app: fail('Python target selector is not locked during a running hardware program')
if 'for(let attempt=0;attempt<3;attempt++)' not in school or 'IMU read was lost after retries' not in school: fail('school-lab IMU transient retry logic is missing')
if 'Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,100000)' not in ino or 'attempt<3&&!ok' not in ino: fail('firmware IMU API does not use robust 100 kHz multi-attempt I2C reads')
if 'new Worker(`./python-worker.js' not in app or 'worker.terminate()' not in app: fail('Python execution is not isolated in a terminable Worker')
if './python-worker.js' not in sw: fail('service worker does not cache python-worker.js')
if 'IMU_MPU6050' not in ino or 'IMU_LSM6DS3' not in ino or 'detectImu' not in ino: fail('firmware does not auto-detect supported IMU families')
if '0xFFFFFFFFFFFF' not in ino or '%012llX' not in ino: fail('firmware Device ID is not using the full 48-bit MAC')
if 'selectedConnected()' not in school or 'Found • Connect required' not in school: fail('truthful FOUND vs CONNECTED state is missing')
if 'DUPLICATE_KIT_NAME' not in kit or 'discoverName' not in kit: fail('multi-kit duplicate-name discovery protection is missing')
if 'filter(x=>!sameDeviceIdentity(x.deviceId,id))' not in kit: fail('known-kit cache still collapses physical boards by Kit Name instead of Device ID')
if 'interval=selectedConnected()?30000:15000' not in school: fail('background multi-kit discovery stops or scans too aggressively while a selected kit is connected')
if 'matches.length===1' not in school or 'duplicate-kit-name' not in school: fail('duplicate Kit Names are not surfaced/guarded in the multi-kit selector')
if 'flightCoreIntegrated' not in ino or 'RATE_ANGLE_FLIGHT_CORE' not in ino or 'WIFI_SENSOR_BRIDGE' not in ino: fail('board-aware bridge/flight-core firmware roles are not explicit')
if 'enum FlightModeKind' not in types_header or 'enum RcSourceKind' not in types_header: fail('flight-control custom enums must live in the companion header for Arduino prototype safety')
for token in ['runFlightLoop()','FLIGHT_LOOP_US=4000','MOTOR_PINS[4]={D1,D2,D3,D0}','chooseRcSource()','RC_PPM','RC_WEB_STA','RC_WEB_AP','parseRcCsv','/fly','WEB_RC_STALE_MS=300']:
    if token not in ino: fail(f'Rate/Angle multi-source flight integration missing: {token}')
if 'rc[5]>=1500?FLIGHT_RATE:FLIGHT_ANGLE' not in ino: fail('CH6 Angle/Rate mode mapping missing')
if 'rc[4]<1500' not in ino or 'rc[2]<=1050' not in ino: fail('CH5 arm / low-throttle arming gates missing')
if '1.024f*(throttle+inputRoll-inputPitch+inputYaw)' not in ino: fail('four-motor mixer missing or changed unexpectedly')
if 'ZEBJUS_FLIGHTCORE_A2_APP.bin' not in workflow or '--board all' not in workflow: fail('workflow does not build both A1/C3 and A2/C6 application packages')
if 'find_factory_bin' not in build or "'buildId':build_id" not in build: fail('firmware build does not publish factory metadata/build IDs')
if 'validateEspImage' not in fu or 'mostly empty/zero data' not in fu: fail('Firmware Center imported-image validation is incomplete')
if 'imuAccelChart' not in read('index.html') or 'recordImuSample' not in app or 'downloadImuCsv' not in app: fail('IMU live graph/rate/CSV teaching tools are missing')
if 'python-side-stack' not in read('index.html') or 'python-imu-card' not in read('index.html'): fail('IMU Live Graph and Python terminal are not separated into stacked cards')
if 'copyTerminalBtn' not in read('index.html') or 'copyPythonTerminal' not in app or 'navigator.clipboard.writeText' not in app: fail('Python terminal Copy Output workflow is missing')
styles=read('styles.css')
if '#tab-python{--py-side-w:430px;--py-terminal-h:330px}' not in styles or 'python-row-resizer' not in styles or 'python-col-resizer' not in styles: fail('V18.3.43 draggable Python workspace sizing is missing')
if '#tab-python .python-file-list{display:flex!important;flex-direction:row!important' not in styles: fail('Student Python Files is not a horizontal project strip')
if '#pythonTerminal .python-terminal-error' not in styles or 'color:#ff7288' not in styles: fail('Python terminal error coloring is missing')
if "const CACHE='zebjus-flightcore-v18-3-44'" not in sw: fail('service-worker cache key is stale for V18.3.44')


# V18.3.43 Python Flight Lab / real-FC tuning integration.
if 'struct FlightPidSettings' not in types_header or 'enum BenchModeKind' not in types_header: fail('PID/bench custom types are not in the Arduino-safe companion header')
for token in ['loadPidSettings()','savePidSettings()','pid_get','pid_set','pid_defaults','PID edit blocked while armed','confirm=PROPS_REMOVED','motor_test','motor_order_test','esc_calibrate','bench_status','calibrate_gyro']:
    if token not in ino: fail(f'V18.3.43 real-FC Python/PID support missing: {token}')
if 'async function commandDevice' not in school or 'await client.command(command)' not in school: fail('school-lab lacks awaited command bridge for Python real-kit projects')
for method in ['set_rate_pid','set_angle_pid','receiver','ppm','motor_test','motor_order_test','esc_calibrate','bench_status','calibrate_gyro']:
    if method not in app or method not in read('python-worker.js'): fail(f'Python Drone API method missing from app/worker runtime: {method}')
example_block=app[app.find('const PY_EXAMPLES=['):app.find('const ZEBJUS_PY_PRELUDE=')]
required_examples=['i2c','imu','gyro','accel','angle','ppm','pid-read','rate-pid','angle-pid','keyboard-rc','gyro-cal','motor-test','esc-cal','level-check','rx-monitor','sensor-snapshot','flight-diag','rc-center','throttle-ramp','bench-status','motor-one','pid-step','combined']
for ident in required_examples:
    if f"id:'{ident}'" not in example_block: fail(f'Python Flight Lab example missing: {ident}')
if example_block.count("{id:'") < 25: fail('Python Flight Lab does not contain the expanded project library')
for token in ['syncPythonCodeToSimulator','pythonSimCommand','pythonBenchMix','setStickVisual','PRateRoll','PAngleRoll']:
    if token not in app: fail(f'Python code-to-simulator reflection missing: {token}')
for token in ['pythonColResizer','pythonRowResizer','initPythonWorkspaceResizers','zebjus-python-layout-v1841']:
    if token not in app+html: fail(f'Python draggable workspace integration missing: {token}')
if "pythonTerminalWrite(m.text||'','error')" in app: fail('stderr handler regression: terminal should buffer stderr and render it as red on completion/error')
if "pythonTerminalWrite(pythonStderrBuffer,'error')" not in app or "pythonTerminalWrite(`ERR: ${friendly}\\n`,'error')" not in app: fail('Python runtime errors are not routed to red terminal output')


# V18.3.43 continuous real-attitude fix.
if 'Always sample/fuse the MPU6050 at 250 Hz, even when no RC source is active.' not in ino:
    fail('V18.3.43 continuous MPU6050 attitude sampling fix is missing')
needle='if(activeRcSource==RC_NONE){armLowSeen=false;disarmFlight("RC timeout");return;}'
imu='float rr,rp,ry;if(!readMpuFlight(rr,rp,ry,accX,accY,accZ))'
if ino.find(imu) < 0 or ino.find(needle) < 0 or ino.find(imu) > ino.find(needle):
    fail('IMU/Kalman update must occur before the RC_NONE early return')
if 'sampleAgeMs' not in ino or 'MPU6050_KALMAN' not in ino:
    fail('attitude_read diagnostics are missing')
if "{id:'angle',title:'Angle / Attitude Read'" not in app or "code:PY_ANGLE_EXAMPLE,target:'real'" not in app:
    fail('Angle / Attitude Read example must default to Real ZEBJUS kit')

# V18.3.43 read-only bridge + persistent level calibration.
for token in ['READ_ONLY_DEVICE_COMMANDS','calibration_get','calibration_set','level_calibrate','calibration_defaults']:
    if token not in school+ino+app: fail(f'V18.3.43 calibration/read-only integration missing: {token}')
if "const READ_ONLY_DEVICE_COMMANDS=new Set(['ping','pid_get','receiver_read','ppm_read','attitude_read','calibration_get','bench_status'])" not in school:
    fail('Read-only real-kit commands are not explicitly separated from mutating commands')
if 'const ok=await acquireLock(true)' not in school:
    fail('Mutating Python real-kit commands do not auto-acquire the selected Device ID control lock')
for token in ['loadCalibrationSettings()','saveCalibrationSettings()','accelOffsetX','accelOffsetY','accelOffsetZ','levelTrimRoll','levelTrimPitch','Level accelerometer offsets and gyro bias captured']:
    if token not in ino: fail(f'Persistent A2 level calibration missing: {token}')
for method in ['get_calibration','set_accel_offsets','level_calibrate','restore_calibration_defaults']:
    if method not in app or method not in read('python-worker.js'): fail(f'Python calibration API method missing: {method}')
for ident in ['cal-read','acc-offsets','level-cal']:
    if f"id:'{ident}'" not in example_block: fail(f'Python calibration example missing: {ident}')
if example_block.count("{id:'") < 28: fail('Python Flight Lab does not contain the calibration-expanded project library')
if 'calAccX' not in html or 'calCaptureBtn' not in html or 'calibrationUi' not in app:
    fail('Calibration page does not expose persistent X/Y/Z offsets and Capture Level')


# V18.3.43 unified RC / simulator mirror.
if 'if(webRcFresh())return setupMode?RC_WEB_AP:RC_WEB_STA;if(receiverFresh())return RC_PPM' not in ino: fail('V18.3.43 Web/AP/Python-first RC arbitration is missing')
if 'REAL KIT + TRIPOD MIRROR' not in html or 'simRealMirrorTick' not in app or 'mirrorSimPidToReal' not in app: fail('V18.3.43 Tripod real-kit mirror is missing')
if "rcSource!=='NONE'" not in school or "api()?.controlSim?.({roll:(c[0]-1500)/500" not in school: fail('V18.3.43 active RC telemetry/Web joystick mirror is missing')
if 'simulatorMirror:true' not in app: fail('V18.3.43 Python real-kit simulator mirror is missing')

# V18.3.44 release integration and editable AP-page source consistency.
embedded=subprocess.run([sys.executable,str(ROOT/'tools/embed_ap_pages.py'),'--check'],capture_output=True,text=True)
if embedded.returncode: fail('AP page sources differ from firmware: '+embedded.stderr.strip())
for rel in ['tools/ap_portal_source.html','tools/ap_fly_source.html','python_companion/zebjus_client.py','python_companion/requirements-vision.txt','python_companion/imu_plot.py','python_companion/camera_telemetry.py','python_companion/cvzone_hands.py','SUPPORT/FLIGHT_VALIDATION_V18_3_44.md']:
    if not (ROOT/rel).is_file(): fail(f'V18.3.44 project file missing: {rel}')
for token in ['ARMED_LOOP_GAP_LIMIT_US','loopOverruns','escPwmReady','prefs.begin("zjcal",false)','Wi-Fi scan blocked while armed','Level capture requires a level, motionless']:
    if token not in ino: fail(f'V18.3.44 firmware guard missing: {token}')
for token in ['settingsNetworkSummary','basicFlightMode','pythonCameraVideo','pythonHandsToggle','pythonPlotImage']:
    if token not in html: fail(f'V18.3.44 UI control missing: {token}')
for token in ['sendPythonSafeFrame','pythonCameraFrame','togglePythonHands','pythonVisualImage','plot-imu','camera-opencv','hand-landmarks']:
    if token not in app: fail(f'V18.3.44 Python/vision integration missing: {token}')
for token in ['camera_frame','hands','show_image','show_plot','loadPackagesFromImports']:
    if token not in read('python-worker.js'): fail(f'V18.3.44 Python Worker method missing: {token}')

if warnings:
    for x in warnings: print('WARN:',x)
if errors:
    for x in errors: print('ERROR:',x)
    print(f'FAILED: {len(errors)} error(s)')
    sys.exit(1)
print(f'PASS: {len(assets)} GLB models, {len(thumbs)} thumbnails, JSON/JS/catalog/file-reference checks OK')
