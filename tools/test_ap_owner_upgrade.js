'use strict';
// AP discovery must remain automatic, while physical control requires independently proven OWNER pairing.
// Transport and dialogs are simulated; no hardware is armed by this test.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('kit-security.js','utf8'),local=fs.readFileSync('kit-local.js','utf8'),Crypto=require('../vendor/crypto/zfc-crypto.js');
const ID='ZFC-001122334455',NAME='zebjus_drone_1',BASE='http://192.168.4.1',CLIENT='WEB-OWNER-UPGRADE-TEST',OWNER='0012345678';
let responseCode=OWNER,dialogs=0,rejectPermission=false,actions=[];
const dom={body:{append(){}},createElement(){
 const input={value:responseCode??''},label={textContent:''};
 return{querySelector:q=>q==='input'?input:label,addEventListener(event,cb){if(event==='close')this.close=cb},showModal(){dialogs++;queueMicrotask(()=>{this.returnValue=responseCode===null?'cancel':'pair';this.close()})},remove(){}};
}};
const win={ZfcCrypto:Crypto,crypto:{getRandomValues:a=>a.fill(7),randomUUID:()=>CLIENT},dispatchEvent(){}};
const context={window:win,document:dom,TextEncoder,TextDecoder,Uint8Array,DataView,BigInt,Date,URL,URLSearchParams,queueMicrotask,console,performance,AbortController,setTimeout,clearTimeout,CustomEvent:function(){},localStorage:{getItem:()=>null,setItem(){}},fetch:()=>{throw Error('Pairing stub should never make an unencrypted control request')}};
vm.createContext(context);
const instrumented=source.replace('w.ZfcSecurity={Channel,ensure,requireOwner,','w.ZfcSecurity={_testRegistry:registry,Channel,ensure,requireOwner,');
assert.notEqual(instrumented,source,'test instrumentation must match the exported security API');
vm.runInContext(instrumented,context);
const Security=win.ZfcSecurity;
Security.Channel.prototype.pair=async function(code){
 actions.push({event:'pair',credential:this.credential,code,deviceId:this.id,role:this.role});
 if(this.credential==='OWNER'&&code!==OWNER)throw Object.assign(Error('Pairing code not accepted'),{status:403});
 this.info={deviceId:this.id,name:NAME,role:this.role,controlPermission:this.credential==='OWNER'&&!rejectPermission,mode:'AP'};
};
Security.Channel.prototype.request=async function(path){
 actions.push({event:'request',path,credential:this.credential});
 if(path==='/api/control/acquire'){
  if(this.credential!=='OWNER')throw Object.assign(Error('AP credentials permit setup only'),{status:403});
  return{ok:true,deviceId:ID,controlRole:'WEB',lockMine:true,lockTimeoutMs:10000};
 }
 if(path==='/api/webapp/register')return{ok:true,deviceId:ID,webAppId:'234567'};
 if(path==='/api/security/info')return this.info;
 return{ok:true};
};
vm.runInContext(local,context);
(async()=>{
 const st={ok:true,securityRequired:true,apWifiPairing:true,kit:'ZEBJUS_FLIGHTCORE',mode:'AP / DIRECT',deviceId:ID,name:NAME,locked:false,lockMine:false,controlRole:''};
 const c=new win.ZebjusDroneKit.LocalKitClient();c._accept(st,BASE);c.clientId=CLIENT;
 const ap=new Security.Channel(BASE,ID,CLIENT,'WEB','AP_WIFI');ap.info={deviceId:ID,name:NAME,role:'WEB',controlPermission:false,mode:'AP'};Security._testRegistry.set(BASE,ap);
 assert.equal(dialogs,0,'AP connection itself must not ask for OWNER');
 responseCode='00'.repeat(16);
 await assert.rejects(c.acquire(),/Pairing code not accepted/);
 assert.equal(Security.get(BASE),ap,'wrong OWNER code must preserve AP setup session');
 assert.equal(actions.filter(x=>x.path==='/api/control/acquire').length,0,'wrong code never obtains a control lease');
 responseCode=null;
 await assert.rejects(c.acquire(),/Pairing cancelled/);
 assert.equal(Security.get(BASE),ap,'cancelling OWNER dialog must preserve AP setup session');
 responseCode=OWNER;rejectPermission=true;
 await assert.rejects(c.acquire(),/did not confirm OWNER control permission/);
 assert.equal(Security.get(BASE),ap,'no OWNER permission must preserve the setup session');
 rejectPermission=false;
 c.webAppRegistered=true;c.webAppId='123456';
 const grant=await c.acquire();
 assert.equal(grant.lockMine,true);
 assert.equal(c.status.lockMine,true);
 assert.equal(c.webAppId,'234567','OWNER pairing must re-register WebApp ID under new secure session');
 assert.equal(Security.get(BASE).credential,'OWNER');
 assert.equal(actions.filter(x=>x.path==='/api/control/acquire').length,1);
 const before=dialogs;await c.acquire();assert.equal(dialogs,before,'same OWNER session should not ask twice');
 await assert.rejects(Security.requireOwner(BASE,{...st,deviceId:'ZFC-FFEEDDCCBBAA'},CLIENT,'WEB',()=>{}),/Reconnect and verify/);
 assert.equal(Security.get(BASE).credential,'OWNER');
 console.log('PASS: AP auto-connect stays view-only; explicit OWNER challenge, rejection/cancel safety, exact kit identity, new secure WebApp registration and Take Control');
})().catch(e=>{console.error(e);process.exitCode=1});
