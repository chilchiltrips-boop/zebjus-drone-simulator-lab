'use strict';
// UI-only tests use an authenticated transport double. Actual SRP/GCM and
// permission interoperability are exercised by test_secure_browser/frames/native.
async function install(context,{native=true}={}){await context.addInitScript(({native})=>{
 const channels=new Map();
 // Native publisher double: use latest input directly, independent of mocked HTTP refresh.
 let nativeValue,lastAck=0,active=false,last={},sent=0;
 if(native)Object.defineProperty(window,'NativeAerion',{configurable:true,get:()=>nativeValue,set(value){nativeValue=value;if(!value)return;
  value.offerInput=(token,base,id,cid,csv,run)=>{active=true;sent++;const data=new URLSearchParams({clientId:cid,expectedDeviceId:id,type:'rc_frame',channels:csv,...(run?{simulationRunId:run}:{})});window.__api(base+'/api/command',data.toString()).then(reply=>{if(reply.code===200){last=JSON.parse(reply.body);lastAck=performance.now();}}).catch(()=>{});return true;};
  value.rcDiagnostics=()=>JSON.stringify({streaming:active,validatedControllerAck:lastAck>0,ackAgeMs:lastAck?performance.now()-lastAck:0,inputAgeMs:0,framesSent:sent,acksReceived:sent,outputsBlocked:!!last.outputsBlocked,trainingRunId:last.trainingRunId||last.runId||0,virtualArmed:!!last.virtualArmed,controllerArmed:!!last.armed,controllerReady:true});
  const request=value.request;value.request=function(token,n,address,method,form,...rest){const data=new URLSearchParams(form);if(new URL(address).pathname==='/api/command'&&data.get('type')==='rc_frame'){value.offerInput(token,new URL(address).origin,data.get('expectedDeviceId'),data.get('clientId'),data.get('channels'),Number(data.get('simulationRunId'))||0);window.AerionAndroid.deliver(n,200,JSON.stringify({...last,ok:true,rcQueued:true,rcAckAgeMs:lastAck?performance.now()-lastAck:0,validatedControllerAck:lastAck>0}));return;}return request.call(value,token,n,address,method,form,...rest);};
  value.pauseStream=()=>{active=false;};
 }});
 const security={
  get:base=>channels.get(base),clear:base=>channels.delete(base),
  async ensure(base,st,cid,role){
   const existing=channels.get(base);if(existing?.id===st.deviceId&&existing.cid===cid&&existing.role===role)return existing;
   const channel={id:st.deviceId,cid,role,info:{deviceId:st.deviceId,name:st.name,role,mode:String(st.mode).startsWith('AP')?'AP':'STA',pidPermission:true},lastReceive:Date.now(),
    monitorTicket:()=>'',decode:packet=>packet,
    async request(path,data,raw,timeout,method){if(data?.expectedDeviceId&&data.expectedDeviceId!==this.id)throw Error('Request belongs to another paired kit.');const answer=await raw(path,data,timeout,method);this.lastReceive=Date.now();return answer;}};
   channels.set(base,channel);return channel;
  },hex:bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
 };
 Object.defineProperty(window,'ZfcSecurity',{configurable:true,get:()=>security,set() {}});
 },{native});}
async function training(page){await page.addInitScript(()=>{
 const run={deviceId:'ZFC-001122334455',mode:'STA',trainingActive:true,trainingTarget:'FLIGHT',trainingController:'WEB',trainingRunId:1,outputsBlocked:true};window.__uiTrainingKit=run;
 Object.defineProperty(window,'AerionFcTraining',{configurable:true,get:()=>({kit:()=>window.__uiTrainingKit,tick(){},engine:'WEB'}),set(){}});
 });}
module.exports={install,training};
