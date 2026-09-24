'use strict';
const PYODIDE_URL='https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js';
let py=null,runTarget='sim',rpcSeq=0;const pending=new Map();
const send=(type,data={})=>postMessage({type,...data});
function rpc(method,args={}){return new Promise((resolve,reject)=>{const id=`rpc-${++rpcSeq}`;pending.set(id,{resolve,reject});send('rpc',{id,method,args,target:runTarget})})}
self.zebjusBridge={
 target:()=>runTarget,
 stopRequested:()=>false,
 attitude:()=>rpc('attitude'),
 status:()=>rpc('status'),
 i2cScan:()=>rpc('i2cScan'),
 imuRead:()=>rpc('imuRead'),
 command:(type,payload='{}')=>rpc('command',{type:String(type),payload:String(payload||'{}')})
};
const PRELUDE=`import sys, types, json, asyncio\nfrom js import zebjusBridge as _zebjus_bridge\n\nif "/home/pyproject" not in sys.path:\n    sys.path.insert(0, "/home/pyproject")\n\n_zebjus_module = types.ModuleType("zebjus")\n\nclass Drone:\n    def target(self):\n        return str(_zebjus_bridge.target())\n\n    def stop_requested(self):\n        return False\n\n    async def status(self):\n        raw = await _zebjus_bridge.status()\n        return json.loads(str(raw))\n\n    async def i2c_scan(self):\n        if self.target() != "real":\n            raise RuntimeError("Hardware I2C is unavailable while Python target is Simulator.")\n        raw = await _zebjus_bridge.i2cScan()\n        return json.loads(str(raw))\n\n    async def imu(self):\n        if self.target() != "real":\n            raise RuntimeError("Hardware IMU is unavailable while Python target is Simulator.")\n        last_error = None\n        for _ in range(3):\n            try:\n                raw = await _zebjus_bridge.imuRead()\n                return json.loads(str(raw))\n            except Exception as exc:\n                last_error = exc\n                await asyncio.sleep(0.06)\n        raise RuntimeError("IMU read failed after retries: " + str(last_error))\n\n    async def gyro(self):\n        return (await self.imu())["gyro"]\n\n    async def accel(self):\n        return (await self.imu())["accel"]\n\n_zebjus_module.Drone = Drone\nsys.modules["zebjus"] = _zebjus_module\n`;
async function ensurePy(){if(py)return py;send('status',{text:'Loading Python 3 runtime…'});importScripts(PYODIDE_URL);py=await loadPyodide();py.setStdout({batched:x=>send('stdout',{text:String(x)+(String(x).endsWith('\n')?'':'\n')})});py.setStderr({batched:x=>send('stderr',{text:String(x)+(String(x).endsWith('\n')?'':'\n')})});py.setStdin({stdin:()=>'',isatty:false});await py.runPythonAsync(PRELUDE,{filename:'zebjus_runtime.py'});return py}
function writeFiles(files){try{py.FS.mkdirTree('/home/pyproject')}catch{}for(const [name,code] of Object.entries(files||{})){py.FS.writeFile(`/home/pyproject/${name}`,String(code??''))}}
async function run(msg){runTarget=msg.target==='real'?'real':'sim';try{await ensurePy();writeFiles(msg.files||{});try{await py.loadPackagesFromImports(msg.code||'')}catch(_){}send('started',{filename:msg.filename});const result=await py.runPythonAsync(String(msg.code||''),{filename:msg.filename||'main.py'});if(result!==undefined&&result!==null)send('stdout',{text:`=> ${String(result)}\n`});send('done',{filename:msg.filename})}catch(e){send('error',{filename:msg.filename,error:String(e?.stack||e?.message||e)})}}
onmessage=e=>{const m=e.data||{};if(m.type==='run'){run(m);return}if(m.type==='rpc-result'){const q=pending.get(m.id);if(!q)return;pending.delete(m.id);m.ok?q.resolve(m.value):q.reject(new Error(m.error||'Hardware bridge error'));}}
