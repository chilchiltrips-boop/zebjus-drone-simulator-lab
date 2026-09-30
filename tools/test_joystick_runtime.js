/* Actual controller functions, fake device transport and simulator clock. No hardware required. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),school=fs.readFileSync(path.join(root,'school-lab.js'),'utf8');
function between(source,a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end)}
function node(){return{textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,style:{},className:'',classList:{add(){},remove(){},toggle(){}},querySelector:()=>null}}
const nodes=new Map();for(const id of ['webJoyTarget','joyTargetBadge','joyTargetNote','joyTargetHelp','joyConnectKitBtn','joyTargetSummary','schoolLog','webArmBtn','webArmMessage','simRunBtn'])nodes.set('#'+id,node());
nodes.set('#webJoyTarget option[value="device"]',node());nodes.get('#webJoyTarget').value='sim';
const $=s=>nodes.get(s)||null;
const commands=[];let client;
class Client{constructor(){client=this;this.connected=false;this.deviceId='';this.status=null}command(frame){commands.push(JSON.parse(JSON.stringify(frame)));return Promise.resolve({ok:true})}disconnect(){this.connected=false}}
const window={addEventListener(){},ZebjusDroneKit:{LocalKitClient:Client,sameDeviceIdentity:(a,b)=>!!a&&a===b},__zebjusAppLoaded:false};
const sandbox={window,document:{querySelector:$,querySelectorAll:()=>[],addEventListener(){},readyState:'loading'},localStorage:{getItem:()=>null,setItem(){}},location:{search:''},performance:{now:()=>1000},Date,console,setTimeout(){},setInterval(){},requestAnimationFrame(){},confirm(){throw Error('Controller ARM must not show a confirmation popup')}};
vm.createContext(sandbox);
const stateSource=between(app,'const state=','function normalizePidShape');
const ownership=between(app,"let simInputOwner='idle'",'const keyDefaults=');
const pidReset=between(app,'function resetSimControllersOnly()','function calibrateSimLevel()');
const start=between(app,'function startSimRuntime()','function toggleSimRun()');
const physics=between(app,'function advanceSimPhysics(','function simLoop(now)');
const pidAxes=between(app,'function wrapAngle(','function toggleDisturbMode()');
const rateHold=between(app,'function rateHoldTargetRate(','function advanceSimPhysics(');
vm.runInContext(stateSource+`
const $=globalThis.$,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const heldKeys=new Set(),keyMap={rollRight:'ArrowRight',rollLeft:'ArrowLeft',pitchForward:'ArrowUp',pitchBack:'ArrowDown',yawRight:'d',yawLeft:'a'};
const ensureSim=()=>true,setStickVisual=()=>{},updateStickText=()=>{},notify=()=>{},ensureMotorAudio=()=>{},ensureSimMotorBank=()=>{};
function activeRatePidKey(axis){return (state.sim.flightMode==='angle'?'angleRate':'rate')+axis}
let sLast=0;
`+ownership+pidReset+start+pidAxes+rateHold+physics+`
globalThis.simTest={state,claimSimInput,releaseSimInput,canMirrorReceiver,controlSimInput,startSimRuntime,resetSimControllersOnly,stepSimPhysics,owner:()=>simInputOwner};
`,Object.assign(sandbox,{$}));
let stopCount=0;window.zebjusLabAPI={controlSim:sandbox.simTest.controlSimInput,claimSimInput:sandbox.simTest.claimSimInput,releaseSimInput:sandbox.simTest.releaseSimInput,canMirrorReceiver:sandbox.simTest.canMirrorReceiver,getSimInputOwner:sandbox.simTest.owner,getActiveTab:()=> 'joystick',setSimFlightMode:m=>{sandbox.simTest.state.sim.flightMode=m},setSimRunning:on=>{if(on)sandbox.simTest.startSimRuntime();else{stopCount++;sandbox.simTest.state.sim.running=false}},setActiveTab(){}};
vm.runInContext(school.replace(/\}\)\(\);\s*$/,`window.controllerTest={st,targetUi,realKitAvailability,setTransmitter,tryToggleArm,joystickTick,enforceJoystickLink,switchJoystickTarget,applyPhysicalReceiver,telemetryTick};})();`),sandbox);
const ctl=window.controllerTest,sim=sandbox.simTest;
const kit={deviceId:'ZFC-001122334455',deviceName:'Kit 1',online:true,webRc:true,flightCoreIntegrated:true,flightReady:true,lockMine:true};
function choose(d){ctl.st.devices=[d];ctl.st.selectedDeviceId=d.deviceId;client.deviceId=d.deviceId;client.connected=true;client.status=d;ctl.targetUi()}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve()}
(async()=>{
 ctl.targetUi();assert.equal($('#webJoyTarget option[value="device"]').disabled,false,'Real kit must remain selectable without a connection');
 $('#webJoyTarget').value='device';ctl.setTransmitter(true);assert.equal(ctl.st.txOn,false,'disconnected real target cannot transmit');
 choose(kit);ctl.setTransmitter(true);ctl.tryToggleArm();assert.equal(ctl.st.joy[4],2000,'ready kit arms without popup');ctl.st.joy[2]=1450;ctl.joystickTick(2000);await flush();assert.equal(commands.at(-1).channels[4],2000,'real RC frame must reach the transport');assert.equal(sim.state.sim.running,true);
 const before=stopCount;for(let i=0;i<15;i++)ctl.applyPhysicalReceiver({rc:[1500,1500,1000,1500,1000,1000],rcSource:'PPM'});
 assert.equal(sim.state.sim.running,true,'disarmed receiver telemetry must not stop joystick simulation');assert.equal(sim.state.sim.throttle,1450,'receiver telemetry cannot overwrite local throttle');assert.equal(stopCount,before,'telemetry must not restart/silence the motor sound');
 kit.lockMine=false;ctl.enforceJoystickLink();assert.equal(ctl.st.txOn,false);assert.equal(ctl.st.joy[4],1000);assert.equal($('#webJoyTarget').value,'device','link loss must keep the selected real target');
 choose({...kit,lockMine:true,webRc:false,benchRc:false,flightCoreIntegrated:false});ctl.setTransmitter(true);assert.equal(ctl.st.txOn,false,'bridge profile must not gain RC capability from the previous kit');
 choose({...kit,lockMine:true,flightReady:false});assert.match(ctl.realKitAvailability().text,/not ready/);ctl.setTransmitter(true);assert.equal(ctl.st.txOn,false,'missing IMU readiness blocks transmitter');
 choose({...kit,lockMine:true,flightReady:true});ctl.setTransmitter(true);ctl.tryToggleArm();ctl.st.activeJoyTarget='device';$('#webJoyTarget').value='sim';ctl.switchJoystickTarget('sim');await flush();assert.equal(commands.at(-1).channels[2],1000);assert.equal(commands.at(-1).channels[4],1000,'changing target sends disarm to the old real target');
 sim.claimSimInput('tripod');sim.state.sim.running=true;sim.state.sim.throttle=1550;ctl.st.txOn=false;ctl.applyPhysicalReceiver({rc:[1700,1700,1000,1500,1000,1000],rcSource:'PPM'});assert.equal(sim.state.sim.throttle,1550);assert.equal(sim.state.sim.running,true,'receiver telemetry must not stop the Tripod RUN state');
 // Stale telemetry must only stop a receiver-owned simulation.
 ctl.st.receiverLastAt=Date.now()-2000;client.telemetry=async()=>({rcSource:'NONE',rcAgeMs:999999});window.zebjusLabAPI.receiveDevicePacket=()=>{};window.zebjusLabAPI.setFcConnected=()=>{};
 await ctl.telemetryTick(3000);assert.equal(sim.state.sim.running,true,'receiver loss must not stop local Tripod');
 sim.releaseSimInput('tripod');ctl.applyPhysicalReceiver({rc:[1600,1500,1300,1500,2000,1000],rcSource:'PPM'});assert.equal(sim.owner(),'receiver');assert.equal(sim.state.sim.throttle,1300);ctl.st.receiverLastAt=Date.now()-2000;await ctl.telemetryTick(4000);assert.equal(sim.state.sim.running,false,'receiver loss must stop a receiver mirror');
 // Test fixed-step response at 30, 60 and 120 display frames per second.
 function trajectory(fps){const context={window:{},performance:{now:()=>0},console,notify(){},setStickVisual(){}};vm.createContext(context);vm.runInContext(stateSource+`const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const heldKeys=new Set(),keyMap={};const SIM_PHYSICS_STEP=.004;let simAccumulator=0;function activeRatePidKey(axis){return (state.sim.flightMode==='angle'?'angleRate':'rate')+axis}`+pidReset+pidAxes+rateHold+physics+`state.sim.running=true;state.sim.throttle=1500;state.sim.cmdRoll=.3;resetSimControllersOnly();globalThis.tick=stepSimPhysics;globalThis.s=state.sim;`,context);for(let i=1;i<=fps*4;i++)context.tick(1/fps,i*1000/fps);return context.s.roll}
 const angles=[30,60,120].map(trajectory);assert(Math.max(...angles)-Math.min(...angles)<1e-6,'physics must match across display frame rates');assert(angles.every(Number.isFinite));
 sim.state.sim.running=false;sim.state.sim.rollI=100;sim.state.sim.prevRollErr=500;sim.state.sim.flightMode='rate';sim.state.sim.roll=12;sim.startSimRuntime();assert.equal(sim.state.sim.rollI,0);assert.equal(sim.state.sim.prevRollErr,null);assert.equal(sim.state.sim.rateHoldRoll,12,'Rate Hold restart captures the current attitude');
 const audioNodes={'#soundEnabled':node(),'#soundVolume':node()};let audioRestored=0,bankRestored=0;
 const audioSandbox={state:{sim:{running:true}},$:s=>audioNodes[s],localStorage:{setItem(){}},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),updateAudioUi(){},tone(){},stopTransientTones(){},destroyMotorAudio(){},destroySimMotorBank(){},ensureMotorAudio:()=>audioRestored++,ensureSimMotorBank:()=>bankRestored++};vm.createContext(audioSandbox);
 vm.runInContext("let soundEnabled=true,soundVolume=.5,wireMotorRun=false;const motorAudio={sim:{}};"+between(app,'function restoreRunningMotorAudio()','function initSettings()')+'initAudioSettings();',audioSandbox);
 audioNodes['#soundEnabled'].onchange({target:{checked:false}});audioNodes['#soundEnabled'].onchange({target:{checked:true}});assert.equal(audioRestored,1);assert.equal(bankRestored,1,'unmuting must restore running audio without Reset');
 // A fresh browser can discover a kit AP without mDNS or a cached kit name.
 const storage=new Map(),localWindow={dispatchEvent(){}};const kitSandbox={window:localWindow,URLSearchParams,AbortController,setTimeout,clearTimeout,performance,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:()=>null,setItem(){}},fetch:async url=>({ok:String(url).startsWith('http://192.168.4.1/'),status:String(url).startsWith('http://192.168.4.1/')?200:404,text:async()=>JSON.stringify({ok:true,kit:'ZEBJUS_FLIGHTCORE',name:'zebjus_drone_1',deviceId:'ZFC-001122334455',ip:'192.168.4.1',mode:'AP SETUP'})})};vm.createContext(kitSandbox);vm.runInContext(fs.readFileSync(path.join(root,'kit-local.js'),'utf8'),kitSandbox);
 const found=await localWindow.ZebjusDroneKit.scanDefaultKits({max:1});assert.equal(found.length,1);assert.equal(found[0].base,'http://192.168.4.1');
 await assert.rejects(localWindow.ZebjusDroneKit.connect('ZFC-FFFFFFFFFFFF','192.168.4.1','ZFC-FFFFFFFFFFFF'),/Device ID mismatch/);
 console.log('PASS: real target / popup-free ARM / RC routing / telemetry ownership / receiver loss / fixed-step timing / clean restart / audio restore / AP discovery');
})().catch(e=>{console.error(e);process.exitCode=1});
