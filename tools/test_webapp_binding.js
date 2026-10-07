'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ID='ZFC-001122334455',status={ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:ID,name:'Test kit',mode:'STA',ip:'127.0.0.1',securityRequired:true,webAppRouting:true};
function browser(seed){
 const calls=[],ctx={window:{dispatchEvent(){},crypto:{randomUUID:()=>String(seed),getRandomValues:a=>{a[0]=seed;return a;}}},CustomEvent:function(){},localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null,setItem(){}},URLSearchParams,AbortController,performance,setTimeout,clearTimeout,console};
 ctx.window.ZfcSecurity={ensure:async()=>{},get:()=>null};ctx.fetch=async(url,options)=>{const u=new URL(url),data=Object.fromEntries(new URLSearchParams(options?.body));calls.push({path:u.pathname,data});if(u.pathname==='/api/webapp/register')return new Response(JSON.stringify({ok:true,deviceId:ID,webAppId:String(Number(data.webAppId)+1)}));return new Response(JSON.stringify(status));};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('kit-local.js','utf8'),ctx);return{ctx,calls,client:new ctx.window.ZebjusDroneKit.LocalKitClient()};
}
(async()=>{
 const one=browser(1),two=browser(2);assert.notEqual(one.client.clientId,two.client.clientId,'duplicated tabs do not share an authority identity');
 await one.client.connect(ID,'127.0.0.1',ID);assert.equal(one.client.webAppId,'100002');assert(one.client.webAppRegistered);const reg=one.calls.find(x=>x.path==='/api/webapp/register');assert.equal(reg.data.expectedDeviceId,ID);assert.equal(reg.data.clientId,one.client.clientId);
 one.client.status.controlRole='MOBILE';const n=one.calls.length;await assert.rejects(one.client.acquire(true),/Stop app training/);assert.equal(one.calls.length,n,'web cannot take the active mobile lease');one.client.disconnect();assert(!one.client.webAppRegistered);
 const app=fs.readFileSync('tools/flight_app_source.html','utf8'),a=app.indexOf('function savedWebAppId()'),b=app.indexOf('// Native simulator input',a),store=new Map(),elements=new Map(),events=[];
 const ctx={state:{deviceId:ID,training:null},read:(k,f)=>store.get(k)??f,write:(k,v)=>store.set(k,v),$:id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:''});return elements.get(id);},document:{activeElement:null},notify:m=>events.push(m),stopControl(){events.push('stop');ctx.state.training=null;ctx.state.cleanup=Promise.resolve();}};
 vm.createContext(ctx);vm.runInContext(app.slice(a,b),ctx);ctx.$('trainingWebAppId').value='123456';await ctx.$('saveTrainingWebAppId').onclick();assert.equal(ctx.savedWebAppId(),'123456');ctx.paintWebAppId();assert.equal(ctx.$('trainingWebAppId').value,'123456');
 ctx.$('trainingWebAppId').value='123';await ctx.$('saveTrainingWebAppId').onclick();assert.equal(ctx.savedWebAppId(),'123456');ctx.state.training={runId:1};ctx.$('trainingWebAppId').value='654321';ctx.paintWebAppId();assert.equal(ctx.$('trainingWebAppId').value,'654321','blur and periodic paint preserve the unsaved replacement before Save');await ctx.$('saveTrainingWebAppId').onclick();assert.equal(ctx.savedWebAppId(),'654321');assert(events.includes('stop'));assert.equal(ctx.state.training,null);
 ctx.state.deviceId='ZFC-FFEEDDCCBBAA';assert.equal(ctx.savedWebAppId(),'','saved IDs stay scoped to exact kit');ctx.paintWebAppId();assert.equal(ctx.$('trainingWebAppId').value,'','changing kits resets the draft');ctx.state.deviceId=ID;ctx.paintWebAppId();assert.equal(ctx.$('trainingWebAppId').value,'654321');
 console.log('PASS: shipped WebApp authenticated registration/collision reply, distinct tab identities, MOBILE observer fence; app ID enter/save/replace, invalid input and per-kit persistence');
})().catch(e=>{console.error(e);process.exitCode=1;});
