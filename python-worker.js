'use strict';
const PYODIDE_URL='https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js';
let py=null,runTarget='sim',rpcSeq=0,latestCameraJpeg='';const pending=new Map();
const send=(type,data={})=>postMessage({type,...data});
function rpc(method,args={}){return new Promise((resolve,reject)=>{const id=`rpc-${++rpcSeq}`;pending.set(id,{resolve,reject});send('rpc',{id,method,args,target:runTarget})})}
self.zebjusBridge={
 target:()=>runTarget,
 stopRequested:()=>false,
 attitude:()=>rpc('attitude'),
 status:()=>rpc('status'),
 i2cScan:()=>rpc('i2cScan'),
 imuRead:()=>rpc('imuRead'),
 command:(type,payload='{}')=>rpc('command',{type:String(type),payload:String(payload||'{}')}),
 keyboardState:()=>rpc('keyboardState'),
 cameraFrame:()=>rpc('cameraFrame'),
 handLandmarks:()=>rpc('handLandmarks'),
 latestCameraFrame:()=>latestCameraJpeg,
 emitImage:(base64,mimeType='image/png',title='Python output')=>send('image',{base64:String(base64),mimeType:String(mimeType),title:String(title)})
};
const PRELUDE=`import sys, types, json, asyncio, os\nos.environ["MPLBACKEND"] = "Agg"\nfrom js import zebjusBridge as _zebjus_bridge\n\nif "/home/pyproject" not in sys.path:\n    sys.path.insert(0, "/home/pyproject")\n\n_zebjus_module = types.ModuleType("zebjus")\n\nclass Drone:\n    def target(self): return str(_zebjus_bridge.target())\n    def stop_requested(self): return False\n    async def _command(self, command, **data):\n        raw = await _zebjus_bridge.command(command, json.dumps(data))\n        return json.loads(str(raw))\n    async def status(self):\n        raw = await _zebjus_bridge.status(); return json.loads(str(raw))\n    async def i2c_scan(self):\n        if self.target() != "real": raise RuntimeError("Hardware I2C is unavailable while Python target is Simulator.")\n        raw = await _zebjus_bridge.i2cScan(); return json.loads(str(raw))\n    async def imu(self):\n        if self.target() != "real": raise RuntimeError("Hardware IMU is unavailable while Python target is Simulator.")\n        last_error = None\n        for _ in range(3):\n            try:\n                raw = await _zebjus_bridge.imuRead(); return json.loads(str(raw))\n            except Exception as exc:\n                last_error = exc; await asyncio.sleep(0.06)\n        raise RuntimeError("IMU read failed after retries: " + str(last_error))\n    async def gyro(self): return (await self.imu())["gyro"]\n    async def accel(self): return (await self.imu())["accel"]\n    async def attitude(self): return await self._command("attitude_read")\n    async def receiver(self): return await self._command("receiver_read")\n    async def ppm(self): return await self.receiver()\n    async def pid_get(self): return await self._command("pid_get")\n    async def restore_pid_defaults(self): return await self._command("pid_defaults")\n    async def set_rate_pid(self, roll=None, pitch=None, yaw=None):\n        d={}\n        for name,vals in (("rateRoll",roll),("ratePitch",pitch),("rateYaw",yaw)):\n            if vals is not None: d[name+"P"],d[name+"I"],d[name+"D"]=vals\n        return await self._command("pid_set", **d)\n    async def set_angle_pid(self, outer_roll=None, outer_pitch=None, inner_roll=None, inner_pitch=None, inner_yaw=None):\n        d={}\n        for name,vals in (("angleRoll",outer_roll),("anglePitch",outer_pitch),("angleRateRoll",inner_roll),("angleRatePitch",inner_pitch),("angleRateYaw",inner_yaw)):\n            if vals is not None: d[name+"P"],d[name+"I"],d[name+"D"]=vals\n        return await self._command("pid_set", **d)\n    async def rc(self, roll=1500, pitch=1500, throttle=1000, yaw=1500, arm=False, mode="angle", extra=None):\n        ch=[int(roll),int(pitch),int(throttle),int(yaw),2000 if arm else 1000,1500 if str(mode).lower()=="rate" else 1000,1000,1000,1500,1000]\n        if extra:\n            for i,v in enumerate(extra[:4],start=6): ch[i]=int(v)\n        return await self._command("rc_frame", channels=ch)\n    async def keys(self):\n        raw=await _zebjus_bridge.keyboardState(); return json.loads(str(raw))\n    async def camera_frame(self):\n        import base64\n        raw = await _zebjus_bridge.cameraFrame()\n        return base64.b64decode(str(raw))\n    async def hands(self):\n        raw = await _zebjus_bridge.handLandmarks()\n        return json.loads(str(raw))\n    async def wait_key(self, milliseconds=30):\n        await asyncio.sleep(max(0.02, min(float(milliseconds)/1000, 1.0)))\n        return -1\n    def show_plot(self, figure=None):\n        import io, base64, matplotlib\n        matplotlib.use("Agg", force=True)\n        import matplotlib.pyplot as plt\n        fig = figure if figure is not None else plt.gcf()\n        buf = io.BytesIO()\n        fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")\n        _zebjus_bridge.emitImage(base64.b64encode(buf.getvalue()).decode("ascii"), "image/png")\n    def show_image(self, frame, title="OpenCV output"):\n        import base64, cv2\n        ok, encoded = cv2.imencode(".jpg", frame)\n        if not ok: raise RuntimeError("OpenCV could not encode this image")\n        _zebjus_bridge.emitImage(base64.b64encode(encoded.tobytes()).decode("ascii"), "image/jpeg", title)\n    async def motor_test(self, motor=1, pulse=1200, duration_ms=700, confirm=""): return await self._command("motor_test", motor=motor, pulse=pulse, durationMs=duration_ms, confirm=confirm)\n    async def motor_stop(self): return await self._command("motor_stop")\n    async def motor_order_test(self, confirm=""): return await self._command("motor_order_test", confirm=confirm)\n    async def esc_calibrate(self, confirm=""): return await self._command("esc_calibrate", confirm=confirm)\n    async def bench_status(self): return await self._command("bench_status")\n    async def get_calibration(self): return await self._command("calibration_get")\n    async def set_accel_offsets(self, x, y, z, trim_roll=0.0, trim_pitch=0.0): return await self._command("calibration_set", accelOffsetX=x, accelOffsetY=y, accelOffsetZ=z, levelTrimRoll=trim_roll, levelTrimPitch=trim_pitch)\n    async def level_calibrate(self, samples=400): return await self._command("level_calibrate", samples=int(samples))\n    async def restore_calibration_defaults(self): return await self._command("calibration_defaults")\n    async def calibrate_gyro(self): return await self._command("calibrate_gyro")\n    async def pinmap_get(self): return await self._command("pinmap_get")\n    async def motor_map_get(self): return await self.pinmap_get()\n    async def motor_map_set(self, slots=("D1", "D2", "D3", "D0")):\n        if sorted(str(x).upper() for x in slots) != ["D0", "D1", "D2", "D3"]: raise ValueError("Assign D0-D3 exactly once to M1-M4")\n        return await self._command("motor_map_set", **{"m"+str(i+1)+"slot":int(str(v)[1]) for i,v in enumerate(slots)})\n    async def ppm_config(self, edge="RISING", reverse=(False,False,False,False)):\n        if len(reverse)!=4: raise ValueError("Specify roll, pitch, throttle, yaw reversals")\n        return await self._command("ppm_config", edge=str(edge).upper(), **{"reverse"+str(i):int(bool(v)) for i,v in enumerate(reverse)})\n    async def i2c_read(self, address, reg, length=1): return await self._command("i2c_read", address=int(address), reg=int(reg), length=int(length))\n    async def i2c_write(self, address, reg, values): return await self._command("i2c_write", address=int(address), reg=int(reg), bytes=",".join(str(int(x)) for x in values))\n    async def servo_config(self, pin): return await self._command("servo_config", pin=int(pin))\n    async def servo_write(self, pulse_us=1500): return await self._command("servo_write", pulseUs=int(pulse_us))\n    async def gps_config(self, pin): return await self._command("gps_config", pin=int(pin))\n    async def gps_read(self): return await self._command("gps_read")\n    async def matrix_config(self, address=0x70): return await self._command("matrix_config", address=int(address))\n    async def matrix_write(self, rows):\n        if len(rows)!=8: raise ValueError("Specify eight rows of 0-255")\n        return await self._command("matrix_write", rows=",".join(str(int(x)) for x in rows))\n    async def matrix_read(self): return await self._command("matrix_read")\n    async def gpio_read(self, pin): return await self._command("gpio_read", pin=int(pin))\n    async def gpio_write(self, pin, value): return await self._command("gpio_write", pin=int(pin), value=int(bool(value)))\n    async def gpio_release(self, pin): return await self._command("gpio_release", pin=int(pin))\n\n\n_zebjus_module.Drone=Drone\nsys.modules["zebjus"]=_zebjus_module\n`;
async function ensurePy(){if(py)return py;send('status',{text:'Loading Python 3 runtime…'});importScripts(PYODIDE_URL);py=await loadPyodide();py.setStdout({batched:x=>send('stdout',{text:String(x)+(String(x).endsWith('\n')?'':'\n')})});py.setStderr({batched:x=>send('stderr',{text:String(x)+(String(x).endsWith('\n')?'':'\n')})});py.setStdin({stdin:()=>'',isatty:false});await py.runPythonAsync(PRELUDE,{filename:'zebjus_runtime.py'});return py}
function writeFiles(files){try{py.FS.mkdirTree('/home/pyproject')}catch{}for(const [name,code] of Object.entries(files||{})){py.FS.writeFile(`/home/pyproject/${name}`,String(code??''))}}
async function run(msg){
 runTarget=msg.target==='real'?'real':'sim';
 try{
  await ensurePy();writeFiles(msg.files||{});
  const original=String(msg.code||'');
  if(/^\s*(?:import|from)\s+(?:mediapipe|cvzone|HandTrackingModule|SerialModule)\b/m.test(original))throw new Error('Native mediapipe/cvzone/serial Python modules run in python_companion on a laptop. In browser Python use await drone.hands() and await drone.camera_frame().');
  send('status',{text:'Loading Python imports…'});
  await py.loadPackagesFromImports(original);
  if(/\b(?:matplotlib|show_plot)\b/.test(original)){
   await py.loadPackage('matplotlib');
   await py.runPythonAsync(`import matplotlib
matplotlib.use("Agg", force=True)
import matplotlib.pyplot as plt
from zebjus import Drone

def _zebjus_plot_show(*_args, **_kwargs):
    for figure_number in plt.get_fignums():
        Drone().show_plot(plt.figure(figure_number))

plt.show = _zebjus_plot_show`);
  }
  if(/\b(?:cv2|VideoCapture|imshow|show_image)\b/.test(original)){
   await py.loadPackage('opencv-python');
   const response=await fetch('./python_companion/browser_cv2.py',{cache:'no-store'});
   if(!response.ok)throw new Error('Browser OpenCV adapter is missing from the project');
   await py.runPythonAsync(await response.text(),{filename:'browser_cv2.py'});
  }
  let code=original;
  if(/\bcv2\.VideoCapture\s*\(/.test(code)&&/\bcv2\.waitKey\s*\(/.test(code)&&!/^\s*(?:async\s+)?def\s+/m.test(code)){
   code=code.replace(/\bcv2\.waitKey\s*\(/g,'await drone.wait_key(');
   await py.runPythonAsync('from zebjus import Drone\ndrone = Drone()');
   send('status',{text:'Browser camera loop: waitKey yields for live frames'});
  }
  send('started',{filename:msg.filename});
  const result=await py.runPythonAsync(code,{filename:msg.filename||'main.py'});
  if(result!==undefined&&result!==null)send('stdout',{text:`=> ${String(result)}\n`});
  send('done',{filename:msg.filename});
 }catch(e){send('error',{filename:msg.filename,error:String(e?.stack||e?.message||e)})}
}

onmessage=e=>{const m=e.data||{};if(m.type==='run'){run(m);return}if(m.type==='camera-frame'){latestCameraJpeg=String(m.jpeg||'');return}if(m.type==='rpc-result'){const q=pending.get(m.id);if(!q)return;pending.delete(m.id);m.ok?q.resolve(m.value):q.reject(new Error(m.error||'Hardware bridge error'));}}
