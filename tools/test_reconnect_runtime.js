'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),storage=new Map(),session=new Map(),requests=[];
const ID='ZFC-001122334455',OTHER='ZFC-FFEEDDCCBBAA';
let network=new Map();
function status(id=ID,ip='10.0.0.9'){return{ok:true,kit:'ZEBJUS_FLIGHTCORE',name:'zebjus_drone_1',deviceId:id,ip,armed:false,lockMine:false,webRc:true,flightReady:true}}
const window={addEventListener(){},dispatchEvent(){}};
const sandbox={window,URLSearchParams,AbortController,setTimeout,clearTimeout,performance,Date,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},fetch:async(url,opt)=>{
 const u=new URL(url),st=network.get(u.origin);requests.push({url,data:Object.fromEntries(new URLSearchParams(opt?.body))});
 if(!st)throw new TypeError('unreachable');
 if(u.pathname!=='/api/status')assert.equal(requests.at(-1).data.expectedDeviceId,ID,'mutation must carry physical ID');
 return{ok:true,status:200,text:async()=>JSON.stringify(u.pathname==='/api/status'?st:{ok:true})};
}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'kit-local.js'),'utf8'),sandbox);
const kit=window.ZebjusDroneKit;
function node(){return{textContent:'',innerHTML:'',value:'',style:{},setAttribute(){},classList:{toggle(){}},matches:()=>false}}
const nodes=new Map([['#webJoyTarget',{...node(),value:'sim'}]]);
let stopped=0,commands=0;
Object.assign(sandbox,{document:{querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[],addEventListener(){},readyState:'loading'},location:{search:''},requestAnimationFrame(){},setInterval(){}});
window.zebjusStopPythonForSafety=()=>stopped++;
window.zebjusLabAPI={setFcConnected(){},controlSim(){},setSimRunning(){}};
vm.runInContext(fs.readFileSync(path.join(root,'school-lab.js'),'utf8').replace(/\}\)\(\);\s*$/,`window.test={st,client,loadPrefs,seedPreferredDevice,reconnectTick,reconcileSelection,disconnectKit,markSelectedOffline,selectDevice,commandDevice};})();`),sandbox);
const c=window.test;
(async()=>{
 network.set('http://10.0.0.9',status());
 const client=new kit.LocalKitClient();await client.connect('zebjus_drone_1','10.0.0.9');
 await client.acquire();await client.heartbeat();await client.release();
 const cid=client.clientId;
 network=new Map([['http://10.0.0.9',status(OTHER)],['http://192.168.4.1',status(ID,'192.168.4.1')]]);
 client.disconnect();await client.reconnect(1);assert.equal(client.base,'http://192.168.4.1');assert.equal(client.deviceId,ID,'stale DHCP address cannot rebind another board');
 network=new Map([['http://10.0.0.20',status(ID,'10.0.0.20')],['http://zebjus-drone-1.local',status(ID,'10.0.0.20')]]);
 client.disconnect();await client.reconnect(1);assert.equal(client.deviceId,ID,'AP to STA reconnect must follow mDNS');
 storage.set('zebjusV183LastKit',ID);storage.set('zebjusV183LastKitName','zebjus_drone_1');storage.set('zebjusV183KitQuery','zebjus_drone_1');
 c.loadPrefs();c.seedPreferredDevice();await c.reconnectTick(true);
 assert.equal(c.client.clientId,cid,'refresh keeps the same tab session');assert.equal(c.st.selectedDeviceId,ID);assert.equal(c.st.txOn,false);assert.equal(c.st.pythonRcActive,false,'refresh must not resume Python');
 const mutations=requests.filter(r=>r.url.includes('/api/control/acquire')).length;
 c.disconnectKit(false);network=new Map([['http://192.168.4.1',status(ID,'192.168.4.1')]]);await c.reconnectTick(true);
 assert.equal(c.client.base,'http://192.168.4.1','software mode switch retains reconnect intent');
 assert.equal(requests.filter(r=>r.url.includes('/api/control/acquire')).length,mutations,'automatic recovery is view only');
 c.markSelectedOffline();network=new Map([['http://192.168.4.1',status(OTHER,'192.168.4.1')]]);await c.reconnectTick(true);assert.equal(c.client.connected,false);
 c.st.devices=[{...status(OTHER),deviceName:'zebjus_drone_1',online:true}];c.st.selectedDeviceId='';c.reconcileSelection();assert.equal(c.st.selectedDeviceId,'','sole same-name wrong board must not be selected');
 c.disconnectKit(true);const count=requests.length;await c.reconnectTick(true);assert.equal(requests.length,count,'manual disconnect stops automatic retries');
 await assert.rejects(c.commandDevice({type:'rc_frame'},{expectedDeviceId:ID,requireOwned:true}),/another Device ID|lock lost/);assert(stopped>0);
 // An old status response must not undo a user disconnect.
 let resolve;const oldFetch=sandbox.fetch;sandbox.fetch=()=>new Promise(r=>resolve=r);
 client.base='http://192.168.4.1';const pending=client.refresh();client.disconnect();resolve({ok:true,status:200,text:async()=>JSON.stringify(status())});await assert.rejects(pending,/cancelled/);assert(!client.connected);sandbox.fetch=oldFetch;
 console.log('PASS: stale IP / same-ID AP↔STA / refresh / restart / no auto control or Python / wrong kit / manual disconnect / cancelled request');
})().catch(e=>{console.error(e);process.exitCode=1});
