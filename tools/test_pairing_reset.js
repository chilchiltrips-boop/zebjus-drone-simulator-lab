'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('kit-security.js','utf8'),C=require('../vendor/crypto/zfc-crypto.js');
const id='ZFC-001122334455',name='zebjus_drone_001122334455',old='11111111111111111111111111111111',fresh='22222222222222222222222222222222';
function fixture({saved=old,reply=fresh,error=403}={}){
 const dialogs=[],attempts=[],saves=[];
 const document={body:{append(){}},createElement(){const input={value:reply||''},label={textContent:''};return{querySelector:q=>q==='input'?input:label,addEventListener(type,fn){this.close=fn},showModal(){dialogs.push(label.textContent);queueMicrotask(()=>{this.returnValue=reply===null?'cancel':'pair';this.close()})},remove(){}}}};
 const w={ZfcCrypto:C,AerionAndroid:{pairCode:()=>saved,savePairCode:(...v)=>saves.push(v)}};
 vm.runInNewContext(source,{window:w,document,TextEncoder,TextDecoder,URL,URLSearchParams,Uint8Array,DataView,BigInt,Date,queueMicrotask});
 w.ZfcSecurity.Channel.prototype.pair=async function(code){attempts.push({code,role:this.role,id:this.id});if(code===old)throw Object.assign(Error('Pairing code not accepted'),{status:error});if(code!==fresh)throw Object.assign(Error('Pairing code not accepted'),{status:403});this.info={deviceId:id,name,role:this.role};};
 return{w,dialogs,attempts,saves,run:()=>w.ZfcSecurity.ensure('http://192.168.4.1',{deviceId:id,name,securityRequired:true},'MOBILE-reset-test','MOBILE',()=>{})};
}
(async()=>{
 let f=fixture();const ch=await f.run();assert.equal(ch.role,'MOBILE');assert.equal(f.attempts.length,2);assert.equal(f.dialogs.length,1);assert.match(f.dialogs[0],/PAIR RESET/);assert.equal(f.saves[0][0],id);assert.equal(f.saves[0][1],fresh);
 f=fixture({saved:fresh});await f.run();assert.equal(f.dialogs.length,0);assert.equal(f.attempts.length,1);
 f=fixture({saved:'',reply:fresh});await f.run();assert.equal(f.dialogs.length,1);assert.equal(f.attempts.length,1);
 for(const status of [409,423,503]){f=fixture({error:status});await assert.rejects(f.run(),/not accepted/);assert.equal(f.dialogs.length,0);assert.equal(f.saves.length,0);}
 f=fixture({reply:null});await assert.rejects(f.run(),/cancelled/);assert.equal(f.attempts.length,1);assert.equal(f.saves.length,0);
 f=fixture({reply:old});await assert.rejects(f.run(),/not accepted/);assert.equal(f.dialogs.length,1);assert.equal(f.attempts.length,2);assert.equal(f.saves.length,0);
 console.log('PASS: rejected Android saved code prompts once after reset; successful code is saved for exact kit; current code, cancellation, bounded failures and non-auth errors preserve behavior');
})().catch(e=>{console.error(e);process.exitCode=1});
