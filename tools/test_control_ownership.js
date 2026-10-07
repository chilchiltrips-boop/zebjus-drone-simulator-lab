'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ID='ZFC-001122334455',base='http://kit.test',status={ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:ID,name:'Lab kit',locked:false,lockMine:false,controlRole:''};
let route=async()=>new Response(JSON.stringify(status)),calls=[];
const ctx={window:{dispatchEvent(){}},CustomEvent:function(){},localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){}},URLSearchParams,AbortController,performance,setTimeout,clearTimeout,console,fetch:async(url,options)=>{calls.push(url);return route(url,options)}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('kit-local.js','utf8'),ctx);
function section(source,start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))}
(async()=>{
 const c=new ctx.window.ZebjusDroneKit.LocalKitClient();c._accept({...status},base);
 route=async url=>{if(url.endsWith('/api/control/acquire'))return new Response(JSON.stringify({ok:true,deviceId:ID,lockMine:true,controlRole:'WEB',lockTimeoutMs:10000}));throw Error('Status timeout')};
 const g=await c.acquire();assert(g.ok);assert.equal(c.status.lockMine,true);assert.equal(calls.length,1,'accepted grant needs no status request');
 let resolveOld;route=()=>new Promise(resolve=>resolveOld=resolve);const old=c.refresh();
 route=async()=>new Response(JSON.stringify({ok:true,deviceId:ID,lockMine:true,controlRole:'WEB'}));await c.acquire();resolveOld(new Response(JSON.stringify(status)));assert.equal((await old).lockMine,true,'old status cannot erase a newer grant');
 route=async()=>new Response(JSON.stringify(status));await c.refresh();assert.equal(c.status.lockMine,false,'fresh authoritative revocation is applied');
 route=async()=>new Response(JSON.stringify({ok:true,deviceId:'ZFC-FFEEDDCCBBAA',lockMine:true,controlRole:'WEB'}));await assert.rejects(c.acquire(),/valid control grant/);assert.equal(c.status.lockMine,false);
 let done;route=()=>new Promise(resolve=>done=resolve);const pending=c.acquire();c.disconnect();done(new Response(JSON.stringify({ok:true,deviceId:ID,lockMine:true,controlRole:'WEB'})));await assert.rejects(pending,/cancelled/);assert.equal(c.status,null);
 c._accept({...status},base);let grantReply;route=url=>url.endsWith('/api/control/acquire')?new Promise(resolve=>grantReply=resolve):Promise.resolve(new Response(JSON.stringify(status)));
 const grantedAfterPoll=c.acquire();await c.refresh();grantReply(new Response(JSON.stringify({ok:true,deviceId:ID,lockMine:true,controlRole:'WEB'})));await grantedAfterPoll;assert.equal(c.status.lockMine,true,'accepted grant wins over a pre-grant status completed while acquisition was pending');
 route=url=>url.endsWith('/api/control/acquire')?new Promise(resolve=>grantReply=resolve):Promise.resolve(new Response('{"ok":true}'));const cancelledByRelease=c.acquire();await c.release();grantReply(new Response(JSON.stringify({ok:true,deviceId:ID,lockMine:true,controlRole:'WEB'})));await assert.rejects(cancelledByRelease,/cancelled/);assert.equal(c.status.lockMine,false,'release fences an outstanding grant without disconnecting');
 const s=fs.readFileSync('school-lab.js','utf8'),d={deviceId:ID,deviceName:'Lab kit',online:true,locked:true,lockMine:false,controlRole:'WEB'};
 const school={selected:()=>d,selectedConnected:()=>true,client:{connected:true,base,status:{...status,lockMine:true,locked:true,controlRole:'WEB'},acquire:async()=>({ok:true}),refresh:async()=>{throw Error('No status after grant')}},st:{lastLockGoodAt:0},upsertStatus:v=>Object.assign(d,v),log(){},clearError(){},statusUi(){}};
 vm.createContext(school);vm.runInContext(section(s,'async function acquireLock(','async function releaseLock('),school);assert.equal(await school.acquireLock(false),true);assert(d.lockMine);assert(school.st.lastLockGoodAt>0);
 Object.assign(school,{window:{ZebjusDroneKit:{sameDeviceIdentity:(a,b)=>a===b},dispatchEvent(){}},Date,JSON,Array,Number,CustomEvent:function(){},healthFromTelemetry(){},updateRateUi(){},updateHealthUi(){},expireReceiverMirror(){},stopAppTripod(){},api:()=>null});
 vm.runInContext(section(s,'function receiveRcTelemetry(','async function telemetryTick('),school);
 school.receiveRcTelemetry({deviceId:ID,lockMine:true,locked:true,viewOnly:false,controlRole:'WEB'});assert(d.lockMine,'same-client telemetry restores UI ownership');
 school.receiveRcTelemetry({deviceId:ID,controlRole:'MOBILE'});assert(d.lockMine,'public role packets cannot revoke a client grant');
 school.receiveRcTelemetry({deviceId:ID,lockMine:false,locked:true,controlRole:'MOBILE',viewOnly:true});assert.equal(d.lockMine,false,'fresh scoped HTTP still revokes ownership');
 console.log('PASS: grants survive status timeout; old status, wrong device and disconnect fenced; UI ownership reconciles from scoped telemetry only');
})().catch(e=>{console.error(e);process.exitCode=1});
