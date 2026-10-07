'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const school=fs.readFileSync('school-lab.js','utf8'),app=fs.readFileSync('tools/flight_app_source.html','utf8');
function section(s,a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));}
let calls=0;const d={online:true,controlRole:'MOBILE'},ctx={selected:()=>d,selectedConnected:()=>true,client:{base:'http://kit',status:{},refresh:()=>calls++,telemetry:()=>calls++},st:{},rcMonitor:{update(){},live:false},expireReceiverMirror(){},performance,networkNotice(){},setInterval(){},window:{},document:{hidden:false},api:()=>null};vm.createContext(ctx);
vm.runInContext(section(school,'function exclusiveMobileSession()','async function lockTick(')+section(school,'async function healthRefresh(','function seedPreferredDevice(')+section(school,'async function lockTick(','const webStickHandles='),ctx);
(async()=>{await ctx.telemetryTick(10000);await ctx.healthRefresh(true);await ctx.lockTick(10000);assert.equal(calls,0,'failed monitor cannot trigger any fallback HTTP under MOBILE');
let now=1000,native={streaming:true,validatedControllerAck:true,ackAgeMs:650,outputsBlocked:true,trainingRunId:11},offered=[],stops=0,requests=0;
const state={own:true,tx:true,practiceBusy:false,selectedTarget:'FLIGHT',training:{runId:11,target:'FLIGHT'},lastAck:1000,lastFrame:1000,preciseThrottle:1700,status:{},recovering:false};
const tickCtx={state,window:{AerionAndroid:{rcDiagnostics:()=>native,offerInput:(b,id,c,ch,run)=>offered.push({ch:[...ch],run})}},appRecorder:{control(){}},Date,performance:{now:()=>now},clamp:(n,l,h)=>Math.max(l,Math.min(h,n)),channels:[1800,1200,1700,1600,2000,1000,1000,1000,1500,1000],sticks:{left:{y:0,pointer:null}},held:new Set(),cid:'MOBILE-test',AerionSticks:{shape:x=>x,settings:()=>({throttleSpeed:500})},ackDeadline:()=>8000,interrupted:()=>stops++,stopControl:()=>stops++,safeValues(){this.channels.splice(0,10,1500,1500,1000,1500,1000,1000,1000,1000,1500,1000);state.preciseThrottle=1000;},notify(){},render(){},sendFrame:()=>requests++,setInterval(){}};
// Avoid relying on VM receiver for the extracted production safe-values callback.
tickCtx.safeValues=()=>{tickCtx.channels.splice(0,10,1500,1500,1000,1500,1000,1000,1000,1000,1500,1000);state.preciseThrottle=1000;};vm.createContext(tickCtx);vm.runInContext(section(app,'let controlRecordedAt=0;','let refreshing=false;'),tickCtx);
now=1700;tickCtx.tick();assert.equal(stops,0);assert(state.simLinkPaused);assert.equal(offered.at(-1).ch[2],1000);assert.equal(requests,0);assert.equal(state.training.runId,11);
now=5000;native.ackAgeMs=4000;tickCtx.tick();assert.equal(stops,0);assert.equal(state.training.runId,11);
now=5100;native.ackAgeMs=10;tickCtx.tick();assert.equal(state.simLinkPaused,false);assert.equal(tickCtx.channels[4],1000,'same-run recovery requires manual virtual ARM');assert.equal(state.training.runId,11);
now=14000;native.ackAgeMs=9000;tickCtx.tick();assert.equal(stops,1,'hard expiry still fences');console.log('PASS: production exclusive polling gate and same-run app ACK-gap neutral/recovery/hard-expiry');})().catch(e=>{console.error(e);process.exitCode=1});
