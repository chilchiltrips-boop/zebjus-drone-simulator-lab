'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'tools/flight_app_source.html'),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a);return text.slice(a,b);}
let now=100000,paints=0,interrupts=0,stops=0,paused=0,notifyCount=0,nextRequest=async()=>{throw Error('temporary timeout')},timer=null;
const mode={base:'http://kit.test',id:'ZFC-001122334455',client:'app',token:'test-training',target:'TRIPOD',runId:3,good:1,failures:2};
const state={training:mode,tx:true,own:true,practiceBusy:false,txEpoch:4,lastAck:99980,base:mode.base,deviceId:mode.id,epoch:2,cleanup:Promise.resolve(),pending:null,modePending:null};
const native={pauseStream(base,id,client){assert.equal(base,mode.base);assert.equal(id,mode.id);assert.equal(client,'app');paused++;}};
const ctx={state,window:{AerionAndroid:native},document:{hidden:false},performance:{now:()=>now},setTimeout:fn=>{timer=fn;return 1},clearTimeout(){},setInterval(){},paint:()=>paints++,request:(...args)=>nextRequest(...args),interrupted:()=>interrupts++,stopControl:()=>stops++,cid:'app',channels:[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000],safeValues(){},notify:()=>notifyCount++};
vm.createContext(ctx);vm.runInContext(section(app,'let renderAt=','function paint(){')+section(app,'function confirmTrainingAck(','let controlRecordedAt=')+section(app,'let trainingPingBusy=false;','async function reserveMobile()'),ctx);
(async()=>{
 ctx.confirmTrainingAck({rcQueued:true,outputsBlocked:true,validatedControllerAck:false});assert.equal(mode.good,1,'queued input is not a controller ACK');
 ctx.confirmTrainingAck({rcQueued:true,outputsBlocked:true,validatedControllerAck:true});assert.equal(mode.good,state.lastAck);assert.equal(mode.failures,0);
 state.tx=false;now+=1500;await ctx.pingTraining();assert.equal(interrupts,0,'one timeout after a fresh native stream must allow retry');assert.equal(mode.failures,1);
 let reject;nextRequest=()=>new Promise((_,bad)=>reject=bad);const pending=ctx.pingTraining();state.tx=true;state.txEpoch++;reject(Error('late paused ping'));await pending;assert.equal(interrupts,0);assert.equal(mode.failures,1,'late paused errors cannot affect a resumed stream');
 state.tx=false;now=mode.good+5001;nextRequest=async()=>{throw Error('timeout')};await ctx.pingTraining();assert.equal(interrupts,1,'a genuinely expired paused reservation still stops');
 nextRequest=async()=>({active:true,outputsBlocked:true,target:mode.target,runId:mode.runId});await ctx.pingTraining();assert.equal(mode.good,now);assert.equal(mode.failures,0);
 for(let i=0;i<50;i++)ctx.render();assert.equal(paints,1,'render bursts are bounded');assert(timer);now+=101;timer();assert.equal(paints,2);
 ctx.render(true);assert.equal(paints,3,'a discrete safety update paints immediately');
 // STOP pauses the native publisher before waiting for outstanding replies.
 vm.runInContext(section(app,"function stopControl(message='',offline=false)",'async function connect('),ctx);
 let releasePending;state.own=state.tx=true;state.training=mode;state.pending=new Promise(resolve=>releasePending=resolve);const calls=[];nextRequest=async(base,route)=>{calls.push(route);return {}};
 ctx.stopControl('User STOP');assert.equal(paused,1);assert.equal(state.tx,false);assert.equal(calls.length,0);releasePending({});await state.cleanup;assert(calls.includes('/api/control/release'));assert.equal(notifyCount,1);
 // Delayed watchdog callbacks after an intentional STOP cannot restart recovery.
 const callbacks=section(app,' window.AerionAndroid.stopped=client=>',' window.AerionAndroid.connectedWifi=');
 ctx.appRecorder={event(){}};vm.runInContext(callbacks,ctx);const before=interrupts;
 state.own=false;state.resumeControl=false;native.stopped('app');assert.equal(interrupts,before);
 state.own=true;native.stopped('another-session');assert.equal(interrupts,before);
 native.stopped('app');assert.equal(interrupts,before+1,'a genuine native stop is still handled');
 // High-rate channel updates retain DOM nodes and apply the newest value.
 const school=fs.readFileSync(path.join(root,'school-lab.js'),'utf8');let rebuilds=0;
 const grid={children:[],set innerHTML(value){rebuilds++;this.children=Array.from({length:10},()=>{const values={b:{textContent:''},i:{style:{setProperty(name,value){this[name]=value}}}};return{querySelector:name=>values[name]};});}};
 const joy={st:{joy:[...ctx.channels],remoteTxOn:true},document:{activeElement:null},$:(id)=>id==='#webChannelGrid'?grid:null,setJoyKnob(){},updateArmGuidance(){},updateTxIndicators(){},targetUi(){}};
 vm.createContext(joy);vm.runInContext(section(school,'function renderJoy(){','function setTransmitter('),joy);joy.renderJoy();const nodes=[...grid.children];
 for(let i=0;i<50;i++){joy.st.joy[0]=1500+i;joy.renderJoy();}
 assert.equal(rebuilds,1);assert.equal(grid.children[0],nodes[0]);assert.equal(Number(grid.children[0].querySelector('b').textContent),1549);assert.equal(grid.children[0].querySelector('i').style['--p'],'54.9%');
 console.log('PASS: app ACK freshness, paused/resumed heartbeat fencing, real expiry, bounded UI painting, immediate native STOP, late callback isolation and reused channel DOM');
})().catch(e=>{console.error(e);process.exitCode=1});
