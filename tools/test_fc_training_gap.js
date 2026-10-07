'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=1000,requests=[],reply;
const device={deviceId:'ZFC-001122334455',boardId:'ZFC-A2',mode:'STA',trainingActive:true,outputsBlocked:true,trainingTarget:'TRIPOD',trainingController:'APP',trainingRunId:11};
const secure={lastReceive:1000};
const window={zebjusSchool:{client:{base:'http://kit',command:async data=>{requests.push(data);return data.type==='training_engine'?{deviceId:device.deviceId,outputsBlocked:true,runId:11}:await new Promise(r=>reply=r);}},getSelectedDevice:()=>device,isSelectedConnected:()=>true},ZfcSecurity:{get:()=>secure},dispatchEvent(){},addEventListener(){}};
const context={window,Date:{now:()=>now},performance:{now:()=>now},setInterval(){},CustomEvent:class{},document:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('fc-training-bridge.js','utf8'),context);
(async()=>{
 const bridge=window.AerionFcTraining;await bridge.select('FC_PID','TRIPOD');bridge.tick('TRIPOD',{roll:0});bridge.tick('TRIPOD',{roll:1});assert.equal(requests.length,2,'one virtual sensor request in flight');
 now=3000;bridge.pause();bridge.tick('TRIPOD',{roll:0});assert.equal(bridge.engine,'FC_PID');assert.equal(requests.length,2,'stale pairing freezes without HTTP retry');
 reply({deviceId:device.deviceId,outputsBlocked:true,runId:11,engine:'FC_PID',sensorSeq:1,motors:[1500,1500,1500,1500]});await new Promise(r=>setImmediate(r));assert.equal(bridge.current('TRIPOD'),null,'old in-flight output stays fenced');
 secure.lastReceive=now;bridge.tick('TRIPOD',{roll:0});assert.equal(requests.at(-1).runId,11);reply({deviceId:device.deviceId,outputsBlocked:true,runId:11,engine:'FC_PID',sensorSeq:2,motors:[1000,1000,1000,1000]});await new Promise(r=>setImmediate(r));assert(bridge.current('TRIPOD'));
 now+=100;device.trainingRunId=12;bridge.tick('TRIPOD',{roll:0});assert.equal(bridge.engine,'WEB');assert.equal(bridge.current('TRIPOD'),null);assert.equal(requests.filter(x=>x.type==='training_engine').length,1,'recovery never recreates or selects a run');
 console.log('PASS: production FC PID bridge freezes stale output, retains engine/run, fences late replies and resumes one bounded exchange');
})().catch(e=>{console.error(e);process.exitCode=1});
