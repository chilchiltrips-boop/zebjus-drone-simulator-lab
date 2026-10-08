'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('../vendor/crypto/zfc-crypto.js');
const source=fs.readFileSync('kit-security.js','utf8'),id='ZFC-41FEFF63B0E4',name='FlightCore A2-41FEFF63B0E4';
function fixture(mode='AP',role='MOBILE',reject=false){
 const attempts=[],saves=[],w={ZfcCrypto:C,AerionAndroid:{pairCode(){throw Error('AP path must not read saved owner credentials')},savePairCode:(...a)=>saves.push(a)}};
 const document={createElement(){throw Error('AP path must not open a pairing dialog')}};
 vm.runInNewContext(source,{window:w,document,TextEncoder,TextDecoder,URL,URLSearchParams,Uint8Array,DataView,BigInt,Date});
 w.ZfcSecurity.Channel.prototype.pair=async function(code){attempts.push({code,credential:this.credential,role:this.role});if(reject)throw Object.assign(Error('AP proof rejected'),{status:403});this.info={deviceId:id,name,role:this.role};};
 return{w,attempts,saves,run:()=>w.ZfcSecurity.ensure('http://192.168.4.1',{deviceId:id,name,mode,securityRequired:true,apWifiPairing:true},'AP-auto-pair-session',role,()=>{})};
}
(async()=>{
 for(const role of ['MOBILE','WEB']){const f=fixture('AP',role);await f.run();assert.equal(f.attempts.length,1);assert.equal(f.attempts[0].credential,'AP_WIFI');assert.equal(f.attempts[0].role,role);assert.equal(f.saves.length,0);assert.match(f.attempts[0].code,/^[A-F0-9]{32}$/);assert.notEqual(f.w.ZfcSecurity.apWifiCode(id),f.w.ZfcSecurity.apWifiCode('ZFC-001122334455'),'AP secret is device scoped');}
 const f=fixture('AP','MOBILE',true);await assert.rejects(f.run(),/AP proof rejected/);assert.equal(f.attempts.length,1,'failed AP proof never falls back to an owner prompt');assert.equal(f.saves.length,0);
 await assert.rejects(fixture('STA').run(),/saved owner credentials/,'STA never chooses automatic AP credentials');await assert.rejects(fixture('AP','COMPANION').run(),/saved owner credentials/);
 console.log('PASS: production AP auto-pair path has no code dialog, distinct per-kit AP credential, no owner-store pollution, bounded failure and strict STA/companion exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
