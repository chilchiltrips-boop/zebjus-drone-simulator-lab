'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),THREE=await import(pathToFileURL(path.join(root,'three.module.min.js'))),source=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const start=source.indexOf('function setTripodAttitude('),end=source.indexOf('function simLoop(',start);assert(start>=0&&end>start);
 const ctx={rad:degrees=>degrees*Math.PI/180};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);const body=new THREE.Group();
 const right=()=>new THREE.Vector3(-1,0,0).applyQuaternion(body.quaternion),nose=()=>new THREE.Vector3(0,0,1).applyQuaternion(body.quaternion);
 ctx.setTripodAttitude(body,20,0,0);assert(right().y<-.3,'right roll must lower the model right side');
 ctx.setTripodAttitude(body,-20,0,0);assert(right().y>.3,'left roll must raise the model right side');
 ctx.setTripodAttitude(body,0,20,0);assert(nose().y<-.3,'forward pitch still lowers the nose');
 ctx.setTripodAttitude(body,0,0,45);assert(Math.abs(nose().x-Math.SQRT1_2)<1e-10);assert.equal(body.rotation.order,'YXZ');
 console.log('PASS: production Tripod right/left roll, forward pitch and unchanged yaw/order with actual Three.js body geometry');
})().catch(e=>{console.error(e);process.exitCode=1});
