'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {WebSocketServer,WebSocket}=require('ws');

const PORT=Number(process.env.PORT||8787);
const INSTRUCTOR_PIN=String(process.env.INSTRUCTOR_PIN||'1234');
const DEVICE_SHARED_TOKEN=String(process.env.DEVICE_SHARED_TOKEN||'zebjus-lab-device');
const ALLOW_REMOTE_BENCH_RC=/^(1|true|yes)$/i.test(String(process.env.ALLOW_REMOTE_BENCH_RC||'false'));
const ROOT=path.resolve(__dirname);
const browsers=new Map();
const devices=new Map();

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8'};
const json=(ws,o)=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))};
const id=()=>crypto.randomUUID().replace(/-/g,'').slice(0,12);
const safe=s=>String(s||'').trim().slice(0,120);
const sameRoom=(a,b)=>a.schoolId===b.schoolId&&a.labId===b.labId&&a.sessionId===b.sessionId;
const sameLab=(a,b)=>a.schoolId===b.schoolId&&a.labId===b.labId;

function staticHandler(req,res){
 let u;try{u=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end('Bad request')}
 if(u.pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,version:'18.0.0',devices:devices.size,browsers:browsers.size,remoteBenchRc:ALLOW_REMOTE_BENCH_RC}))}
 let rel=decodeURIComponent(u.pathname);if(rel==='/'||!rel)rel='/index.html';
 const file=path.resolve(ROOT,'.'+rel);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 fs.stat(file,(err,st)=>{
  if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':path.extname(file)==='.html'?'no-cache':'public, max-age=300'});fs.createReadStream(file).pipe(res)
 })
}
const server=http.createServer(staticHandler);
const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024});
server.on('upgrade',(req,socket,head)=>{let u;try{u=new URL(req.url,'http://localhost')}catch{socket.destroy();return}if(u.pathname!=='/ws'){socket.destroy();return}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req))});

function participantList(info){return [...browsers.values()].filter(x=>sameRoom(x,info)).map(x=>({clientId:x.clientId,userName:x.userName,role:x.role}))}
function deviceDto(d){return{deviceId:d.deviceId,deviceName:d.deviceName,schoolId:d.schoolId,labId:d.labId,firmware:d.firmware,mode:d.mode,network:d.network,ssid:d.ssid,rssi:d.rssi,ip:d.ip,online:!!(d.ws&&d.ws.readyState===WebSocket.OPEN),lastSeen:d.lastSeen,lastSeenText:d.lastSeen?new Date(d.lastSeen).toLocaleTimeString():'--',lockOwnerClientId:d.lockOwnerClientId||'',lockOwnerName:d.lockOwnerName||'',lockSessionId:d.lockSessionId||''}}
function sendDeviceList(info){const list=[...devices.values()].filter(d=>sameLab(d,info)).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)).map(deviceDto);json(info.ws,{type:'device_list',devices:list})}
function broadcastLab(info,msg){for(const b of browsers.values())if(sameLab(b,info))json(b.ws,msg)}
function broadcastRoom(info,msg,exclude=null){for(const b of browsers.values())if(b.ws!==exclude&&sameRoom(b,info))json(b.ws,msg)}
function refreshRoom(info){const list=participantList(info);for(const b of browsers.values())if(sameRoom(b,info))json(b.ws,{type:'participant_list',participants:list})}
function refreshLab(info){for(const b of browsers.values())if(sameLab(b,info))sendDeviceList(b)}
function releaseLocks(clientId){for(const d of devices.values())if(d.lockOwnerClientId===clientId){d.lockOwnerClientId='';d.lockOwnerName='';d.lockSessionId='';broadcastLab(d,{type:'device_released',deviceId:d.deviceId,message:`${d.deviceName||d.deviceId} released`});refreshLab(d)}}

function browserHello(ws,m){
 const role=m.role==='student'?'student':'instructor';if(role==='instructor'&&String(m.instructorPin||'')!==INSTRUCTOR_PIN){json(ws,{type:'hello_ack',ok:false,error:'Invalid instructor PIN'});return false}
 const info={ws,clientId:id(),clientType:'browser',role,userName:safe(m.userName)||role,schoolId:safe(m.schoolId)||'SCHOOL-01',labId:safe(m.labId)||'F450-LAB',sessionId:safe(m.sessionId)||'CLASS-A'};browsers.set(ws,info);ws._zinfo=info;json(ws,{type:'hello_ack',ok:true,clientId:info.clientId,role,version:'18.0.0',remoteBenchRc:ALLOW_REMOTE_BENCH_RC});sendDeviceList(info);refreshRoom(info);broadcastRoom(info,{type:'activity',userName:'System',message:`${info.userName} joined as ${role}`},ws);return true
}
function deviceHello(ws,m){
 if(String(m.token||'')!==DEVICE_SHARED_TOKEN){json(ws,{type:'hello_ack',ok:false,error:'Invalid device token'});return false}
 const deviceId=safe(m.deviceId);if(!deviceId){json(ws,{type:'hello_ack',ok:false,error:'deviceId required'});return false}
 const old=devices.get(deviceId);if(old?.ws&&old.ws!==ws)try{old.ws.close(4001,'Replaced by new connection')}catch{}
 const d={...(old||{}),ws,clientType:'device',deviceId,deviceName:safe(m.deviceName)||deviceId,schoolId:safe(m.schoolId)||'SCHOOL-01',labId:safe(m.labId)||'F450-LAB',firmware:safe(m.firmware)||'unknown',mode:safe(m.mode)||'STA',network:safe(m.network),ssid:safe(m.ssid),rssi:Number.isFinite(+m.rssi)?+m.rssi:null,ip:safe(m.ip),lastSeen:Date.now(),lockOwnerClientId:old?.lockOwnerClientId||'',lockOwnerName:old?.lockOwnerName||'',lockSessionId:old?.lockSessionId||''};devices.set(deviceId,d);ws._zinfo=d;json(ws,{type:'hello_ack',ok:true,deviceId,version:'18.0.0',remoteBenchRc:ALLOW_REMOTE_BENCH_RC});broadcastLab(d,{type:'device_meta',deviceId,message:`${d.deviceName} online`});refreshLab(d);return true
}
function isOwner(info,d){return info.role==='instructor'&&d.lockOwnerClientId===info.clientId}
function handleBrowser(info,m){
 switch(m.type){
  case 'list_devices': return sendDeviceList(info);
  case 'lock_device':{
   if(info.role!=='instructor')return json(info.ws,{type:'error',error:'Students are view-only'});const d=devices.get(safe(m.deviceId));if(!d||!sameLab(d,info))return json(info.ws,{type:'error',error:'Module not found'});if(d.lockOwnerClientId&&d.lockOwnerClientId!==info.clientId)return json(info.ws,{type:'lock_denied',deviceId:d.deviceId,error:`Module is locked by ${d.lockOwnerName||'another instructor'}`});d.lockOwnerClientId=info.clientId;d.lockOwnerName=info.userName;d.lockSessionId=info.sessionId;broadcastLab(d,{type:'device_locked',deviceId:d.deviceId,message:`${d.deviceName} locked by ${info.userName}`});refreshLab(d);return;
  }
  case 'release_device':{
   const d=devices.get(safe(m.deviceId));if(!d||!isOwner(info,d))return json(info.ws,{type:'error',error:'You do not own this module lock'});d.lockOwnerClientId='';d.lockOwnerName='';d.lockSessionId='';broadcastLab(d,{type:'device_released',deviceId:d.deviceId,message:`${d.deviceName} released`});refreshLab(d);return;
  }
  case 'device_command':{
   const d=devices.get(safe(m.deviceId));if(!d||!sameLab(d,info))return json(info.ws,{type:'error',error:'Module not found'});if(!isOwner(info,d))return json(info.ws,{type:'error',error:'Lock & Connect this module first'});if(!d.ws||d.ws.readyState!==WebSocket.OPEN)return json(info.ws,{type:'error',error:'Module is offline'});const cmd=m.command||{};if(cmd.type==='rc_frame'&&!ALLOW_REMOTE_BENCH_RC)return json(info.ws,{type:'error',error:'Remote bench RC is disabled on the server. Use simulation or enable ALLOW_REMOTE_BENCH_RC for prop-off bench testing.'});json(d.ws,{type:'device_command',deviceId:d.deviceId,from:{clientId:info.clientId,userName:info.userName,sessionId:info.sessionId},command:cmd});return;
  }
  case 'sim_state': if(info.role==='instructor')broadcastRoom(info,{type:'sim_state',from:info.clientId,state:m.state||{}},info.ws);return;
  case 'joystick_state': if(info.role==='instructor')broadcastRoom(info,{type:'joystick_state',from:info.clientId,channels:Array.isArray(m.channels)?m.channels.slice(0,10):[],target:safe(m.target)},info.ws);return;
  case 'presentation_state': if(info.role==='instructor')broadcastRoom(info,{type:'presentation_state',from:info.clientId,state:m.state||{}},info.ws);return;
  case 'activity': if(info.role==='instructor')broadcastRoom(info,{type:'activity',userName:info.userName,message:safe(m.message)},info.ws);return;
 }
}
function handleDevice(d,m){
 d.lastSeen=Date.now();
 if(m.type==='status'){
  if(m.deviceName)d.deviceName=safe(m.deviceName);if(m.schoolId)d.schoolId=safe(m.schoolId);if(m.labId)d.labId=safe(m.labId);if(m.firmware)d.firmware=safe(m.firmware);if(m.mode)d.mode=safe(m.mode);if(m.network!=null)d.network=safe(m.network);if(m.ssid!=null)d.ssid=safe(m.ssid);if(Number.isFinite(+m.rssi))d.rssi=+m.rssi;if(m.ip!=null)d.ip=safe(m.ip);refreshLab(d)
 }
 const packet=m.packet||m;for(const b of browsers.values())if(sameLab(b,d))json(b.ws,{type:'device_packet',deviceId:d.deviceId,packet});
}

wss.on('connection',ws=>{
 ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',buf=>{let m;try{m=JSON.parse(String(buf))}catch{return json(ws,{type:'error',error:'Invalid JSON'})}const info=ws._zinfo;if(!info){if(m.type!=='hello')return json(ws,{type:'error',error:'hello required first'});return m.clientType==='device'?deviceHello(ws,m):browserHello(ws,m)}if(info.clientType==='browser')handleBrowser(info,m);else handleDevice(info,m)});
 ws.on('close',()=>{const info=ws._zinfo;if(!info)return;if(info.clientType==='browser'){browsers.delete(ws);releaseLocks(info.clientId);refreshRoom(info);broadcastRoom(info,{type:'activity',userName:'System',message:`${info.userName} left`})}else{const d=devices.get(info.deviceId);if(d&&d.ws===ws){d.ws=null;d.lastSeen=Date.now();broadcastLab(d,{type:'device_offline',deviceId:d.deviceId});refreshLab(d)}}})
});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;try{ws.ping()}catch{}}},30000);wss.on('close',()=>clearInterval(heartbeat));
server.listen(PORT,()=>{console.log(`ZEBJUS F450 School Cloud V18 on http://0.0.0.0:${PORT}`);console.log(`Instructor PIN: ${INSTRUCTOR_PIN==='1234'?'1234 (DEMO DEFAULT — CHANGE IN PRODUCTION)':'configured'}`);console.log(`Remote bench RC: ${ALLOW_REMOTE_BENCH_RC?'ENABLED':'DISABLED'}`)});
