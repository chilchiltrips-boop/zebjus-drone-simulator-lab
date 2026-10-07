'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'flight_app_source.html'),'utf8'),ID='ZFC-001122334455';
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a);assert(a>=0&&b>a);return app.slice(a,b);}
function deferred(){let resolve,reject;const promise=new Promise((good,bad)=>{resolve=good;reject=bad});return{promise,resolve,reject};}
function harness(){
 const calls=[],messages=[],fc={owner:'web',run:4,active:false},channels=[1700,1600,1300,1500,2000,1000,1000,1000,1500,1000];let paused=0,session=0;
 const state={base:'http://kit.test',deviceId:ID,online:true,own:true,tx:true,busy:false,epoch:3,txEpoch:8,destinationIntent:0,manual:false,status:{armed:false,trainingActive:true,securityRequired:true},pending:null,cleanup:Promise.resolve(),training:{base:'http://kit.test',id:ID,client:'old-app',token:'old-mode',runId:3,target:'FLIGHT'},practiceBusy:false,modePending:null,resumeControl:false};
 const ctx={state,channels,cid:'old-app',window:{AerionAndroid:{pauseStream(){paused++;}}},document:{hidden:false},performance:{now:()=>10000},crypto:{randomUUID:()=>String(fc.run+1)},encodeURIComponent,Promise,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),render(){},notify:message=>messages.push(message),write(){},newSession:()=>`new-app-${++session}`,appRecorder:{event(){}},$:()=>({textContent:''}),safeValues(){channels[0]=channels[1]=channels[3]=1500;channels[2]=channels[4]=1000;},validate:s=>{assert.equal(s.deviceId,ID);return s;}};
 const status=()=>({ok:true,securityRequired:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:ID,armed:false,trainingActive:fc.active,lockMine:fc.owner===ctx.cid,locked:!!fc.owner,controlRole:fc.owner==='web'?'WEB':'MOBILE'});
 const training=()=>({supported:true,selectionSupported:true,simulationRcProtocol:'ZRC2',active:fc.active,outputsBlocked:fc.active,target:fc.active?'TRIPOD':'NONE',runId:fc.run});
 let handler=async(base,route,data)=>{
  if(route.startsWith('/api/status'))return status();
  if(route==='/api/control/release'){if(fc.owner===data.clientId)fc.owner='';return{ok:true};}
  if(route==='/api/control/acquire'){fc.owner=data.clientId;return{ok:true,deviceId:ID,lockMine:true,controlRole:'MOBILE',rcTimeoutMs:1000,rcUdpPort:4210,rcProtocol:'ZRC2',simulationOutputsBlocked:fc.active,simulationRcTransport:'UDP',trainingRunId:fc.run};}
  if(data.type==='training_status')return training();
  if(data.type==='training_end')return{ok:true};
  if(data.type==='training_select'){assert.equal(data.clientId,fc.owner);fc.active=true;fc.run++;return training();}
  if(data.type==='rc_frame'){if(data.clientId!==fc.owner)throw Object.assign(Error('Control lost'),{status:423});fc.channels=data.channels.split(',').map(Number);return{ok:true,deviceId:ID,outputsBlocked:fc.active,validatedControllerAck:true};}
  throw Error('Unexpected route '+route);
 };
 ctx.request=(...args)=>{calls.push(args);return handler(...args);};ctx.api=(route,data,timeout)=>ctx.request(state.base,route,data,timeout,ID);
 vm.createContext(ctx);vm.runInContext(section("function stopControl(message='',offline=false)",'async function connect(')+section('async function sendFrame(){','let controlRecordedAt=')+section('async function selectDestination(target,recovery=false){',"document.querySelectorAll('[data-destination]')")+section('async function reserveMobile(){','const kitConsole='),ctx);
 return{ctx,state,fc,calls,messages,get paused(){return paused;},setHandler:fn=>{const previous=handler;handler=(...args)=>fn(previous,...args);}};
}
(async()=>{
 // A phone still remembers its grant after the web took and released control.
 // Its already pending old RC error arrives while the new selection starts.
 const h=harness(),old=deferred();let first=true;
 h.setHandler((normal,...args)=>{if(args[2]?.type==='rc_frame'&&first){first=false;return old.promise;}return normal(...args);});
 const frame=h.ctx.sendFrame(),selection=h.ctx.selectDestination('TRIPOD');
 assert.equal(h.state.tx,false);assert(h.paused>0);old.reject(Object.assign(Error('Old grant revoked'),{status:423}));
 await Promise.all([frame,selection]);assert(h.state.own&&h.state.tx);assert.equal(h.state.training.target,'TRIPOD');assert.equal(h.fc.owner,h.ctx.cid);assert.notEqual(h.ctx.cid,'old-app');assert.deepEqual(h.fc.channels.slice(0,5),[1500,1500,1000,1500,1000]);assert.equal(h.calls.filter(c=>c[1]==='/api/control/acquire').length,2,'reacquire a reservation and a scoped simulator grant');
 assert(h.calls.some(c=>c[1].startsWith('/api/status')&&c[1].includes('old-app')),'verify the remembered ownership before reusing it');
 // A valid existing reservation is retained, with only the simulator grant.
 const retained=harness();retained.fc.owner=retained.ctx.cid;retained.state.tx=false;retained.state.training=null;retained.state.status.trainingActive=false;retained.ctx.safeValues();
 await retained.ctx.selectDestination('TRIPOD');assert(retained.state.tx);assert.equal(retained.calls.filter(c=>c[1]==='/api/control/acquire').length,1);
 // STOP while recovery is waiting for ownership must survive a late error.
 const stopped=harness(),held=deferred();stopped.ctx.safeValues();stopped.state.resumeControl=true;stopped.setHandler((normal,...args)=>args[1].startsWith('/api/status')?held.promise:normal(...args));
 const recovery=stopped.ctx.selectDestination('TRIPOD',true);for(let i=0;i<20&&!stopped.calls.some(c=>c[1].startsWith('/api/status'));i++)await Promise.resolve();assert(stopped.calls.some(c=>c[1].startsWith('/api/status')));stopped.ctx.stopControl('User STOP');held.reject(Error('Late status timeout'));await recovery;await stopped.state.cleanup;
 assert(!stopped.state.own&&!stopped.state.tx&&!stopped.state.resumeControl);assert.equal(stopped.calls.filter(c=>c[2]?.type==='training_select').length,0);assert.equal(stopped.state.practiceBusy,false);
 // STOP while cleanup of the revoked grant is pending cannot acquire again.
 const cancelled=harness(),release=deferred();cancelled.setHandler((normal,...args)=>args[1]==='/api/control/release'?release.promise:normal(...args));
 const destination=cancelled.ctx.selectDestination('TRIPOD');for(let i=0;i<20&&!cancelled.calls.some(c=>c[1]==='/api/control/release');i++)await Promise.resolve();assert(cancelled.calls.some(c=>c[1]==='/api/control/release'));cancelled.ctx.stopControl();release.resolve({ok:true});await destination;
 assert(!cancelled.state.tx&&!cancelled.state.own);assert.equal(cancelled.calls.filter(c=>c[1]==='/api/control/acquire').length,0);
 // A destination change cannot lower an armed real-flight command implicitly.
 const armed=harness();armed.state.status.trainingActive=false;await armed.ctx.selectDestination('TRIPOD');assert.equal(armed.paused,0);assert.equal(armed.calls.length,0);assert(armed.messages.some(x=>x.includes('Disarm real motors')));
 console.log('PASS: revoked mobile ownership reacquired before selection, old RC callback fenced, valid lease retained, STOP cancels pending recovery/cleanup and real ARM blocks destination changes');
})().catch(error=>{console.error(error);process.exitCode=1;});
