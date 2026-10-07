'use strict';
// UI-only tests use an authenticated transport double. Actual SRP/GCM and
// permission interoperability are exercised by test_secure_browser/frames/native.
async function install(context){await context.addInitScript(()=>{
 const channels=new Map();
 const security={
  get:base=>channels.get(base),clear:base=>channels.delete(base),
  async ensure(base,st,cid,role){
   const channel={id:st.deviceId,cid,role,info:{deviceId:st.deviceId,name:st.name,role,mode:String(st.mode).startsWith('AP')?'AP':'STA',pidPermission:true},lastReceive:Date.now(),
    async request(path,data,raw,timeout,method){if(data?.expectedDeviceId&&data.expectedDeviceId!==this.id)throw Error('Request belongs to another paired kit.');const answer=await raw(path,data,timeout,method);this.lastReceive=Date.now();return answer;}};
   channels.set(base,channel);return channel;
  },hex:bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
 };
 Object.defineProperty(window,'ZfcSecurity',{configurable:true,get:()=>security,set() {}});
 });}
async function training(page){await page.addInitScript(()=>{
 const run={deviceId:'ZFC-001122334455',mode:'STA',trainingActive:true,trainingTarget:'FLIGHT',trainingController:'WEB',trainingRunId:1,outputsBlocked:true};window.__uiTrainingKit=run;
 Object.defineProperty(window,'AerionFcTraining',{configurable:true,get:()=>({kit:()=>window.__uiTrainingKit,tick(){},engine:'WEB'}),set(){}});
 });}
module.exports={install,training};
